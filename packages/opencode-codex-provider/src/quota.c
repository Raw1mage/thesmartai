/*
 * quota.c — Usage quota query
 *
 * Fetches rate limit status from ChatGPT backend:
 *   GET /wham/usage (chatgpt.com) or /api/codex/usage (codex API)
 */

#include "codex_provider.h"
#include <cjson/cJSON.h>
#include <curl/curl.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* --------------------------------------------------------------------------
 * External accessors
 * ----------------------------------------------------------------------- */

extern int          codex_is_initialized(void);
extern const char  *codex_get_originator(void);
extern const char  *codex_get_ca_cert(void);
extern const char  *codex_get_base_url(void);

extern codex_auth_mode_t codex_auth_get_mode(void);
extern const char       *codex_auth_get_access_token(void);
extern const char       *codex_auth_get_api_key(void);
extern const char       *codex_auth_get_account_id(void);

/* Reuse curl write callback from auth.c */
typedef struct {
    char  *data;
    size_t len;
    size_t cap;
} curl_buf_t;

static size_t quota_write_cb(void *ptr, size_t size, size_t nmemb, void *userdata)
{
    curl_buf_t *buf = (curl_buf_t *)userdata;
    size_t total = size * nmemb;
    if (buf->len + total >= buf->cap) {
        size_t newcap = (buf->cap + total) * 2 + 256;
        char *newdata = realloc(buf->data, newcap);
        if (!newdata) return 0;
        buf->data = newdata;
        buf->cap = newcap;
    }
    memcpy(buf->data + buf->len, ptr, total);
    buf->len += total;
    buf->data[buf->len] = '\0';
    return total;
}

/* --------------------------------------------------------------------------
 * Helper: parse plan_type string
 * ----------------------------------------------------------------------- */

static codex_plan_type_t parse_plan(const char *s)
{
    if (!s) return CODEX_PLAN_UNKNOWN;
    if (strcmp(s, "Pro") == 0 || strcmp(s, "pro") == 0) return CODEX_PLAN_PRO;
    if (strcmp(s, "Plus") == 0 || strcmp(s, "plus") == 0) return CODEX_PLAN_PLUS;
    if (strcmp(s, "Free") == 0 || strcmp(s, "free") == 0) return CODEX_PLAN_FREE;
    if (strcmp(s, "Team") == 0 || strcmp(s, "team") == 0) return CODEX_PLAN_TEAM;
    if (strcmp(s, "Business") == 0) return CODEX_PLAN_BUSINESS;
    if (strcmp(s, "Enterprise") == 0) return CODEX_PLAN_ENTERPRISE;
    if (strcmp(s, "Edu") == 0) return CODEX_PLAN_EDU;
    return CODEX_PLAN_UNKNOWN;
}

/* --------------------------------------------------------------------------
 * Helper: parse rate_limit window
 * ----------------------------------------------------------------------- */

static void parse_window(const cJSON *window, int *used_pct, int *window_sec,
                         int64_t *reset_at)
{
    if (!window) return;
    const cJSON *f;
    f = cJSON_GetObjectItemCaseSensitive(window, "used_percent");
    if (cJSON_IsNumber(f)) *used_pct = f->valueint;
    f = cJSON_GetObjectItemCaseSensitive(window, "limit_window_seconds");
    if (cJSON_IsNumber(f)) *window_sec = f->valueint;
    f = cJSON_GetObjectItemCaseSensitive(window, "reset_at");
    if (cJSON_IsNumber(f)) *reset_at = (int64_t)f->valuedouble;
}

/* --------------------------------------------------------------------------
 * codex_get_quota
 * ----------------------------------------------------------------------- */

CODEX_EXPORT int codex_get_quota(codex_quota_t *out)
{
    if (!codex_is_initialized()) return CODEX_ERR_NOT_INITIALIZED;
    if (!out) return CODEX_ERR_INVALID_ARG;

    memset(out, 0, sizeof(*out));

    /* Only meaningful for ChatGPT subscription mode */
    if (codex_auth_get_mode() != CODEX_AUTH_CHATGPT)
        return CODEX_ERR_AUTH_NO_CREDENTIALS;

    /* Build URL */
    char url[CODEX_MAX_URL_LEN];
    const char *base = codex_get_base_url();
    if (base && (strstr(base, "chatgpt.com") || strstr(base, "chat.openai.com"))) {
        snprintf(url, sizeof(url), "%s/wham/usage", base);
    } else if (base) {
        snprintf(url, sizeof(url), "%s/usage", base);
    } else {
        snprintf(url, sizeof(url),
                 "https://chatgpt.com/backend-api/wham/usage");
    }

    /* Build headers */
    char header_buf[CODEX_MAX_HEADER_LEN];
    struct curl_slist *headers = NULL;

    const char *token = codex_auth_get_access_token();
    if (token) {
        snprintf(header_buf, sizeof(header_buf), "Authorization: Bearer %s", token);
        headers = curl_slist_append(headers, header_buf);
    }

    const char *acct = codex_auth_get_account_id();
    if (acct) {
        snprintf(header_buf, sizeof(header_buf), "chatgpt-account-id: %s", acct);
        headers = curl_slist_append(headers, header_buf);
    }

    const char *orig = codex_get_originator();
    if (orig) {
        snprintf(header_buf, sizeof(header_buf), "User-Agent: %s", orig);
        headers = curl_slist_append(headers, header_buf);
    }

    headers = curl_slist_append(headers, "Content-Type: application/json");

    /* HTTP GET */
    curl_buf_t resp = {0};
    resp.data = malloc(4096);
    resp.cap = resp.data ? 4096 : 0;
    if (resp.data) resp.data[0] = '\0';

    CURL *curl = curl_easy_init();
    if (!curl) {
        free(resp.data);
        curl_slist_free_all(headers);
        return CODEX_ERR_CURL;
    }

    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, quota_write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 15L);

    const char *ca = codex_get_ca_cert();
    if (ca) curl_easy_setopt(curl, CURLOPT_CAINFO, ca);

    CURLcode crc = curl_easy_perform(curl);
    long http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
    curl_easy_cleanup(curl);
    curl_slist_free_all(headers);

    if (crc != CURLE_OK || http_code != 200) {
        free(resp.data);
        return CODEX_ERR_HTTP;
    }

    /* Parse response */
    cJSON *json = cJSON_Parse(resp.data);
    free(resp.data);
    if (!json) return CODEX_ERR_STREAM_PARSE;

    /* plan_type */
    const cJSON *pt = cJSON_GetObjectItemCaseSensitive(json, "plan_type");
    if (cJSON_IsString(pt))
        out->plan_type = parse_plan(pt->valuestring);

    /* rate_limit */
    const cJSON *rl = cJSON_GetObjectItemCaseSensitive(json, "rate_limit");
    if (rl) {
        const cJSON *pw = cJSON_GetObjectItemCaseSensitive(rl, "primary_window");
        parse_window(pw, &out->primary_used_pct, &out->primary_window_sec,
                     &out->primary_reset_at);

        const cJSON *sw = cJSON_GetObjectItemCaseSensitive(rl, "secondary_window");
        parse_window(sw, &out->secondary_used_pct, &out->secondary_window_sec,
                     &out->secondary_reset_at);
    }

    /* credits */
    const cJSON *cr = cJSON_GetObjectItemCaseSensitive(json, "credits");
    if (cr) {
        const cJSON *f;
        f = cJSON_GetObjectItemCaseSensitive(cr, "has_credits");
        out->has_credits = cJSON_IsTrue(f) ? 1 : 0;
        f = cJSON_GetObjectItemCaseSensitive(cr, "unlimited");
        out->unlimited = cJSON_IsTrue(f) ? 1 : 0;
        f = cJSON_GetObjectItemCaseSensitive(cr, "balance");
        if (cJSON_IsString(f))
            out->credit_balance = atof(f->valuestring);
        else if (cJSON_IsNumber(f))
            out->credit_balance = f->valuedouble;
    }

    cJSON_Delete(json);
    return CODEX_OK;
}
