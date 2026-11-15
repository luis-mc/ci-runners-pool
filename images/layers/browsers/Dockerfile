# syntax=docker/dockerfile:1
# The `browsers` image layer: Playwright browsers and their system libraries on
# top of the base job image (runners R5.44, R5.50; caches R5.41).
#   docker build --build-arg BASE_IMAGE=crsp-linux-base:ci \
#     --build-arg PLAYWRIGHT_VERSION=1.56.1 -t crsp-linux-browsers images/layers/browsers
#
# The Playwright version is pinned. A rebuild never lowers it for a pool
# (internal/runners/layers.go, NeverLower); the pool passes the version in.
ARG BASE_IMAGE=crsp-linux-base:ci
FROM ${BASE_IMAGE}

ARG PLAYWRIGHT_VERSION=1.56.1
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/crsp/browsers \
    PLAYWRIGHT_SKIP_BROWSER_GARBAGE_COLLECTION=1

USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install the pinned playwright-core in a throwaway folder, let it fetch the
# three browsers and the system packages they need, then drop the folder.
RUN set -eu; \
    mkdir -p /opt/crsp/pw "${PLAYWRIGHT_BROWSERS_PATH}"; \
    cd /opt/crsp/pw; \
    npm init -y >/dev/null; \
    npm install --no-audit --no-fund --save-exact "playwright-core@${PLAYWRIGHT_VERSION}"; \
    node node_modules/playwright-core/cli.js install --with-deps chromium firefox webkit; \
    echo "${PLAYWRIGHT_VERSION}" > /opt/crsp/browsers/.crsp-playwright-version; \
    rm -rf /var/lib/apt/lists/* /root/.npm; \
    chmod -R a+rX /opt/crsp

# Self-check: launch each browser headless once, or the build fails.
RUN cd /opt/crsp/pw && node -e ' \
  const pw = require("playwright-core"); \
  (async () => { \
    for (const t of [pw.chromium, pw.firefox, pw.webkit]) { \
      const b = await t.launch({ headless: true }); \
      const p = await b.newPage(); \
      await p.setContent("<p>ok</p>"); \
      await b.close(); \
    } \
  })().catch((e) => { console.error(e); process.exit(1); })'

USER runner
WORKDIR /home/runner
