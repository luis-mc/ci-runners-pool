// Package backend is the runner isolation backend plugin seam (decision 0003;
// runners R5.8 to R5.12, R5.24, R6.1 to R6.4).
//
// Every backend implements Backend. The agent calls backends only through it
// (R5.8). Milestone 1 builds the persistent backend for Windows, Linux and
// macOS, each in a sub-package behind build tags and built only into the
// binary for its OS (R5.24); later milestones add container, VM, Tart and
// microVM backends behind the same interface.
//
// Rules every backend keeps: no privileged container, no host PID or network
// namespace, no Docker or Podman socket in a job, KVM only as a device
// (R6.1); no token, JIT config or password is written anywhere (R6.2);
// CleanUp is called after Stop, also after an error or timeout, and is safe
// to call twice (R5.10).
package backend

import (
	"context"
	"time"
)

// Name names a backend, as reported in Support and allowed per machine
// (machines R5.11, R5.22).
type Name string

// Backend names of the product. Persistent is M1.
const (
	Persistent  Name = "persistent"
	Docker      Name = "docker"
	Podman      Name = "podman"
	Nerdctl     Name = "nerdctl"
	WSL2        Name = "wsl2"
	HyperV      Name = "hyperv"
	KVM         Name = "kvm"
	Tart        Name = "tart"
	Firecracker Name = "firecracker"
)

// Isolation is what the console names for each runner (runners R5.7).
type Isolation string

// Isolation kinds.
const (
	IsolationMicroVM    Isolation = "microVM"
	IsolationVM         Isolation = "VM"
	IsolationContainer  Isolation = "container"
	IsolationPersistent Isolation = "persistent"
)

// Support is the result of Detect (machines R5.11, runners R5.9).
type Support struct {
	Name      Name
	Present   bool
	Usable    bool
	Version   string
	Reason    string // why it is not usable, such as "no /dev/kvm"
	Rootless  bool
	Isolation Isolation
	// OS lists the runner OSes this backend can start here.
	OS []string
}

// ImageSpec names the image a runner needs (M2 onward; the persistent backend
// returns an empty ImageRef).
type ImageSpec struct {
	OS     string
	Arch   string
	Layers []string
}

// ImageRef is a prepared image on this machine.
type ImageRef struct {
	ID     string
	SizeMB int64
}

// RunnerSpec is the runner to start (runners R5.2, R5.13 to R5.23, R5.36).
type RunnerSpec struct {
	ID        string
	Name      string
	OS        string
	Arch      string
	Labels    []string // generic labels only
	GitHubURL string   // https://github.com/<owner>[/<repo>]
	Group     string
	// Pinned runner version and its SHA-256 (runners R5.37).
	RunnerVersion string
	RunnerSHA256  string
	Image         ImageRef
	// WindowsSymlinkRight grants "create symbolic links" to the runner account
	// (owner decision for M1, runners R5.14).
	WindowsSymlinkRight bool
}

// StartConfig carries the one-time credential to start a runner. Exactly one
// field is set. It is used once and dropped; it is never logged (R6.2).
type StartConfig struct {
	// Registration is a registration token for a persistent runner.
	Registration string
	// JITConfig is an encoded just-in-time config for an ephemeral runner (M2).
	JITConfig string
}

// Handle names a started runner for later calls.
type Handle struct {
	RunnerID string
	// Ref is backend-specific: a service name, unit, container or VM id.
	Ref string
}

// LogLine is one setup or runner log line, already redacted (R5.11).
type LogLine struct {
	At      time.Time
	Level   string
	Message string
	Step    string // prepare image, register, start, stop, clean up, deregister
}

// Usage is what ReportUsage gives per runner and job (R5.12).
type Usage struct {
	CPU          time.Duration
	MemoryPeak   int64
	MemoryMedian int64
	DiskUsed     int64
	Wall         time.Duration
}

// Backend is one isolation backend (decision 0003, runners R5.8).
type Backend interface {
	// Name is the backend's stable name.
	Name() Name
	// Detect says whether the backend is present and usable here, and why not.
	Detect(ctx context.Context) (Support, error)
	// PrepareImage builds or finds the image (M2 onward).
	PrepareImage(ctx context.Context, spec ImageSpec) (ImageRef, error)
	// Start registers and starts a runner with a JIT config or a registration.
	Start(ctx context.Context, r RunnerSpec, cfg StartConfig) (Handle, error)
	// StreamLogs sends log lines to out until ctx ends or the runner stops.
	StreamLogs(ctx context.Context, h Handle, out chan<- LogLine) error
	// Stop stops the runner. Callers drain first and check for an idle runner
	// right before (R6.4).
	Stop(ctx context.Context, h Handle) error
	// CleanUp removes what the runner left; idempotent (R5.10).
	CleanUp(ctx context.Context, h Handle) error
	// ReportUsage gives the runner's usage so far.
	ReportUsage(ctx context.Context, h Handle) (Usage, error)
}

// Registry is the set of backends built into this binary for this OS.
type Registry interface {
	// All returns every backend compiled in, best first per the decision 0003 table.
	All() []Backend
	// Get returns the backend with the name, or false.
	Get(name Name) (Backend, bool)
}
