/*
 * transform.c — Request body transformation for Codex Responses API
 *
 * Transformations (per codex_a4_protocol_ref.json):
 *   1. Extract system/developer messages → concatenate into "instructions"
 *   2. Strip max_output_tokens, max_tokens
 *   3. Strip "id" field from strippable item types
 *   4. Resolve endpoint URL (ChatGPT vs OpenAI)
 */

#include "codex_provider.h"
#include <cjson/cJSON.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* --------------------------------------------------------------------------
 * External accessors
 * ----------------------------------------------------------------------- */

extern codex_auth_mode_t codex_auth_get_mode(void);
extern const char       *codex_get_base_url(void);

/* --------------------------------------------------------------------------
 * Item types whose "id" field should be stripped
 * ----------------------------------------------------------------------- */

static int is_strippable_type(const char *type)
{
    if (!type) return 0;
    return (strcmp(type, "message") == 0 ||
            strcmp(type, "reasoning") == 0 ||
            strcmp(type, "function_call") == 0 ||
            strcmp(type, "local_shell_call") == 0 ||
            strcmp(type, "custom_tool_call") == 0 ||
            strcmp(type, "web_search_call") == 0 ||
            strcmp(type, "tool_search_call") == 0 ||
            strcmp(type, "image_generation_call") == 0);
}

/* --------------------------------------------------------------------------
 * codex_transform_request
 *
 * Takes a cJSON request object (in-place mutation):
 *   1. Moves system/developer messages from "input" → "instructions"
 *   2. Strips forbidden keys
 *   3. Strips item IDs
 *
 * Returns CODEX_OK or error.
 * ----------------------------------------------------------------------- */

int codex_transform_request(cJSON *request)
{
    if (!request) return CODEX_ERR_INVALID_ARG;

    cJSON *input = cJSON_GetObjectItemCaseSensitive(request, "input");

    /* --- Step 1: Extract system/developer messages → instructions --- */
    if (cJSON_IsArray(input)) {
        /* Build instructions buffer */
        size_t instr_cap = 4096;
        char *instr_buf = malloc(instr_cap);
        if (!instr_buf) return CODEX_ERR_OOM;
        instr_buf[0] = '\0';
        size_t instr_len = 0;

        /* Collect indices of system/developer messages to remove */
        int remove_indices[256];
        int remove_count = 0;

        int idx = 0;
        cJSON *item = NULL;
        cJSON_ArrayForEach(item, input) {
            const cJSON *type_field = cJSON_GetObjectItemCaseSensitive(item, "type");
            if (!cJSON_IsString(type_field) ||
                strcmp(type_field->valuestring, "message") != 0) {
                idx++;
                continue;
            }

            const cJSON *role = cJSON_GetObjectItemCaseSensitive(item, "role");
            if (!cJSON_IsString(role) ||
                (strcmp(role->valuestring, "system") != 0 &&
                 strcmp(role->valuestring, "developer") != 0)) {
                idx++;
                continue;
            }

            /* Extract text content */
            const cJSON *content = cJSON_GetObjectItemCaseSensitive(item, "content");
            if (cJSON_IsArray(content)) {
                cJSON *ci = NULL;
                cJSON_ArrayForEach(ci, content) {
                    const cJSON *ct = cJSON_GetObjectItemCaseSensitive(ci, "type");
                    const cJSON *txt = cJSON_GetObjectItemCaseSensitive(ci, "text");
                    if (cJSON_IsString(txt) &&
                        cJSON_IsString(ct) &&
                        (strcmp(ct->valuestring, "input_text") == 0 ||
                         strcmp(ct->valuestring, "output_text") == 0)) {
                        size_t tl = strlen(txt->valuestring);
                        /* Grow buffer if needed */
                        while (instr_len + tl + 2 > instr_cap) {
                            instr_cap *= 2;
                            char *nb = realloc(instr_buf, instr_cap);
                            if (!nb) { free(instr_buf); return CODEX_ERR_OOM; }
                            instr_buf = nb;
                        }
                        if (instr_len > 0) {
                            instr_buf[instr_len++] = '\n';
                        }
                        memcpy(instr_buf + instr_len, txt->valuestring, tl);
                        instr_len += tl;
                        instr_buf[instr_len] = '\0';
                    }
                }
            }

            if (remove_count < 256)
                remove_indices[remove_count++] = idx;
            idx++;
        }

        /* Remove extracted messages from input (reverse order to keep indices valid) */
        for (int i = remove_count - 1; i >= 0; i--) {
            cJSON_DeleteItemFromArray(input, remove_indices[i]);
        }

        /* Set instructions field */
        cJSON_DeleteItemFromObjectCaseSensitive(request, "instructions");
        cJSON_AddStringToObject(request, "instructions", instr_buf);
        free(instr_buf);
    }

    /* If no instructions field was set, ensure empty string */
    if (!cJSON_GetObjectItemCaseSensitive(request, "instructions")) {
        cJSON_AddStringToObject(request, "instructions", "");
    }

    /* --- Step 2: Strip forbidden parameters --- */
    cJSON_DeleteItemFromObjectCaseSensitive(request, "max_output_tokens");
    cJSON_DeleteItemFromObjectCaseSensitive(request, "max_tokens");

    /* --- Step 3: Strip "id" field from strippable items --- */
    if (cJSON_IsArray(input)) {
        cJSON *item = NULL;
        cJSON_ArrayForEach(item, input) {
            const cJSON *type_field = cJSON_GetObjectItemCaseSensitive(item, "type");
            if (cJSON_IsString(type_field) &&
                is_strippable_type(type_field->valuestring)) {
                cJSON_DeleteItemFromObjectCaseSensitive(item, "id");
            }
        }
    }

    return CODEX_OK;
}

/* --------------------------------------------------------------------------
 * codex_resolve_endpoint_url
 *
 * Returns the Responses API endpoint URL based on auth mode.
 * Buffer must be at least CODEX_MAX_URL_LEN bytes.
 * ----------------------------------------------------------------------- */

int codex_resolve_endpoint_url(char *url_buf, size_t buf_len)
{
    if (!url_buf || buf_len < 64) return CODEX_ERR_INVALID_ARG;

    const char *base = codex_get_base_url();

    if (base && base[0]) {
        /* User-provided base URL */
        size_t len = strlen(base);
        /* Strip trailing slash */
        while (len > 0 && base[len - 1] == '/') len--;

        /* Auto-append /backend-api for chatgpt.com */
        if ((strncmp(base, "https://chatgpt.com", 19) == 0 ||
             strncmp(base, "https://chat.openai.com", 23) == 0) &&
            !strstr(base, "/backend-api")) {
            snprintf(url_buf, buf_len, "%.*s/backend-api/codex/responses",
                     (int)len, base);
        } else {
            snprintf(url_buf, buf_len, "%.*s/responses", (int)len, base);
        }
    } else if (codex_auth_get_mode() == CODEX_AUTH_CHATGPT) {
        snprintf(url_buf, buf_len,
                 "https://chatgpt.com/backend-api/codex/responses");
    } else {
        snprintf(url_buf, buf_len,
                 "https://api.openai.com/v1/responses");
    }

    return CODEX_OK;
}
