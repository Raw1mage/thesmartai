/*
 * codex_provider.h — Codex Provider C Plugin FFI ABI Contract
 *
 * This header defines the complete interface between the opencode host
 * (Bun FFI) and the libcodex_provider shared library (.so / .dylib).
 *
 * Wire protocol reference:
 *   plans/codex-auth-plugin/diagrams/codex_a4_protocol_ref.json
 *
 * C11 standard. No C++ or host-specific dependencies.
 */

#ifndef CODEX_PROVIDER_H
#define CODEX_PROVIDER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --------------------------------------------------------------------------
 * Visibility macro
 * ----------------------------------------------------------------------- */

#ifdef _WIN32
  #define CODEX_EXPORT __declspec(dllexport)
#else
  #define CODEX_EXPORT __attribute__((visibility("default")))
#endif

/* --------------------------------------------------------------------------
 * Version
 * ----------------------------------------------------------------------- */

#define CODEX_PROVIDER_ABI_VERSION 1
#define CODEX_PROVIDER_VERSION     "0.1.0"

/* --------------------------------------------------------------------------
 * Limits
 * ----------------------------------------------------------------------- */

#define CODEX_MAX_MODELS           8
#define CODEX_MAX_TOOLS          128
#define CODEX_MAX_HEADER_LEN    4096
#define CODEX_MAX_URL_LEN       2048
#define CODEX_MAX_TOKEN_LEN    65536

/* --------------------------------------------------------------------------
 * Error codes
 * ----------------------------------------------------------------------- */

typedef enum {
    CODEX_OK                        =  0,
    CODEX_ERR_INVALID_ARG           = -1,
    CODEX_ERR_NOT_INITIALIZED       = -2,
    CODEX_ERR_ALREADY_INITIALIZED   = -3,
    CODEX_ERR_OOM                   = -4,

    /* Auth errors */
    CODEX_ERR_AUTH_NO_CREDENTIALS   = -10,
    CODEX_ERR_AUTH_STATE_MISMATCH   = -11,
    CODEX_ERR_AUTH_WORKSPACE_MISMATCH = -12,
    CODEX_ERR_AUTH_TOKEN_EXCHANGE   = -13,
    CODEX_ERR_AUTH_DEVICE_TIMEOUT   = -14,
    CODEX_ERR_AUTH_DEVICE_EXPIRED   = -15,
    CODEX_ERR_AUTH_CORRUPT          = -16,
    CODEX_ERR_AUTH_ACCOUNT_MISMATCH = -17,

    /* Refresh errors */
    CODEX_ERR_REFRESH_EXPIRED       = -20,
    CODEX_ERR_REFRESH_EXHAUSTED     = -21,
    CODEX_ERR_REFRESH_REVOKED       = -22,
    CODEX_ERR_REFRESH_TRANSIENT     = -23,

    /* Transport errors */
    CODEX_ERR_HTTP                  = -30,
    CODEX_ERR_CURL                  = -31,
    CODEX_ERR_SSL                   = -32,
    CODEX_ERR_TIMEOUT               = -33,
    CODEX_ERR_CONNECTION            = -34,

    /* API errors */
    CODEX_ERR_UNAUTHORIZED          = -40,
    CODEX_ERR_RATE_LIMIT            = -41,
    CODEX_ERR_CONTEXT_LENGTH        = -42,
    CODEX_ERR_QUOTA_EXCEEDED        = -43,
    CODEX_ERR_USAGE_NOT_INCLUDED    = -44,
    CODEX_ERR_INVALID_REQUEST       = -45,
    CODEX_ERR_SERVER_OVERLOADED     = -46,
    CODEX_ERR_SERVER_ERROR          = -47,

    /* Storage errors */
    CODEX_ERR_STORAGE_READ          = -50,
    CODEX_ERR_STORAGE_WRITE         = -51,
    CODEX_ERR_KEYRING               = -52,

    /* Stream errors */
    CODEX_ERR_STREAM_PARSE          = -60,
    CODEX_ERR_STREAM_INCOMPLETE     = -61,
} codex_error_t;

/* --------------------------------------------------------------------------
 * Auth mode
 * ----------------------------------------------------------------------- */

typedef enum {
    CODEX_AUTH_NONE         = 0,
    CODEX_AUTH_CHATGPT      = 1,   /* Managed OAuth (browser / device code) */
    CODEX_AUTH_API_KEY      = 2,   /* Direct OPENAI_API_KEY */
    CODEX_AUTH_EXTERNAL     = 3,   /* External tokens supplied by host */
} codex_auth_mode_t;

/* --------------------------------------------------------------------------
 * Plan type (from JWT chatgpt_plan_type claim)
 * ----------------------------------------------------------------------- */

typedef enum {
    CODEX_PLAN_UNKNOWN      = 0,
    CODEX_PLAN_FREE         = 1,
    CODEX_PLAN_PLUS         = 2,
    CODEX_PLAN_PRO          = 3,
    CODEX_PLAN_TEAM         = 4,
    CODEX_PLAN_BUSINESS     = 5,
    CODEX_PLAN_ENTERPRISE   = 6,
    CODEX_PLAN_EDU          = 7,
} codex_plan_type_t;

/* --------------------------------------------------------------------------
 * Storage mode
 * ----------------------------------------------------------------------- */

typedef enum {
    CODEX_STORAGE_FILE      = 0,
    CODEX_STORAGE_KEYRING   = 1,
    CODEX_STORAGE_AUTO      = 2,
    CODEX_STORAGE_EPHEMERAL = 3,
} codex_storage_mode_t;

/* --------------------------------------------------------------------------
 * SSE / Response event types
 * ----------------------------------------------------------------------- */

typedef enum {
    CODEX_EVENT_CREATED                 = 0,
    CODEX_EVENT_ITEM_ADDED              = 1,
    CODEX_EVENT_ITEM_DONE               = 2,
    CODEX_EVENT_TEXT_DELTA               = 3,
    CODEX_EVENT_REASONING_SUMMARY_DELTA = 4,
    CODEX_EVENT_REASONING_DELTA         = 5,
    CODEX_EVENT_REASONING_PART_ADDED    = 6,
    CODEX_EVENT_COMPLETED               = 7,
    CODEX_EVENT_FAILED                  = 8,
    CODEX_EVENT_INCOMPLETE              = 9,
    CODEX_EVENT_RATE_LIMITS             = 10,
} codex_event_type_t;

/* --------------------------------------------------------------------------
 * Response item types (tag = "type" field in JSON)
 * ----------------------------------------------------------------------- */

typedef enum {
    CODEX_ITEM_MESSAGE              = 0,
    CODEX_ITEM_REASONING            = 1,
    CODEX_ITEM_FUNCTION_CALL        = 2,
    CODEX_ITEM_FUNCTION_CALL_OUTPUT = 3,
    CODEX_ITEM_LOCAL_SHELL_CALL     = 4,
    CODEX_ITEM_CUSTOM_TOOL_CALL     = 5,
    CODEX_ITEM_CUSTOM_TOOL_OUTPUT   = 6,
    CODEX_ITEM_WEB_SEARCH_CALL      = 7,
    CODEX_ITEM_COMPACTION           = 8,
    CODEX_ITEM_OTHER                = 99,
} codex_item_type_t;

/* --------------------------------------------------------------------------
 * Configuration (passed to codex_init)
 * ----------------------------------------------------------------------- */

typedef struct {
    /* Home directory for auth.json; NULL → default ~/.codex */
    const char         *codex_home;

    /* Storage backend */
    codex_storage_mode_t storage_mode;

    /* OAuth issuer URL; NULL → default https://auth.openai.com */
    const char         *issuer_url;

    /* OAuth client ID; NULL → default app_EMoamEEZ73f0CkXaXp7hrann */
    const char         *client_id;

    /* Forced workspace ID; NULL → no restriction */
    const char         *forced_workspace_id;

    /* Custom CA certificate path; NULL → system default */
    const char         *ca_cert_path;

    /* Refresh token URL override; NULL → {issuer}/oauth/token */
    const char         *refresh_token_url;

    /* Base URL override for API requests; NULL → auto (chatgpt or openai) */
    const char         *base_url;

    /* Plugin version string (shown in originator); NULL → CODEX_PROVIDER_VERSION */
    const char         *version;

    /* Residency requirement; NULL → none */
    const char         *residency;

    /* Callback server port for browser OAuth; 0 → default 1455 */
    uint16_t            callback_port;

    /* Max retries for transport errors; 0 → default 5 */
    uint32_t            max_retries;

    /* Stream idle timeout in milliseconds; 0 → default 300000 (5 min) */
    uint32_t            stream_idle_timeout_ms;
} codex_config_t;

/* --------------------------------------------------------------------------
 * Token usage (from response.completed event)
 * ----------------------------------------------------------------------- */

typedef struct {
    int64_t input_tokens;
    int64_t cached_input_tokens;
    int64_t output_tokens;
    int64_t reasoning_output_tokens;
    int64_t total_tokens;
} codex_token_usage_t;

/* --------------------------------------------------------------------------
 * Auth status (returned by codex_get_auth_status)
 * ----------------------------------------------------------------------- */

typedef struct {
    codex_auth_mode_t   mode;
    codex_plan_type_t   plan_type;
    int                 authenticated;     /* 1 = has valid token, 0 = not */
    int                 stale;             /* 1 = needs refresh, 0 = fresh */
    const char         *email;             /* nullable, from JWT */
    const char         *user_id;           /* nullable, from JWT */
    const char         *account_id;        /* nullable, from JWT */
    const char         *access_token;      /* nullable, opaque to host */
    int64_t             last_refresh_epoch; /* unix timestamp of last refresh */
} codex_auth_status_t;

/* --------------------------------------------------------------------------
 * JWT claims (parsed from id_token)
 * ----------------------------------------------------------------------- */

typedef struct {
    const char         *email;
    const char         *user_id;
    const char         *account_id;
    codex_plan_type_t   plan_type;
    const char         *raw_id_token;
} codex_jwt_claims_t;

/* --------------------------------------------------------------------------
 * Model definition
 * ----------------------------------------------------------------------- */

typedef struct {
    const char *id;          /* e.g. "gpt-5.2-codex" */
    const char *name;        /* e.g. "GPT-5.2 Codex" */
    const char *family;      /* "openai" */

    /* Capabilities */
    int  reasoning;          /* 1 = supports extended reasoning */
    int  toolcall;           /* 1 = supports tool/function calls */
    int  image_input;        /* 1 = accepts image inputs */

    /* Limits */
    int64_t context_window;  /* max context tokens */
    int64_t max_output;      /* max output tokens */

    /* Cost per 1M tokens (USD); 0.0 if included in subscription */
    double cost_input;
    double cost_output;
    double cost_reasoning;

    /* Status: "active", "beta", "deprecated" */
    const char *status;
} codex_model_t;

/* --------------------------------------------------------------------------
 * Response event (delivered via callback)
 * ----------------------------------------------------------------------- */

typedef struct {
    codex_event_type_t  type;

    /* response.created */
    const char         *response_id;       /* set on CREATED and COMPLETED */

    /* output_item.done / output_item.added */
    codex_item_type_t   item_type;
    const char         *item_json;         /* raw JSON string of the item */
    size_t              item_json_len;

    /* text deltas */
    const char         *delta;             /* text chunk */
    size_t              delta_len;

    /* reasoning deltas */
    int64_t             summary_index;     /* for REASONING_SUMMARY_DELTA */
    int64_t             content_index;     /* for REASONING_DELTA */

    /* completed */
    codex_token_usage_t usage;

    /* failed */
    codex_error_t       error_code;
    const char         *error_message;
    const char         *error_type;
    int64_t             resets_at;          /* epoch seconds, 0 if not set */
} codex_event_t;

/* --------------------------------------------------------------------------
 * Request (passed to codex_request)
 * ----------------------------------------------------------------------- */

typedef struct {
    /* Model ID */
    const char         *model;

    /* Conversation ID (UUID string for x-client-request-id header) */
    const char         *conversation_id;

    /* Request body: complete JSON string of the Responses API request.
     * The plugin will:
     *   - Extract and move system/developer messages → instructions
     *   - Strip max_output_tokens, max_tokens
     *   - Strip item id fields
     *   - Inject tools, reasoning, include, etc.
     * Host can also pass a pre-transformed body if preferred. */
    const char         *body_json;
    size_t              body_json_len;

    /* Turn state from previous response (nullable; for sticky routing) */
    const char         *turn_state;

    /* Beta features (nullable; comma-separated flags) */
    const char         *beta_features;

    /* Service tier: NULL → omit, "priority", "standard" */
    const char         *service_tier;

    /* Prompt cache key (nullable; typically conversation_id) */
    const char         *prompt_cache_key;

    /* Reasoning config (nullable) */
    const char         *reasoning_effort;  /* "low", "medium", "high" */
    const char         *reasoning_summary; /* "auto", "concise", "detailed" */
} codex_request_t;

/* --------------------------------------------------------------------------
 * Usage quota
 * ----------------------------------------------------------------------- */

typedef struct {
    codex_plan_type_t plan_type;

    /* Primary window (typically 5-hour rolling) */
    int     primary_used_pct;
    int     primary_window_sec;
    int64_t primary_reset_at;

    /* Secondary window (typically weekly) */
    int     secondary_used_pct;
    int     secondary_window_sec;
    int64_t secondary_reset_at;

    /* Credits */
    int     has_credits;
    int     unlimited;
    double  credit_balance;
} codex_quota_t;

/* --------------------------------------------------------------------------
 * Auth result (delivered via auth callback)
 * ----------------------------------------------------------------------- */

typedef struct {
    codex_error_t       error;             /* CODEX_OK on success */
    const char         *error_message;     /* human-readable, nullable */
    codex_auth_mode_t   mode;
    const char         *email;             /* nullable */
    const char         *account_id;        /* nullable */
    codex_plan_type_t   plan_type;
} codex_auth_result_t;

/* --------------------------------------------------------------------------
 * Device code prompt (delivered via auth callback for device code flow)
 * ----------------------------------------------------------------------- */

typedef struct {
    const char         *verification_url;  /* e.g. https://auth.openai.com/codex/device */
    const char         *user_code;         /* e.g. "ABC-123" */
    int                 expires_in_sec;    /* typically 900 (15 min) */
} codex_device_code_t;

/* --------------------------------------------------------------------------
 * Callback typedefs
 * ----------------------------------------------------------------------- */

/**
 * Event callback — called for each streaming event during codex_request().
 * @param ctx   Opaque context pointer (passed through from codex_request).
 * @param event Event data. Pointer valid only for duration of callback.
 */
typedef void (*codex_event_cb)(void *ctx, const codex_event_t *event);

/**
 * Auth callback — called when auth flow completes (success or failure).
 * For device code flow, called first with device_code (prompt to display),
 * then again with final auth result.
 * @param ctx    Opaque context pointer.
 * @param result Auth result. Pointer valid only for duration of callback.
 */
typedef void (*codex_auth_cb)(void *ctx, const codex_auth_result_t *result);

/**
 * Device code callback — called when device code is ready for display.
 * @param ctx   Opaque context pointer.
 * @param code  Device code info to display to user.
 */
typedef void (*codex_device_code_cb)(void *ctx, const codex_device_code_t *code);

/* --------------------------------------------------------------------------
 * Plugin lifecycle
 * ----------------------------------------------------------------------- */

/**
 * Initialize the plugin. Must be called before any other function.
 * Allocates global state, loads config, reads persisted auth.
 * @param config  Configuration. NULL → all defaults.
 * @return CODEX_OK or error code.
 */
CODEX_EXPORT int codex_init(const codex_config_t *config);

/**
 * Shut down the plugin. Flushes pending tokens, closes connections,
 * frees all allocated memory. After this call, codex_init() may be
 * called again.
 */
CODEX_EXPORT void codex_shutdown(void);

/**
 * Get the ABI version. Host should check this matches CODEX_PROVIDER_ABI_VERSION.
 */
CODEX_EXPORT int codex_abi_version(void);

/* --------------------------------------------------------------------------
 * Authentication
 * ----------------------------------------------------------------------- */

/**
 * Start browser-based OAuth PKCE login.
 * Blocks until OAuth callback is received or timeout.
 * Opens system browser to auth.openai.com.
 * @param cb   Called on completion (success or failure).
 * @param ctx  Opaque context for callback.
 * @return CODEX_OK if flow started, error if cannot start.
 */
CODEX_EXPORT int codex_login_browser(codex_auth_cb cb, void *ctx);

/**
 * Start device code login (headless environments).
 * Calls device_cb immediately with user code to display.
 * Then blocks polling until authorized or timeout (15 min).
 * Calls auth_cb on completion.
 * @param device_cb  Called with device code to display.
 * @param auth_cb    Called on completion.
 * @param ctx        Opaque context for both callbacks.
 * @return CODEX_OK if flow started, error if cannot start.
 */
CODEX_EXPORT int codex_login_device(codex_device_code_cb device_cb,
                                    codex_auth_cb auth_cb, void *ctx);

/**
 * Set API key directly (no OAuth flow needed).
 * @param api_key  OpenAI API key string (copied internally).
 * @return CODEX_OK or error.
 */
CODEX_EXPORT int codex_login_apikey(const char *api_key);

/**
 * Get current authentication status.
 * @param out  Filled with current auth state. Strings valid until next
 *             auth-mutating call or codex_shutdown().
 * @return CODEX_OK or CODEX_ERR_NOT_INITIALIZED.
 */
CODEX_EXPORT int codex_get_auth_status(codex_auth_status_t *out);

/**
 * Explicitly trigger token refresh (if stale).
 * Normally called automatically before requests.
 * @return CODEX_OK if fresh/refreshed, CODEX_ERR_REFRESH_* on failure.
 */
CODEX_EXPORT int codex_refresh_token(void);

/**
 * Log out: delete persisted credentials and clear in-memory state.
 * @return CODEX_OK or error.
 */
CODEX_EXPORT int codex_logout(void);

/* --------------------------------------------------------------------------
 * Model catalog
 * ----------------------------------------------------------------------- */

/**
 * Get available codex models.
 * @param models  Caller-provided array of at least CODEX_MAX_MODELS elements.
 * @param count   On return, set to number of models filled.
 * @return CODEX_OK or error.
 */
CODEX_EXPORT int codex_get_models(codex_model_t *models, int *count);

/* --------------------------------------------------------------------------
 * LLM request
 * ----------------------------------------------------------------------- */

/**
 * Send an LLM request and stream events via callback.
 * Blocks until response is complete, failed, or error.
 * Handles auth refresh and retry internally.
 * @param req   Request parameters.
 * @param cb    Called for each streaming event.
 * @param ctx   Opaque context for callback.
 * @return CODEX_OK on completed, error code on failure.
 */
CODEX_EXPORT int codex_request(const codex_request_t *req,
                               codex_event_cb cb, void *ctx);

/* --------------------------------------------------------------------------
 * Usage quota
 * ----------------------------------------------------------------------- */

/**
 * Fetch current usage quota from ChatGPT backend.
 * Only meaningful for CODEX_AUTH_CHATGPT mode.
 * @param out  Filled with quota data.
 * @return CODEX_OK or error.
 */
CODEX_EXPORT int codex_get_quota(codex_quota_t *out);

/* --------------------------------------------------------------------------
 * Utility
 * ----------------------------------------------------------------------- */

/**
 * Get the originator string (client identity for HTTP headers).
 * @return Static string, valid for lifetime of plugin. NULL if not initialized.
 */
CODEX_EXPORT const char *codex_get_originator(void);

/**
 * Get human-readable error message for an error code.
 * @param err  Error code.
 * @return Static string description.
 */
CODEX_EXPORT const char *codex_strerror(codex_error_t err);

#ifdef __cplusplus
}
#endif

#endif /* CODEX_PROVIDER_H */
