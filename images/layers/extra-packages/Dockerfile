# syntax=docker/dockerfile:1
# Layer extra-packages (runners R5.51, R5.50): the extra distribution packages
# a pool lists, installed as the LAST layer of the image. The names are part of
# the image key, so a changed list builds a new image aside (R5.33). Each name
# is checked again here against the same pattern as the controller uses.
#   docker build --build-arg BASE_IMAGE=crsp-linux-base:ci \
#     --build-arg EXTRA_PACKAGES="zlib1g-dev libc++-dev" -t crsp-layer-extra-packages images/layers/extra-packages
ARG BASE_IMAGE=crsp-linux-base:ci
FROM ${BASE_IMAGE}

# Space separated package names. Empty installs nothing.
ARG EXTRA_PACKAGES=""

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV DEBIAN_FRONTEND=noninteractive
# apt retries and timeouts: a slow or flaky mirror retries instead of hanging
# for the whole job (OPS41). The base image has it; written again so the layer holds without it.
RUN printf '%s\n' 'Acquire::Retries "5";' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' \
      > /etc/apt/apt.conf.d/80-crsp-retries

RUN set -eu; \
    for n in ${EXTRA_PACKAGES}; do \
      case "$n" in \
        -*|*[!A-Za-z0-9+.-]*) echo "extra package name refused: $n" >&2; exit 1 ;; \
      esac; \
    done; \
    if [ -n "${EXTRA_PACKAGES// /}" ]; then \
      apt-get update; \
      apt-get install -y --no-install-recommends ${EXTRA_PACKAGES}; \
      rm -rf /var/lib/apt/lists/*; \
    fi

# Self-check: every listed package is installed, or the build fails (R5.51).
RUN set -eu; for n in ${EXTRA_PACKAGES}; do dpkg -s "$n" >/dev/null; done

USER runner
