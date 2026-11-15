package backend

import "context"

// Found is a runner seen in the OS service list, made by CRSP or not (runners
// R5.5; port of dev-standards DS R5.38).
type Found struct {
	ServiceName string
	Name        string
	Folder      string
	Account     string
	Running     bool
	// Managed is true when the folder holds CRSP's own meta file.
	Managed bool
	// FolderUnreadable is true when the agent could not read the folder.
	FolderUnreadable bool
	Labels           []string
	RunnerVersion    string
}

// Finder lists runners from the OS service list, not only from folders.
type Finder interface {
	Find(ctx context.Context) ([]Found, error)
}

// Deregisterer removes a runner from GitHub with a remove token before its
// folder is touched (runners R5.19, DL315). A failure leaves the runner and
// folder as they were. The token is used once and dropped.
type Deregisterer interface {
	Deregister(ctx context.Context, h Handle, removeToken string) error
}

// Tool image attachment kinds, guest mount point and virtiofs tag (runners
// R5.69). The tool tree is always read-only in the guest.
const (
	ToolKindDisk     = "disk"
	ToolKindVirtiofs = "virtiofs"
	ToolGuestPath    = "/opt/crsp-tools"
	ToolShareTag     = "crsp-tools"
)

// ToolMount is one prebuilt tool tree to attach to a VM at boot.
type ToolMount struct {
	// Kind is ToolKindDisk or ToolKindVirtiofs.
	Kind string
	// HostPath is the disk file or the shared folder on the host.
	HostPath string
	// GuestPath is where the VM mounts it.
	GuestPath string
	// Tag is the virtiofs tag (a disk is found by its label).
	Tag string
	// Digest is the OCI digest the tree came from.
	Digest string
	// ReadOnly is always true; a backend refuses a mount that is not.
	ReadOnly bool
}

// ToolBooter is the VM backend hook: start the runner VM with tool trees
// attached at boot, so the job does not download them inside the VM. A
// backend that cannot attach does not implement it.
type ToolBooter interface {
	StartWithTools(ctx context.Context, r RunnerSpec, cfg StartConfig, tools []ToolMount) (Handle, error)
}
