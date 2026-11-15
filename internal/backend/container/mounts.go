package container

import (
	"errors"
	"strings"
)

// CrspPathInContainer is where every container job finds the crsp binary
// (runners R5.48).
const CrspPathInContainer = "/usr/local/bin/crsp"

// ErrSocketMount is returned for a mount of an engine socket (runners R6.1).
var ErrSocketMount = errors.New("an engine socket is never mounted into a job")

// CrspMountArgs returns the `docker run` arguments that mount the agent's own
// binary read-only at /usr/local/bin/crsp. The binary is a linux binary of the
// agent's version. hostPath is the path the engine sees.
func CrspMountArgs(hostPath string) ([]string, error) {
	if hostPath == "" {
		return nil, errors.New("the crsp binary path is empty")
	}
	if IsSocketPath(hostPath) {
		return nil, ErrSocketMount
	}
	if strings.ContainsAny(hostPath, ":,\n") && !isWindowsDrivePath(hostPath) {
		return nil, errors.New("the crsp binary path has a character a mount cannot carry")
	}
	return []string{"--mount", "type=bind,source=" + hostPath + ",target=" + CrspPathInContainer + ",readonly"}, nil
}

// IsSocketPath is true for a path of a Docker or Podman socket.
func IsSocketPath(p string) bool {
	p = strings.ToLower(strings.ReplaceAll(p, "\\", "/"))
	return strings.HasSuffix(p, "docker.sock") || strings.HasSuffix(p, "podman.sock") ||
		strings.Contains(p, "/var/run/docker") || strings.Contains(p, "docker_engine")
}

func isWindowsDrivePath(p string) bool {
	return len(p) > 2 && p[1] == ':' && (p[2] == '\\' || p[2] == '/') && !strings.ContainsAny(p[2:], ":,\n")
}
