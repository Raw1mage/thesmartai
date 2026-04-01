#include <stdio.h>

const char *claude_originator(const char *version) {
    static char buffer[64];
    const char *effective = version ? version : "0.1.0";
    snprintf(buffer, sizeof(buffer), "claude-provider/%s", effective);
    return buffer;
}
