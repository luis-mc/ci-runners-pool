# syntax=docker/dockerfile:1
# Layer kvm (runners R5.50, R5.41): qemu and the tools a test VM boot needs.
# The device is allowed at run time with --device-cgroup-rule 'c 10:232 rwm' and
# created by kvm-wait.sh; never --device (lesson 28) and never --privileged.
#   docker build --build-arg BASE_IMAGE=crsp-linux-base:ci -t crsp-layer-kvm images/layers/kvm
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
      qemu-system-x86 qemu-utils cloud-image-utils openssh-client \
 && rm -rf /var/lib/apt/lists/*

# Bounded wait for /dev/kvm, then start without KVM (handover lesson 25).
COPY --chmod=0755 kvm-wait.sh /usr/local/bin/kvm-wait.sh

# Self-check (runners R5.50).
RUN qemu-system-x86_64 --version >/dev/null && qemu-img --version >/dev/null \
 && command -v cloud-localds >/dev/null && ssh -V

USER runner
