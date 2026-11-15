# syntax=docker/dockerfile:1
# Layer llvm (runners R5.43, R5.50): a pinned LLVM with clang-cl, lld-link and
# llvm-lib on PATH, so cargo-xwin builds Windows targets. The download is
# SHA-256 checked; a wrong hash fails the build (R5.37 rule). Only amd64 is
# pinned (open question 14 of the runners spec).
#   docker build --build-arg BASE_IMAGE=crsp-linux-base:ci -t crsp-layer-llvm images/layers/llvm
ARG BASE_IMAGE=crsp-linux-base:ci
FROM ${BASE_IMAGE}

ARG TARGETARCH=amd64
ARG LLVM_VERSION=18.1.8
ARG LLVM_SHA256_AMD64=54ec30358afcc9fb8aa74307db3046f5187f9fb89fb37064cdde906e062ebf36

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN set -eu; \
    case "${TARGETARCH}" in \
      amd64) llvm_sha="${LLVM_SHA256_AMD64}" ;; \
      *) echo "the llvm layer pins only amd64, got ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    d="clang+llvm-${LLVM_VERSION}-x86_64-linux-gnu-ubuntu-18.04"; \
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

# The LLVM 18 binaries link libtinfo.so.5; Ubuntu 24.04 ships libtinfo.so.6.
RUN ln -s "$(ldconfig -p | awk '/libtinfo\.so\.6 .*x86-64/ {print $NF; exit}')" /usr/lib/x86_64-linux-gnu/libtinfo.so.5 \
 && ldconfig

# Self-check: clang-cl --version and the linkers (runners R5.43).
RUN clang-cl --version && lld-link --version && llvm-lib --help >/dev/null

USER runner
