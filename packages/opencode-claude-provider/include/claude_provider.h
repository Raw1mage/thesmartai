#ifndef CLAUDE_PROVIDER_H
#define CLAUDE_PROVIDER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#ifdef _WIN32
#define CLAUDE_EXPORT __declspec(dllexport)
#else
#define CLAUDE_EXPORT __attribute__((visibility("default")))
#endif

#define CLAUDE_PROVIDER_ABI_VERSION 1
#define CLAUDE_PROVIDER_VERSION "0.1.0"

typedef enum {
    CLAUDE_OK = 0,
    CLAUDE_ERR_INVALID_ARG = -1,
    CLAUDE_ERR_NOT_INITIALIZED = -2,
    CLAUDE_ERR_ALREADY_INITIALIZED = -3,
    CLAUDE_ERR_IO = -4,
} claude_error_t;

typedef enum {
    CLAUDE_AUTH_NONE = 0,
    CLAUDE_AUTH_OAUTH = 1,
    CLAUDE_AUTH_API_KEY = 2,
} claude_auth_mode_t;

typedef struct {
    const char *claude_home;
    const char *issuer_url;
    const char *client_id;
    const char *ca_cert_path;
    const char *version;
    uint32_t max_retries;
    uint32_t stream_idle_timeout_ms;
} claude_config_t;

typedef struct {
    int32_t mode;
    int32_t authenticated;
    int32_t stale;
    int32_t reserved;
    const char *email;
    const char *org_id;
    const char *access_token;
    int64_t expires_epoch;
} claude_auth_status_t;

CLAUDE_EXPORT int claude_init(const claude_config_t *config);
CLAUDE_EXPORT void claude_shutdown(void);
CLAUDE_EXPORT int claude_abi_version(void);
CLAUDE_EXPORT const char *claude_get_originator(void);
CLAUDE_EXPORT int claude_set_oauth_tokens(
    const char *refresh_token,
    const char *access_token,
    int64_t expires_epoch,
    const char *email,
    const char *org_id
);
CLAUDE_EXPORT int claude_set_api_key(const char *api_key);
CLAUDE_EXPORT int claude_get_auth_status(claude_auth_status_t *status);
CLAUDE_EXPORT const char *claude_strerror(claude_error_t err);

#ifdef __cplusplus
}
#endif

#endif
