package main

import (
	"context"
	"crypto/tls"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agent"
	"github.com/luis-mc/ci-runners-shared-pool/internal/config"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/tlsca"
)

// Environment names of the agent link, beside the CRSP_* configuration.
const (
	envAgentAddr  = "CRSP_AGENT_ADDR"  // where the agent link listens, default 0.0.0.0:8461
	envPublicHost = "CRSP_PUBLIC_HOST" // the name agents use for this controller
	defaultAgent  = "0.0.0.0:8461"
)

// machinesRuntime is the machines area of a running controller.
type machinesRuntime struct {
	Service *machines.Service
	CA      *tlsca.Authority
	stop    func()
}

// Close stops the link, the controller's own agent and the periodic work.
func (m *machinesRuntime) Close() { m.stop() }

// startMachines makes the controller's CA, serves the agent link (TLS 1.3, port
// 8461), and starts the controller's own agent, which joins without a code over
// loopback like any other agent (machines R5.1, R5.2, decision 0004).
func startMachines(ctx context.Context, cfg config.Config, logger *slog.Logger) (*machinesRuntime, error) {
	secretsDir := filepath.Join(cfg.DataDir, "secrets", "controller")
	store, err := agent.NewFileStore(secretsDir)
	if err != nil {
		return nil, err
	}
	host, _ := os.Hostname()
	public := os.Getenv(envPublicHost)
	if public == "" {
		public = host
	}
	ca, err := tlsca.LoadOrCreate(ctx, tlsca.Options{Dir: filepath.Join(cfg.DataDir, "tls"), Secrets: store, Hosts: []string{public, host}})
	if err != nil {
		return nil, err
	}
	addr := os.Getenv(envAgentAddr)
	if addr == "" {
		addr = defaultAgent
	}
	_, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	port, _ := net.LookupPort("tcp", portStr)

	// The SQLite adapter of machines.Repository belongs to internal/store; until it
	// lands the repository is in memory, so machines and keys last until restart.
	svc := machines.New(machines.Options{
		Repo: machines.NewMemRepo(), ControllerAddress: public, AgentPort: port, Fingerprint: ca.Fingerprint(),
	})
	svc.SetHooks(machines.Hooks{ControllerVersion: version})

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}
	link := machines.NewLinkServer(addr, ca, svc)
	go func() {
		logger.Info("agent link listening", "addr", ln.Addr().String())
		if err := link.Serve(tls.NewListener(ln, ca.ServerTLS())); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("agent link stopped", "err", err)
		}
	}()

	runCtx, cancel := context.WithCancel(ctx)
	go svc.Run(runCtx, 5*time.Second, func(err error) { logger.Warn("machines tick", "err", err) })

	// The controller's own machine: the same Join and Session, over loopback.
	agentDir := filepath.Join(cfg.DataDir, "agent")
	if err := os.MkdirAll(agentDir, 0o700); err != nil {
		cancel()
		_ = link.Close()
		return nil, err
	}
	credFile := filepath.Join(agentDir, "local-join")
	cred, err := svc.LocalCredential(ctx)
	if err == nil {
		err = os.WriteFile(credFile, []byte(cred), 0o600)
	}
	if err != nil {
		cancel()
		_ = link.Close()
		return nil, err
	}
	agentStore, err := agent.NewFileStore(filepath.Join(agentDir, "secrets"))
	if err != nil {
		cancel()
		_ = link.Close()
		return nil, err
	}
	loop := net.JoinHostPort("127.0.0.1", portStr)
	done := make(chan struct{})
	go func() {
		defer close(done)
		acfg := agent.Config{
			Controller: loop, Pin: ca.Fingerprint(), LocalCredentialFile: credFile, Secrets: agentStore, DataDir: agentDir,
			Version: version, Logger: logger.With("component", "local-agent"),
		}
		if err := agent.Run(runCtx, acfg); err != nil {
			logger.Error("the controller's own agent stopped", "err", err)
		}
	}()
	return &machinesRuntime{Service: svc, CA: ca, stop: func() {
		cancel()
		_ = link.Close()
		<-done
	}}, nil
}
