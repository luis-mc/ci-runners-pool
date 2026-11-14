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
