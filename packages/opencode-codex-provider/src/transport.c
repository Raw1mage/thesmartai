/*
 * transport.c — HTTP SSE transport via libcurl
 *
 * Implements codex_request() — the main LLM request entry point.
 * Phase 1: HTTP SSE only. WebSocket transport added in Phase 2.
 */

#include "codex_provider.h"
#include <cjson/cJSON.h>
#include <curl/curl.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifndef _WIN32
  #include <unistd.h>
#endif

/* --------------------------------------------------------------------------
 * Forward declarations (from other TUs)
 * ----------------------------------------------------------------------- */

extern int          codex_is_initialized(void);
extern const char  *codex_get_originator(void);
extern const char  *codex_get_ca_cert(void);
extern const char  *codex_get_residency(void);
extern uint32_t     codex_get_max_retries(void);
extern uint32_t     codex_get_stream_timeout(void);

extern codex_auth_mode_t codex_auth_get_mode(void);
extern const char       *codex_auth_get_access_token(void);
extern const char       *codex_auth_get_api_key(void);
extern const char       *codex_auth_get_account_id(void);

extern int  codex_transform_request(cJSON *request);
extern int  codex_resolve_endpoint_url(char *url_buf, size_t buf_len);
extern int  codex_refresh_token(void);

/* SSE parser (from stream.c) */
typedef struct sse_parser_t sse_parser_t;
extern sse_parser_t *codex_sse_parser_create(codex_event_cb cb, void *ctx);
extern void          codex_sse_parser_destroy(sse_parser_t *p);
extern void          codex_sse_parser_feed(sse_parser_t *p, const char *data, size_t len);
extern void          codex_sse_parser_flush(sse_parser_t *p);

/* --------------------------------------------------------------------------
 * libcurl write callback → feed into SSE parser
 * ----------------------------------------------------------------------- */

typedef struct {
    sse_parser_t *parser;
} stream_ctx_t;

static size_t stream_write_cb(void *ptr, size_t size, size_t nmemb, void *userdata)
{
    stream_ctx_t *sctx = (stream_ctx_t *)userdata;
    size_t total = size * nmemb;
    codex_sse_parser_feed(sctx->parser, (const char *)ptr, total);
    return total;
}

/* --------------------------------------------------------------------------
 * Build HTTP headers for Responses API request
 * ----------------------------------------------------------------------- */

static struct curl_slist *build_headers(const codex_request_t *req)
{
    struct curl_slist *headers = NULL;
    char buf[CODEX_MAX_HEADER_LEN];

    /* Authorization */
    const char *token = codex_auth_get_access_token();
    if (!token) token = codex_auth_get_api_key();
    if (token) {
        snprintf(buf, sizeof(buf), "Authorization: Bearer %s", token);
        headers = curl_slist_append(headers, buf);
    }

    /* Content-Type */
    headers = curl_slist_append(headers, "Content-Type: application/json");

    /* originator */
    const char *orig = codex_get_originator();
    if (orig) {
        snprintf(buf, sizeof(buf), "originator: %s", orig);
        headers = curl_slist_append(headers, buf);
        snprintf(buf, sizeof(buf), "User-Agent: %s", orig);
        headers = curl_slist_append(headers, buf);
    }

    /* chatgpt-account-id (ChatGPT OAuth mode only) */
    if (codex_auth_get_mode() == CODEX_AUTH_CHATGPT) {
        const char *acct = codex_auth_get_account_id();
        if (acct) {
            snprintf(buf, sizeof(buf), "chatgpt-account-id: %s", acct);
            headers = curl_slist_append(headers, buf);
        }
    }

    /* x-codex-turn-state (sticky routing) */
    if (req->turn_state) {
        snprintf(buf, sizeof(buf), "x-codex-turn-state: %s", req->turn_state);
        headers = curl_slist_append(headers, buf);
    }

    /* x-codex-beta-features */
    if (req->beta_features) {
        snprintf(buf, sizeof(buf), "x-codex-beta-features: %s", req->beta_features);
        headers = curl_slist_append(headers, buf);
    }

    /* x-client-request-id */
    if (req->conversation_id) {
        snprintf(buf, sizeof(buf), "x-client-request-id: %s", req->conversation_id);
        headers = curl_slist_append(headers, buf);
    }

    /* Residency */
    const char *residency = codex_get_residency();
    if (residency) {
        snprintf(buf, sizeof(buf), "x-openai-internal-codex-residency: %s", residency);
        headers = curl_slist_append(headers, buf);
    }

    return headers;
}

/* --------------------------------------------------------------------------
 * codex_request — main LLM request entry point
 * ----------------------------------------------------------------------- */

CODEX_EXPORT int codex_request(const codex_request_t *req,
                               codex_event_cb cb, void *ctx)
{
    if (!codex_is_initialized()) return CODEX_ERR_NOT_INITIALIZED;
    if (!req || !req->body_json || !cb) return CODEX_ERR_INVALID_ARG;

    /* Auto-refresh stale tokens */
    int rc = codex_refresh_token();
    if (rc != CODEX_OK && rc != CODEX_ERR_NOT_INITIALIZED)
        return rc;

    /* Parse and transform request body */
    cJSON *request = cJSON_ParseWithLength(req->body_json, req->body_json_len
                                           ? req->body_json_len
                                           : strlen(req->body_json));
    if (!request) return CODEX_ERR_INVALID_REQUEST;

    /* Set model if not in body */
    if (!cJSON_GetObjectItemCaseSensitive(request, "model") && req->model) {
        cJSON_AddStringToObject(request, "model", req->model);
    }

    /* Ensure stream=true */
    cJSON_DeleteItemFromObjectCaseSensitive(request, "stream");
    cJSON_AddBoolToObject(request, "stream", 1);

    /* Apply transformations: system→instructions, strip params, strip IDs */
    rc = codex_transform_request(request);
    if (rc != CODEX_OK) {
        cJSON_Delete(request);
        return rc;
    }

    /* Add optional fields */
    if (req->service_tier) {
        cJSON_DeleteItemFromObjectCaseSensitive(request, "service_tier");
        cJSON_AddStringToObject(request, "service_tier", req->service_tier);
    }
    if (req->prompt_cache_key) {
        cJSON_DeleteItemFromObjectCaseSensitive(request, "prompt_cache_key");
        cJSON_AddStringToObject(request, "prompt_cache_key", req->prompt_cache_key);
    }

    /* Serialize */
    char *body = cJSON_PrintUnformatted(request);
    cJSON_Delete(request);
    if (!body) return CODEX_ERR_OOM;

    /* Resolve endpoint URL */
    char url[CODEX_MAX_URL_LEN];
    rc = codex_resolve_endpoint_url(url, sizeof(url));
    if (rc != CODEX_OK) { free(body); return rc; }

    /* Build headers */
    struct curl_slist *headers = build_headers(req);

    /* Create SSE parser */
    sse_parser_t *parser = codex_sse_parser_create(cb, ctx);
    if (!parser) {
        free(body);
        curl_slist_free_all(headers);
        return CODEX_ERR_OOM;
    }

    stream_ctx_t sctx = { .parser = parser };

    /* Retry loop */
    uint32_t max_retries = codex_get_max_retries();
    uint32_t stream_timeout = codex_get_stream_timeout();
    rc = CODEX_OK;

    for (uint32_t attempt = 0; attempt <= max_retries; attempt++) {
        CURL *curl = curl_easy_init();
        if (!curl) { rc = CODEX_ERR_CURL; break; }

        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, stream_write_cb);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &sctx);

        /* Timeouts */
        curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 15L);
        curl_easy_setopt(curl, CURLOPT_LOW_SPEED_LIMIT, 1L);
        curl_easy_setopt(curl, CURLOPT_LOW_SPEED_TIME,
                         (long)(stream_timeout / 1000));

        /* CA cert */
        const char *ca = codex_get_ca_cert();
        if (ca) curl_easy_setopt(curl, CURLOPT_CAINFO, ca);

        CURLcode crc = curl_easy_perform(curl);

        long http_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
        curl_easy_cleanup(curl);

        if (crc == CURLE_OK && (http_code == 200 || http_code == 0)) {
            rc = CODEX_OK;
            break;
        }

        /* Map error */
        if (http_code == 401) {
            rc = CODEX_ERR_UNAUTHORIZED;
            /* Try refresh and retry */
            int refresh_rc = codex_refresh_token();
            if (refresh_rc == CODEX_OK) {
                /* Rebuild auth header */
                curl_slist_free_all(headers);
                headers = build_headers(req);
                continue;
            }
            break;
        } else if (http_code == 429) {
            rc = CODEX_ERR_RATE_LIMIT;
        } else if (http_code == 503) {
            rc = CODEX_ERR_SERVER_OVERLOADED;
        } else if (http_code >= 500) {
            rc = CODEX_ERR_SERVER_ERROR;
        } else if (crc != CURLE_OK) {
            rc = CODEX_ERR_CURL;
        } else {
            rc = CODEX_ERR_HTTP;
            break; /* Non-retryable HTTP error */
        }

        /* Retryable — backoff */
        if (attempt < max_retries) {
            /* Exponential backoff: 200ms * 2^attempt, max 10s */
            unsigned int delay_ms = 200u << attempt;
            if (delay_ms > 10000) delay_ms = 10000;
#ifdef _WIN32
            Sleep(delay_ms);
#else
            usleep(delay_ms * 1000u);
#endif
        }
    }

    /* Flush parser for any pending events */
    codex_sse_parser_flush(parser);
    codex_sse_parser_destroy(parser);
    curl_slist_free_all(headers);
    free(body);

    return rc;
}
