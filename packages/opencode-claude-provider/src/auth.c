#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <time.h>

#include "claude_provider.h"

#define CLAUDE_TOKEN_CAP 4096
#define CLAUDE_FIELD_CAP 512

int claude_storage_save_oauth(
    const char *refresh_token,
    const char *access_token,
    int64_t expires_epoch,
    const char *email,
    const char *org_id
);
int claude_storage_save_api_key(const char *api_key);

typedef struct {
    int initialized;
    claude_auth_mode_t mode;
    char refresh_token[CLAUDE_TOKEN_CAP];
    char access_token[CLAUDE_TOKEN_CAP];
    char api_key[CLAUDE_TOKEN_CAP];
    char email[CLAUDE_FIELD_CAP];
    char org_id[CLAUDE_FIELD_CAP];
    int64_t expires_epoch;
} claude_auth_state_t;

static claude_auth_state_t claude_auth_state = {0};

static void claude_copy_string(char *dest, size_t capacity, const char *src) {
    if (!dest || capacity == 0) {
        return;
    }

    if (!src) {
        dest[0] = '\0';
        return;
    }

    size_t length = strlen(src);
    if (length >= capacity) {
        length = capacity - 1;
    }
    memcpy(dest, src, length);
    dest[length] = '\0';
}

static int64_t claude_now_epoch_ms(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_REALTIME, &ts) != 0) {
        return 0;
    }
    return (int64_t)ts.tv_sec * 1000 + (int64_t)(ts.tv_nsec / 1000000);
}

void claude_auth_reset(void) {
    memset(&claude_auth_state, 0, sizeof(claude_auth_state));
}

void claude_auth_mark_initialized(void) {
    claude_auth_state.initialized = 1;
}

int claude_auth_set_oauth_tokens(
    const char *refresh_token,
    const char *access_token,
    int64_t expires_epoch,
    const char *email,
    const char *org_id
) {
    if (!claude_auth_state.initialized) {
        return CLAUDE_ERR_NOT_INITIALIZED;
    }
    if (!refresh_token || !refresh_token[0]) {
        return CLAUDE_ERR_INVALID_ARG;
    }

    claude_auth_state.mode = CLAUDE_AUTH_OAUTH;
    claude_copy_string(claude_auth_state.refresh_token, sizeof(claude_auth_state.refresh_token), refresh_token);
    claude_copy_string(claude_auth_state.access_token, sizeof(claude_auth_state.access_token), access_token);
    claude_auth_state.api_key[0] = '\0';
    claude_copy_string(claude_auth_state.email, sizeof(claude_auth_state.email), email);
    claude_copy_string(claude_auth_state.org_id, sizeof(claude_auth_state.org_id), org_id);
    claude_auth_state.expires_epoch = expires_epoch;

    return claude_storage_save_oauth(
        claude_auth_state.refresh_token,
        claude_auth_state.access_token,
        claude_auth_state.expires_epoch,
        claude_auth_state.email,
        claude_auth_state.org_id
    );
}

int claude_auth_set_api_key(const char *api_key) {
    if (!claude_auth_state.initialized) {
        return CLAUDE_ERR_NOT_INITIALIZED;
    }
    if (!api_key || !api_key[0]) {
        return CLAUDE_ERR_INVALID_ARG;
    }

    claude_auth_state.mode = CLAUDE_AUTH_API_KEY;
    claude_copy_string(claude_auth_state.api_key, sizeof(claude_auth_state.api_key), api_key);
    claude_auth_state.refresh_token[0] = '\0';
    claude_auth_state.access_token[0] = '\0';
    claude_auth_state.email[0] = '\0';
    claude_auth_state.org_id[0] = '\0';
    claude_auth_state.expires_epoch = 0;

    return claude_storage_save_api_key(claude_auth_state.api_key);
}

int claude_auth_get_status(claude_auth_status_t *status) {
    if (!claude_auth_state.initialized) {
        return CLAUDE_ERR_NOT_INITIALIZED;
    }
    if (!status) {
        return CLAUDE_ERR_INVALID_ARG;
    }

    int authenticated = 0;
    int stale = 0;
    const char *access_token = NULL;

    if (claude_auth_state.mode == CLAUDE_AUTH_OAUTH && claude_auth_state.refresh_token[0]) {
        authenticated = 1;
        access_token = claude_auth_state.access_token[0] ? claude_auth_state.access_token : NULL;
        if (claude_auth_state.expires_epoch > 0 && claude_auth_state.expires_epoch <= claude_now_epoch_ms()) {
            stale = 1;
        }
    }

    if (claude_auth_state.mode == CLAUDE_AUTH_API_KEY && claude_auth_state.api_key[0]) {
        authenticated = 1;
    }

    status->mode = (int32_t)claude_auth_state.mode;
    status->authenticated = authenticated;
    status->stale = stale;
    status->reserved = 0;
    status->email = claude_auth_state.email[0] ? claude_auth_state.email : NULL;
    status->org_id = claude_auth_state.org_id[0] ? claude_auth_state.org_id : NULL;
    status->access_token = access_token;
    status->expires_epoch = claude_auth_state.expires_epoch;
    return CLAUDE_OK;
}
