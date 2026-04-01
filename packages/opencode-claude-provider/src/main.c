#include <stdio.h>
#include <string.h>

#include "claude_provider.h"

int main(int argc, char **argv) {
    if (argc > 1 && strcmp(argv[1], "--version") == 0) {
        puts(CLAUDE_PROVIDER_VERSION);
        return 0;
    }

    if (claude_init(NULL) != CLAUDE_OK) {
        fputs("{\"type\":\"error\",\"message\":\"init failed\"}\n", stderr);
        return 1;
    }

    printf("{\"type\":\"ready\",\"abi\":%d,\"originator\":\"%s\"}\n", claude_abi_version(), claude_get_originator());
    claude_shutdown();
    return 0;
}
