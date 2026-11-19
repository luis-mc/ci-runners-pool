# syntax=docker/dockerfile:1
# Layer llvm (runners R5.43, R5.50): a pinned LLVM with clang-cl, lld-link and
# llvm-lib on PATH, so cargo-xwin builds Windows targets. The download is
# SHA-256 checked; a wrong hash fails the build (R5.37 rule). Both amd64 and
# arm64 are pinned; the version and both hashes equal the `llvm` entry of
# scripts/delivery/tools.json (a test keeps them equal).
#   docker build --build-arg BASE_IMAGE=crsp-linux-base:ci -t crsp-layer-llvm images/layers/llvm
#   docker buildx build --platform linux/arm64 --build-arg TARGETARCH=arm64 ...
ARG BASE_IMAGE=crsp-linux-base:ci
FROM ${BASE_IMAGE}

ARG TARGETARCH=amd64
ARG LLVM_VERSION=20.1.8
ARG LLVM_SHA256_AMD64=1ead36b3dfcb774b57be530df42bec70ab2d239fbce9889447c7a29a4ddc1ae6
ARG LLVM_SHA256_ARM64=b855cc17d935fdd83da82206b7a7cfc680095efd1e9e8182c4a05e761958bef8

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
# apt retries and timeouts: a slow or flaky mirror retries instead of hanging
# for the whole job (OPS41). The base image has it; written again so the layer holds without it.
RUN printf '%s\n' 'Acquire::Retries "5";' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' \
      > /etc/apt/apt.conf.d/80-crsp-retries

# The tools link libxml2 (libicu is in the base image).
RUN apt-get update \
 && apt-get install -y --no-install-recommends libxml2 \
 && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    case "${TARGETARCH}" in \
      amd64) llvm_sha="${LLVM_SHA256_AMD64}"; llvm_arch=X64 ;; \
      arm64) llvm_sha="${LLVM_SHA256_ARM64}"; llvm_arch=ARM64 ;; \
      *) echo "the llvm layer pins amd64 and arm64, got ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    d="LLVM-${LLVM_VERSION}-Linux-${llvm_arch}"; \
    f="${d}.tar.xz"; \
    curl -fsSL -o "/tmp/${f}" "https://github.com/llvm/llvm-project/releases/download/llvmorg-${LLVM_VERSION}/${f}"; \
    echo "${llvm_sha}  /tmp/${f}" | sha256sum -c -; \
    mkdir -p /opt/llvm; \
    tar -xJf "/tmp/${f}" -C /opt/llvm --strip-components=1 --no-same-owner \
      "${d}/bin" "${d}/lib/clang"; \
    rm -f "/tmp/${f}"; \
    for t in clang clang-cl lld lld-link ld.lld llvm-lib llvm-ar llvm-ranlib llvm-rc llvm-mt llvm-dlltool; do \
      ln -sf "/opt/llvm/bin/${t}" "/usr/local/bin/${t}"; \
    done

# Self-check: clang-cl --version and the linkers (runners R5.43).
RUN clang-cl --version && lld-link --version && llvm-lib --help >/dev/null

USER runner
