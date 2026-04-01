#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#include "claude_provider.h"

static int claude_resolve_home(char *buffer, size_t capacity) {
    const char *override = getenv("CLAUDE_PROVIDER_HOME");
    if (override && override[0]) {
        if (snprintf(buffer, capacity, "%s", override) >= (int)capacity) {
            return CLAUDE_ERR_IO;
        }
        return CLAUDE_OK;
    }

    const char *home = getenv("HOME");
    if (!home || !home[0]) {
        return CLAUDE_ERR_IO;
    }
    if (snprintf(buffer, capacity, "%s/.claude-provider", home) >= (int)capacity) {
        return CLAUDE_ERR_IO;
    }
    return CLAUDE_OK;
}

static int claude_ensure_dir(const char *path) {
    if (mkdir(path, 0700) == 0 || errno == EEXIST) {
        return CLAUDE_OK;
    }
    return CLAUDE_ERR_IO;
}

static int claude_open_temp_file(const char *home_dir, char *temp_path, size_t capacity, FILE **file, int *fd) {
    if (snprintf(temp_path, capacity, "%s/auth.json.tmp.XXXXXX", home_dir) >= (int)capacity) {
        return CLAUDE_ERR_IO;
    }

    *fd = mkstemp(temp_path);
    if (*fd < 0) {
        return CLAUDE_ERR_IO;
    }
    if (fchmod(*fd, 0600) != 0) {
        close(*fd);
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }
    *file = fdopen(*fd, "w");
    if (!*file) {
        close(*fd);
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }
    return CLAUDE_OK;
}

static int claude_write_json_string(FILE *file, const char *value) {
    const unsigned char *cursor = (const unsigned char *)(value ? value : "");
    if (fputc('"', file) == EOF) {
        return CLAUDE_ERR_IO;
    }
    while (*cursor) {
        switch (*cursor) {
            case '\\':
                if (fputs("\\\\", file) == EOF) return CLAUDE_ERR_IO;
                break;
            case '"':
                if (fputs("\\\"", file) == EOF) return CLAUDE_ERR_IO;
                break;
            case '\n':
                if (fputs("\\n", file) == EOF) return CLAUDE_ERR_IO;
                break;
            case '\r':
                if (fputs("\\r", file) == EOF) return CLAUDE_ERR_IO;
                break;
            case '\t':
                if (fputs("\\t", file) == EOF) return CLAUDE_ERR_IO;
                break;
            default:
                if (*cursor < 0x20) {
                    if (fprintf(file, "\\u%04x", *cursor) < 0) return CLAUDE_ERR_IO;
                } else if (fputc(*cursor, file) == EOF) {
                    return CLAUDE_ERR_IO;
                }
                break;
        }
        cursor++;
    }
    if (fputc('"', file) == EOF) {
        return CLAUDE_ERR_IO;
    }
    return CLAUDE_OK;
}

static int claude_finalize_write(FILE *file, int fd, const char *temp_path, const char *target_path) {
    if (fflush(file) != 0) {
        fclose(file);
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }
    if (fsync(fd) != 0) {
        fclose(file);
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }
    if (fclose(file) != 0) {
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }
    if (rename(temp_path, target_path) != 0) {
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }
    return CLAUDE_OK;
}

int claude_storage_save_oauth(
    const char *refresh_token,
    const char *access_token,
    int64_t expires_epoch,
    const char *email,
    const char *org_id
) {
    char home_dir[PATH_MAX];
    char target_path[PATH_MAX];
    char temp_path[PATH_MAX];
    FILE *file = NULL;
    int fd = -1;

    if (claude_resolve_home(home_dir, sizeof(home_dir)) != CLAUDE_OK) {
        return CLAUDE_ERR_IO;
    }
    if (claude_ensure_dir(home_dir) != CLAUDE_OK) {
        return CLAUDE_ERR_IO;
    }
    if (snprintf(target_path, sizeof(target_path), "%s/auth.json", home_dir) >= (int)sizeof(target_path)) {
        return CLAUDE_ERR_IO;
    }
    if (claude_open_temp_file(home_dir, temp_path, sizeof(temp_path), &file, &fd) != CLAUDE_OK) {
        return CLAUDE_ERR_IO;
    }

    if (
        fputs("{\n  \"type\": \"oauth\",\n  \"refresh\": ", file) == EOF ||
        claude_write_json_string(file, refresh_token) != CLAUDE_OK ||
        fputs(",\n  \"access\": ", file) == EOF ||
        claude_write_json_string(file, access_token) != CLAUDE_OK ||
        fprintf(file, ",\n  \"expires\": %lld,\n  \"email\": ", (long long)expires_epoch) < 0 ||
        claude_write_json_string(file, email) != CLAUDE_OK ||
        fputs(",\n  \"orgID\": ", file) == EOF ||
        claude_write_json_string(file, org_id) != CLAUDE_OK ||
        fputs("\n}\n", file) == EOF
    ) {
        fclose(file);
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }

    return claude_finalize_write(file, fd, temp_path, target_path);
}

int claude_storage_save_api_key(const char *api_key) {
    char home_dir[PATH_MAX];
    char target_path[PATH_MAX];
    char temp_path[PATH_MAX];
    FILE *file = NULL;
    int fd = -1;

    if (claude_resolve_home(home_dir, sizeof(home_dir)) != CLAUDE_OK) {
        return CLAUDE_ERR_IO;
    }
    if (claude_ensure_dir(home_dir) != CLAUDE_OK) {
        return CLAUDE_ERR_IO;
    }
    if (snprintf(target_path, sizeof(target_path), "%s/auth.json", home_dir) >= (int)sizeof(target_path)) {
        return CLAUDE_ERR_IO;
    }
    if (claude_open_temp_file(home_dir, temp_path, sizeof(temp_path), &file, &fd) != CLAUDE_OK) {
        return CLAUDE_ERR_IO;
    }

    if (
        fputs("{\n  \"type\": \"api_key\",\n  \"key\": ", file) == EOF ||
        claude_write_json_string(file, api_key) != CLAUDE_OK ||
        fputs("\n}\n", file) == EOF
    ) {
        fclose(file);
        unlink(temp_path);
        return CLAUDE_ERR_IO;
    }

    return claude_finalize_write(file, fd, temp_path, target_path);
}
