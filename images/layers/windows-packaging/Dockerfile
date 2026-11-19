# syntax=docker/dockerfile:1
# Layer windows-packaging (runners R5.50, R5.42, R5.52): dotnet 8, wine, xvfb,
# xauth, msitools. About 1 GB. The Wine prefix is not made here; the agent
# makes one per runner on first use (R5.52) and sets WINEPREFIX and
# POOL_WINE_PREFIX; TMPDIR stays unset for every Wine tool.
#   docker build --build-arg BASE_IMAGE=crsp-linux-base:ci -t crsp-layer-windows-packaging images/layers/windows-packaging
ARG BASE_IMAGE=crsp-linux-base:ci
FROM ${BASE_IMAGE}

# Versions are pinned by line (open question 32 of the runners spec): the
# distribution archive is signed and apt checks its SHA-256 index, and the
# self-check below fails the build when a line moves.
ARG DOTNET_SDK_LINE=8.0
ARG WINE_LINE=9.0

USER root
ENV DEBIAN_FRONTEND=noninteractive
# apt retries and timeouts: a slow or flaky mirror retries instead of hanging
# for the whole job (OPS41). The base image has it; written again so the layer holds without it.
RUN printf '%s\n' 'Acquire::Retries "5";' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' \
      > /etc/apt/apt.conf.d/80-crsp-retries

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      dotnet-sdk-8.0 wine wine64 xvfb xauth msitools \
 && rm -rf /var/lib/apt/lists/*

# Wine breaks when TMPDIR is set, and no prefix is shared between runners.
ENV WINEDEBUG=-all
RUN test -z "${TMPDIR:-}"

# Self-check: every tool runs, or the build fails (runners R5.50).
RUN dotnet --version && wine --version && xvfb-run --help >/dev/null \
 && command -v xauth >/dev/null && command -v msiinfo >/dev/null \
 && dotnet --version | grep -q "^${DOTNET_SDK_LINE}\." \
 && wine --version | grep -q "^wine-${WINE_LINE}"

USER runner
