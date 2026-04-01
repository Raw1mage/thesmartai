#include "claude_provider.h"

const char *claude_originator(const char *version);

void claude_auth_reset(void);
void claude_auth_mark_initialized(void);
int claude_auth_set_oauth_tokens(
    const char *refresh_token,
    const char *access_token,
    int64_t expires_epoch,
    const char *email,
    const char *org_id
);
int claude_auth_set_api_key(const char *api_key);
int claude_auth_get_status(claude_auth_status_t *status);

static int claude_initialized = 0;
static const char *claude_version = CLAUDE_PROVIDER_VERSION;

int claude_init(const claude_config_t *config) {
    if (claude_initialized) return CLAUDE_ERR_ALREADY_INITIALIZED;
    if (config && config->version && config->version[0]) claude_version = config->version;
    claude_initialized = 1;
    claude_auth_reset();
    claude_auth_mark_initialized();
    return CLAUDE_OK;
}

void claude_shutdown(void) {
    claude_auth_reset();
    claude_initialized = 0;
    claude_version = CLAUDE_PROVIDER_VERSION;
}

int claude_abi_version(void) {
    return CLAUDE_PROVIDER_ABI_VERSION;
}

const char *claude_get_originator(void) {
    return claude_originator(claude_version);
}

int claude_set_oauth_tokens(
    const char *refresh_token,
    const char *access_token,
    int64_t expires_epoch,
    const char *email,
    const char *org_id
) {
    if (!claude_initialized) return CLAUDE_ERR_NOT_INITIALIZED;
    return claude_auth_set_oauth_tokens(refresh_token, access_token, expires_epoch, email, org_id);
}

int claude_set_api_key(const char *api_key) {
    if (!claude_initialized) return CLAUDE_ERR_NOT_INITIALIZED;
    return claude_auth_set_api_key(api_key);
}

int claude_get_auth_status(claude_auth_status_t *status) {
    if (!claude_initialized) return CLAUDE_ERR_NOT_INITIALIZED;
    return claude_auth_get_status(status);
}

const char *claude_strerror(claude_error_t err) {
    switch (err) {
        case CLAUDE_OK:
            return "ok";
        case CLAUDE_ERR_INVALID_ARG:
            return "invalid argument";
        case CLAUDE_ERR_NOT_INITIALIZED:
            return "not initialized";
        case CLAUDE_ERR_ALREADY_INITIALIZED:
            return "already initialized";
        case CLAUDE_ERR_IO:
            return "io error";
        default:
            return "unknown error";
    }
}
