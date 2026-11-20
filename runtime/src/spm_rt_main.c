/*
 * spm_rt - SPM real-time runtime (skeleton, phase P0).
 *
 * Phase P2 adds: config / tags / program loading (cJSON), SimCard driver,
 * RT cycle thread, logger. Phase P3 adds the WebSocket server (civetweb)
 * that the studio connects to. Until then use studio/tools/mock-runtime.mjs.
 *
 * Unity build: later layers are added here as #include "base/base_inc.c" etc.
 */
#include <stdio.h>
#include <string.h>
#include "spm_rt.h"

int main(int argc, char **argv)
{
    if (argc > 1 && (strcmp(argv[1], "--version") == 0 || strcmp(argv[1], "-v") == 0)) {
        printf("spm_rt %s\n", SPM_RT_VERSION);
        return 0;
    }
    printf("spm_rt %s - skeleton (no real-time cycle yet)\n", SPM_RT_VERSION);
    printf("studio expects the runtime on ws://127.0.0.1:%d (use the mock runtime for now)\n", SPM_WS_PORT_DEFAULT);
    return 0;
}
