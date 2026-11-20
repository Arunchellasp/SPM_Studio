# Dev container for SPM_Studio (GitHub Codespaces or VS Code Dev Containers)
FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

# C runtime toolchain + libraries Electron needs on Linux
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
       cmake build-essential gdb clangd cppcheck \
       libgtk-3-0 libnss3 libasound2 libgbm1 libxss1 libxtst6 libxshmfence1 \
       libatk-bridge2.0-0 libdrm2 libxkbcommon0 libsecret-1-0 libnotify4 xdg-utils \
       fonts-noto-core \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
