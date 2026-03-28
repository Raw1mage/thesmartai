/*
 * stream.c — SSE (Server-Sent Events) parser
 *
 * Line-by-line state machine per SSE spec:
 *   - "event: {type}"  → store event name
 *   - "data: {json}"   → accumulate data (multi-line support)
 *   - empty line        → emit event (event_name + data)
 *   - ": comment"       → ignore (keepalive)
 *
 * Event dispatch to codex_event_t via callback.
 */

#include "codex_provider.h"
#include <cjson/cJSON.h>

#include <stdlib.h>
#include <string.h>

/* --------------------------------------------------------------------------
 * SSE parser state
 * ----------------------------------------------------------------------- */

typedef struct {
    /* Line buffer for incomplete lines */
    char  *line_buf;
    size_t line_len;
    size_t line_cap;

    /* Current event being assembled */
    char   event_name[256];
    char  *data_buf;
    size_t data_len;
    size_t data_cap;

    /* Callback */
    codex_event_cb cb;
    void          *ctx;

    /* Captured state */
    char  *response_id;
    char  *turn_state;
} sse_parser_t;

/* --------------------------------------------------------------------------
 * Internal: map item "type" string → codex_item_type_t
 * ----------------------------------------------------------------------- */

static codex_item_type_t parse_item_type(const char *type)
{
    if (!type) return CODEX_ITEM_OTHER;
    if (strcmp(type, "message") == 0)              return CODEX_ITEM_MESSAGE;
    if (strcmp(type, "reasoning") == 0)             return CODEX_ITEM_REASONING;
    if (strcmp(type, "function_call") == 0)         return CODEX_ITEM_FUNCTION_CALL;
    if (strcmp(type, "function_call_output") == 0)  return CODEX_ITEM_FUNCTION_CALL_OUTPUT;
    if (strcmp(type, "local_shell_call") == 0)      return CODEX_ITEM_LOCAL_SHELL_CALL;
    if (strcmp(type, "custom_tool_call") == 0)      return CODEX_ITEM_CUSTOM_TOOL_CALL;
    if (strcmp(type, "custom_tool_call_output") == 0) return CODEX_ITEM_CUSTOM_TOOL_OUTPUT;
    if (strcmp(type, "web_search_call") == 0)       return CODEX_ITEM_WEB_SEARCH_CALL;
    if (strcmp(type, "compaction") == 0)            return CODEX_ITEM_COMPACTION;
    return CODEX_ITEM_OTHER;
}

/* --------------------------------------------------------------------------
 * Internal: dispatch a complete SSE event
 * ----------------------------------------------------------------------- */

static void dispatch_event(sse_parser_t *p)
{
    if (!p->event_name[0] || !p->data_buf || !p->data_len) goto reset;

    codex_event_t ev;
    memset(&ev, 0, sizeof(ev));

    /* --- response.created --- */
    if (strcmp(p->event_name, "response.created") == 0) {
        ev.type = CODEX_EVENT_CREATED;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *resp = cJSON_GetObjectItemCaseSensitive(json, "response");
            if (resp) {
                const cJSON *id = cJSON_GetObjectItemCaseSensitive(resp, "id");
                if (cJSON_IsString(id)) {
                    free(p->response_id);
                    p->response_id = strdup(id->valuestring);
                    ev.response_id = p->response_id;
                }
            }
            cJSON_Delete(json);
        }
        if (p->cb) p->cb(p->ctx, &ev);
    }
    /* --- response.output_item.done --- */
    else if (strcmp(p->event_name, "response.output_item.done") == 0) {
        ev.type = CODEX_EVENT_ITEM_DONE;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *item = cJSON_GetObjectItemCaseSensitive(json, "item");
            if (item) {
                const cJSON *type_f = cJSON_GetObjectItemCaseSensitive(item, "type");
                ev.item_type = parse_item_type(
                    cJSON_IsString(type_f) ? type_f->valuestring : NULL);
                char *item_str = cJSON_PrintUnformatted(item);
                ev.item_json = item_str;
                ev.item_json_len = item_str ? strlen(item_str) : 0;
                if (p->cb) p->cb(p->ctx, &ev);
                free(item_str);
            }
            cJSON_Delete(json);
        }
    }
    /* --- response.output_item.added --- */
    else if (strcmp(p->event_name, "response.output_item.added") == 0) {
        ev.type = CODEX_EVENT_ITEM_ADDED;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *item = cJSON_GetObjectItemCaseSensitive(json, "item");
            if (item) {
                const cJSON *type_f = cJSON_GetObjectItemCaseSensitive(item, "type");
                ev.item_type = parse_item_type(
                    cJSON_IsString(type_f) ? type_f->valuestring : NULL);
                char *item_str = cJSON_PrintUnformatted(item);
                ev.item_json = item_str;
                ev.item_json_len = item_str ? strlen(item_str) : 0;
                if (p->cb) p->cb(p->ctx, &ev);
                free(item_str);
            }
            cJSON_Delete(json);
        }
    }
    /* --- response.output_text.delta --- */
    else if (strcmp(p->event_name, "response.output_text.delta") == 0) {
        ev.type = CODEX_EVENT_TEXT_DELTA;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *delta = cJSON_GetObjectItemCaseSensitive(json, "delta");
            if (cJSON_IsString(delta)) {
                ev.delta = delta->valuestring;
                ev.delta_len = strlen(delta->valuestring);
                if (p->cb) p->cb(p->ctx, &ev);
            }
            cJSON_Delete(json);
        }
    }
    /* --- response.reasoning_summary_text.delta --- */
    else if (strcmp(p->event_name, "response.reasoning_summary_text.delta") == 0) {
        ev.type = CODEX_EVENT_REASONING_SUMMARY_DELTA;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *delta = cJSON_GetObjectItemCaseSensitive(json, "delta");
            const cJSON *si = cJSON_GetObjectItemCaseSensitive(json, "summary_index");
            if (cJSON_IsString(delta)) {
                ev.delta = delta->valuestring;
                ev.delta_len = strlen(delta->valuestring);
                ev.summary_index = cJSON_IsNumber(si) ? (int64_t)si->valuedouble : 0;
                if (p->cb) p->cb(p->ctx, &ev);
            }
            cJSON_Delete(json);
        }
    }
    /* --- response.reasoning_text.delta --- */
    else if (strcmp(p->event_name, "response.reasoning_text.delta") == 0) {
        ev.type = CODEX_EVENT_REASONING_DELTA;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *delta = cJSON_GetObjectItemCaseSensitive(json, "delta");
            const cJSON *ci = cJSON_GetObjectItemCaseSensitive(json, "content_index");
            if (cJSON_IsString(delta)) {
                ev.delta = delta->valuestring;
                ev.delta_len = strlen(delta->valuestring);
                ev.content_index = cJSON_IsNumber(ci) ? (int64_t)ci->valuedouble : 0;
                if (p->cb) p->cb(p->ctx, &ev);
            }
            cJSON_Delete(json);
        }
    }
    /* --- response.completed --- */
    else if (strcmp(p->event_name, "response.completed") == 0) {
        ev.type = CODEX_EVENT_COMPLETED;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *resp = cJSON_GetObjectItemCaseSensitive(json, "response");
            if (resp) {
                const cJSON *id = cJSON_GetObjectItemCaseSensitive(resp, "id");
                if (cJSON_IsString(id)) {
                    free(p->response_id);
                    p->response_id = strdup(id->valuestring);
                    ev.response_id = p->response_id;
                }
                /* Token usage */
                const cJSON *usage = cJSON_GetObjectItemCaseSensitive(resp, "usage");
                if (usage) {
                    const cJSON *f;
                    f = cJSON_GetObjectItemCaseSensitive(usage, "input_tokens");
                    ev.usage.input_tokens = cJSON_IsNumber(f) ? (int64_t)f->valuedouble : 0;
                    f = cJSON_GetObjectItemCaseSensitive(usage, "cached_input_tokens");
                    if (!cJSON_IsNumber(f)) {
                        const cJSON *det = cJSON_GetObjectItemCaseSensitive(usage, "input_tokens_details");
                        if (det) f = cJSON_GetObjectItemCaseSensitive(det, "cached_tokens");
                    }
                    ev.usage.cached_input_tokens = cJSON_IsNumber(f) ? (int64_t)f->valuedouble : 0;
                    f = cJSON_GetObjectItemCaseSensitive(usage, "output_tokens");
                    ev.usage.output_tokens = cJSON_IsNumber(f) ? (int64_t)f->valuedouble : 0;
                    f = cJSON_GetObjectItemCaseSensitive(usage, "reasoning_output_tokens");
                    if (!cJSON_IsNumber(f)) {
                        const cJSON *det = cJSON_GetObjectItemCaseSensitive(usage, "output_tokens_details");
                        if (det) f = cJSON_GetObjectItemCaseSensitive(det, "reasoning_tokens");
                    }
                    ev.usage.reasoning_output_tokens = cJSON_IsNumber(f) ? (int64_t)f->valuedouble : 0;
                    f = cJSON_GetObjectItemCaseSensitive(usage, "total_tokens");
                    ev.usage.total_tokens = cJSON_IsNumber(f) ? (int64_t)f->valuedouble :
                        (ev.usage.input_tokens + ev.usage.output_tokens);
                }
            }
            cJSON_Delete(json);
        }
        if (p->cb) p->cb(p->ctx, &ev);
    }
    /* --- response.failed --- */
    else if (strcmp(p->event_name, "response.failed") == 0) {
        ev.type = CODEX_EVENT_FAILED;
        cJSON *json = cJSON_Parse(p->data_buf);
        if (json) {
            const cJSON *resp = cJSON_GetObjectItemCaseSensitive(json, "response");
            if (resp) {
                const cJSON *err = cJSON_GetObjectItemCaseSensitive(resp, "error");
                if (err) {
                    const cJSON *code = cJSON_GetObjectItemCaseSensitive(err, "code");
                    const cJSON *msg  = cJSON_GetObjectItemCaseSensitive(err, "message");
                    const cJSON *type = cJSON_GetObjectItemCaseSensitive(err, "type");
                    const cJSON *ra   = cJSON_GetObjectItemCaseSensitive(err, "resets_at");

                    ev.error_message = cJSON_IsString(msg) ? msg->valuestring : NULL;
                    ev.error_type    = cJSON_IsString(type) ? type->valuestring : NULL;
                    ev.resets_at     = cJSON_IsNumber(ra) ? (int64_t)ra->valuedouble : 0;

                    /* Map error code */
                    if (cJSON_IsString(code)) {
                        const char *c = code->valuestring;
                        if (strcmp(c, "context_length_exceeded") == 0)
                            ev.error_code = CODEX_ERR_CONTEXT_LENGTH;
                        else if (strcmp(c, "insufficient_quota") == 0)
                            ev.error_code = CODEX_ERR_QUOTA_EXCEEDED;
                        else if (strcmp(c, "usage_not_included") == 0)
                            ev.error_code = CODEX_ERR_USAGE_NOT_INCLUDED;
                        else if (strcmp(c, "invalid_prompt") == 0)
                            ev.error_code = CODEX_ERR_INVALID_REQUEST;
                        else if (strcmp(c, "server_is_overloaded") == 0 ||
                                 strcmp(c, "slow_down") == 0)
                            ev.error_code = CODEX_ERR_SERVER_OVERLOADED;
                        else if (strcmp(c, "rate_limit_exceeded") == 0)
                            ev.error_code = CODEX_ERR_RATE_LIMIT;
                        else
                            ev.error_code = CODEX_ERR_SERVER_ERROR;
                    }
                }
            }
            if (p->cb) p->cb(p->ctx, &ev);
            cJSON_Delete(json);
        }
    }
    /* --- response.incomplete --- */
    else if (strcmp(p->event_name, "response.incomplete") == 0) {
        ev.type = CODEX_EVENT_INCOMPLETE;
        if (p->cb) p->cb(p->ctx, &ev);
    }

reset:
    p->event_name[0] = '\0';
    p->data_len = 0;
    if (p->data_buf) p->data_buf[0] = '\0';
}

/* --------------------------------------------------------------------------
 * Internal: process one complete line
 * ----------------------------------------------------------------------- */

static void process_line(sse_parser_t *p, const char *line, size_t len)
{
    /* Empty line → emit */
    if (len == 0) {
        dispatch_event(p);
        return;
    }

    /* Comment line (starts with ':') → ignore */
    if (line[0] == ':') return;

    /* "event: {type}" */
    if (len > 7 && strncmp(line, "event: ", 7) == 0) {
        size_t name_len = len - 7;
        if (name_len >= sizeof(p->event_name))
            name_len = sizeof(p->event_name) - 1;
        memcpy(p->event_name, line + 7, name_len);
        p->event_name[name_len] = '\0';
        return;
    }

    /* "data: {json}" — may be multi-line */
    if (len > 6 && strncmp(line, "data: ", 6) == 0) {
        const char *data = line + 6;
        size_t data_len = len - 6;

        /* Grow data buffer */
        size_t needed = p->data_len + data_len + 2;
        if (needed > p->data_cap) {
            size_t newcap = needed * 2;
            char *nb = realloc(p->data_buf, newcap);
            if (!nb) return;
            p->data_buf = nb;
            p->data_cap = newcap;
        }

        if (p->data_len > 0) {
            p->data_buf[p->data_len++] = '\n';
        }
        memcpy(p->data_buf + p->data_len, data, data_len);
        p->data_len += data_len;
        p->data_buf[p->data_len] = '\0';
        return;
    }
}

/* --------------------------------------------------------------------------
 * Public: create/destroy/feed SSE parser
 * ----------------------------------------------------------------------- */

sse_parser_t *codex_sse_parser_create(codex_event_cb cb, void *ctx)
{
    sse_parser_t *p = calloc(1, sizeof(sse_parser_t));
    if (!p) return NULL;

    p->line_cap = 4096;
    p->line_buf = malloc(p->line_cap);
    p->data_cap = 4096;
    p->data_buf = malloc(p->data_cap);
    p->cb = cb;
    p->ctx = ctx;

    if (!p->line_buf || !p->data_buf) {
        free(p->line_buf);
        free(p->data_buf);
        free(p);
        return NULL;
    }

    p->line_buf[0] = '\0';
    p->data_buf[0] = '\0';
    return p;
}

void codex_sse_parser_destroy(sse_parser_t *p)
{
    if (!p) return;
    free(p->line_buf);
    free(p->data_buf);
    free(p->response_id);
    free(p->turn_state);
    free(p);
}

/**
 * Feed raw bytes from HTTP response into the SSE parser.
 * Called by libcurl WRITEFUNCTION.
 */
void codex_sse_parser_feed(sse_parser_t *p, const char *data, size_t len)
{
    if (!p || !data) return;

    for (size_t i = 0; i < len; i++) {
        char c = data[i];

        if (c == '\n') {
            /* Complete line */
            /* Strip trailing \r */
            if (p->line_len > 0 && p->line_buf[p->line_len - 1] == '\r')
                p->line_len--;
            p->line_buf[p->line_len] = '\0';
            process_line(p, p->line_buf, p->line_len);
            p->line_len = 0;
        } else {
            /* Grow line buffer if needed */
            if (p->line_len + 1 >= p->line_cap) {
                p->line_cap *= 2;
                char *nb = realloc(p->line_buf, p->line_cap);
                if (!nb) return;
                p->line_buf = nb;
            }
            p->line_buf[p->line_len++] = c;
        }
    }
}

/**
 * Flush any pending event (e.g. at stream end).
 */
void codex_sse_parser_flush(sse_parser_t *p)
{
    if (!p) return;
    if (p->data_len > 0) {
        dispatch_event(p);
    }
}

/**
 * Get captured response_id (from last completed event).
 */
const char *codex_sse_parser_get_response_id(const sse_parser_t *p)
{
    return p ? p->response_id : NULL;
}
