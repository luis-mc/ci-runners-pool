package tray

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"time"
)

// Request is one JSON line sent over the local channel (spec section 7).
type Request struct {
	Call string `json:"call"` // status | link
}

// Response is one JSON line answered by the service.
type Response struct {
	OK      bool   `json:"ok"`
	Error   string `json:"error,omitempty"`
	State   State  `json:"state,omitempty"`
	Running int    `json:"running,omitempty"`
	Waiting int    `json:"waiting,omitempty"`
	Runners int    `json:"runners,omitempty"`
	Fault   string `json:"fault,omitempty"`
	URL     string `json:"url,omitempty"` // call=link
	LogDir  string `json:"log_dir,omitempty"`
}

// Dialer opens the local channel: a named pipe on Windows, a Unix socket elsewhere.
type Dialer func(ctx context.Context) (net.Conn, error)

// Client talks to the local service. It never blocks longer than Timeout (R6.6).
type Client struct {
	Dial    Dialer
	Timeout time.Duration
}

// NewClient returns a client for the OS default channel path.
func NewClient() *Client {
	return &Client{Dial: DefaultDialer(), Timeout: 3 * time.Second}
}

// Call sends one request and reads one response line.
func (c *Client) Call(ctx context.Context, call string) (Response, error) {
	to := c.Timeout
	if to <= 0 {
		to = 3 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, to)
	defer cancel()
	conn, err := c.Dial(ctx)
	if err != nil {
		return Response{}, err
	}
	defer func() { _ = conn.Close() }()
	if dl, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(dl)
	}
	// Unblock reads when the context ends (pipes may not honour deadlines).
	done := make(chan struct{})
	defer close(done)
	go func() {
		select {
		case <-ctx.Done():
			_ = conn.Close()
		case <-done:
		}
	}()
	if err := json.NewEncoder(conn).Encode(Request{Call: call}); err != nil {
		return Response{}, err
	}
	line, err := bufio.NewReader(conn).ReadBytes('\n')
	if err != nil && !(errors.Is(err, io.EOF) && len(line) > 0) {
		if ctx.Err() != nil {
			return Response{}, ctx.Err()
		}
		return Response{}, err
	}
	var r Response
	if err := json.Unmarshal(line, &r); err != nil {
		return Response{}, fmt.Errorf("local channel: bad answer: %w", err)
	}
	if !r.OK {
		return r, fmt.Errorf("local channel: %s", r.Error)
	}
	return r, nil
}

// Status asks the service for its status.
func (c *Client) Status(ctx context.Context) (Status, error) {
	r, err := c.Call(ctx, "status")
	if err != nil {
		return Status{}, err
	}
	st := r.State
	if st == "" {
		st = StateHealthy
	}
	return Status{State: st, Running: r.Running, Waiting: r.Waiting, Runners: r.Runners, Fault: r.Fault}, nil
}

// Link asks the service for a one-time sign-in URL (R5.6).
func (c *Client) Link(ctx context.Context) (string, error) {
	r, err := c.Call(ctx, "link")
	if err != nil {
		return "", err
	}
	if r.URL == "" {
		return "", errors.New("local channel: no link in answer")
	}
	return r.URL, nil
}
