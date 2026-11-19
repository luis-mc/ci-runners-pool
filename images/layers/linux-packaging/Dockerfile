# syntax=docker/dockerfile:1
# Layer linux-packaging (runners R5.50): deb (dpkg-dev, fakeroot) and rpm building, SELinux policy,
# signing, shell lint and a repository tool.
#   docker build --build-arg BASE_IMAGE=crsp-linux-base:ci -t crsp-layer-linux-packaging images/layers/linux-packaging
ARG BASE_IMAGE=crsp-linux-base:ci
FROM ${BASE_IMAGE}

USER root
ENV DEBIAN_FRONTEND=noninteractive
# apt retries and timeouts: a slow or flaky mirror retries instead of hanging
# for the whole job (OPS41). The base image has it; written again so the layer holds without it.
RUN printf '%s\n' 'Acquire::Retries "5";' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' \
      > /etc/apt/apt.conf.d/80-crsp-retries

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      dpkg-dev fakeroot rpm make checkpolicy selinux-policy-dev policycoreutils \
      gnupg shellcheck systemd createrepo-c \
 && if apt-cache show policycoreutils-python-utils >/dev/null 2>&1; then \
      apt-get install -y --no-install-recommends policycoreutils-python-utils; \
    else echo "policycoreutils-python-utils is not in this base image; skipped"; fi \
 && rm -rf /var/lib/apt/lists/*

# Self-check (runners R5.50).
RUN dpkg-deb --version >/dev/null && dpkg-buildpackage --version >/dev/null \
 && fakeroot --version >/dev/null && rpmbuild --version && make --version >/dev/null \
 && checkmodule -V && gpg --version >/dev/null && shellcheck --version >/dev/null \
 && createrepo_c --version

USER runner
