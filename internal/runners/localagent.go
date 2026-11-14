package runners

import (
	"context"
	"errors"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
)

// LocalAgent runs the Agent calls on this machine through the backend
// registry. The agent process uses it to carry out what the controller sends
// over the agent link (decision 0004); the M1 agent on the controller's own
// machine uses the same path. The machine id of a call is the link's business,
// so LocalAgent ignores it.
type LocalAgent struct {
	Registry backend.Registry
}

var _ Agent = (*LocalAgent)(nil)

// NewLocalAgent builds a LocalAgent over a registry.
func NewLocalAgent(reg backend.Registry) *LocalAgent { return &LocalAgent{Registry: reg} }

func (l *LocalAgent) persistent() (backend.Backend, error) {
	b, ok := l.Registry.Get(backend.Persistent)
	if !ok {
		return nil, errors.New("this machine has no persistent runner backend")
	}
	return b, nil
}

// AddRunner starts a persistent runner.
func (l *LocalAgent) AddRunner(ctx context.Context, _ string, spec backend.RunnerSpec, cfg backend.StartConfig) (backend.Handle, error) {
	b, err := l.persistent()
	if err != nil {
		return backend.Handle{}, err
	}
	return b.Start(ctx, spec, cfg)
}

// StopService stops the runner's service.
func (l *LocalAgent) StopService(ctx context.Context, _ string, service string) error {
	b, err := l.persistent()
	if err != nil {
		return err
	}
	return b.Stop(ctx, backend.Handle{Ref: service})
}

// RemoveRunner deregisters with the remove token and checks the result; unless
// KeepFiles is set it then cleans up. A failed deregistration stops here and
// leaves the runner as it was (runners R5.19).
func (l *LocalAgent) RemoveRunner(ctx context.Context, _ string, req RemoveRequest) error {
	b, err := l.persistent()
	if err != nil {
		return err
	}
	h := backend.Handle{RunnerID: req.RunnerID, Ref: req.ServiceName}
	d, ok := b.(backend.Deregisterer)
	if !ok {
		return errors.New("this backend cannot deregister a runner")
	}
	if err := d.Deregister(ctx, h, req.RemoveToken); err != nil {
		return err
	}
	if req.KeepFiles {
		return nil
	}
	return b.CleanUp(ctx, h)
}

// CleanUp removes the service entry, the account and the folder.
func (l *LocalAgent) CleanUp(ctx context.Context, _ string, service string) error {
	b, err := l.persistent()
	if err != nil {
		return err
	}
	return b.CleanUp(ctx, backend.Handle{Ref: service})
}

// Found lists the runners in the OS service list (runners R5.5).
func (l *LocalAgent) Found(ctx context.Context) ([]backend.Found, error) {
	b, err := l.persistent()
	if err != nil {
		return nil, err
	}
	f, ok := b.(backend.Finder)
	if !ok {
		return nil, nil
	}
	return f.Find(ctx)
}
