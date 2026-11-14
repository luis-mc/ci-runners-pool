// Package trayserver is the service side of the tray's local channel (tray
// R5.8, R6.8): one JSON line in, one JSON line out, on a Unix socket or a
// named pipe that only this machine can reach. The service reads who is
// calling from the OS (peer credentials, pipe client token), never from the
// request.
package trayserver

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"sync"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/tray"
)

// Caller is the OS user the OS says is on the other end.
type Caller struct {
	// OSUser is the Windows SID or the Unix uid, as stored in tray bindings.
	OSUser string
}

// Backend answers the calls. Errors are sent to the tray as the error text.
type Backend interface {
	// Status answers `status`.
	Status(ctx context.Context) (tray.Response, error)
	// Check answers `check`: look for a newer stable release now, then like Status.
	Check(ctx context.Context) (tray.Response, error)
	// Link answers `link`: a one-time URL for this caller, landing on target.
	Link(ctx context.Context, c Caller, target string) (string, error)
}

// ErrNoPeer says the OS could not name the caller; the channel then answers nothing but an error (spec section 8: closed, no link).
var ErrNoPeer = errors.New("the caller's OS user cannot be read")

// PeerFunc reads the caller of a connection from the OS.
type PeerFunc func(net.Conn) (Caller, error)

// Server serves the channel.
type Server struct {
	Backend Backend
	Peer    PeerFunc // nil: the OS reader of this build
	Logger  *slog.Logger
	// Timeout bounds one request (default 10 s; `check` asks GitHub, so it is not short).
	Timeout time.Duration
}

const maxLine = 4 << 10

// Serve accepts connections until ctx ends or the listener fails.
func (s *Server) Serve(ctx context.Context, ln net.Listener) error {
	if s.Peer == nil {
		s.Peer = PeerOf
	}
	if s.Logger == nil {
		s.Logger = slog.Default()
	}
	if s.Timeout <= 0 {
		s.Timeout = 10 * time.Second
	}
	go func() { <-ctx.Done(); _ = ln.Close() }()
	var wg sync.WaitGroup
	defer wg.Wait()
	for {
		conn, err := ln.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			var ne net.Error
			if errors.As(err, &ne) && ne.Timeout() {
				continue
			}
			return err
		}
		wg.Add(1)
		go func() { defer wg.Done(); s.handle(ctx, conn) }()
	}
}

func (s *Server) handle(ctx context.Context, conn net.Conn) {
	defer func() { _ = conn.Close() }()
	ctx, cancel := context.WithTimeout(ctx, s.Timeout)
	defer cancel()
	_ = conn.SetDeadline(time.Now().Add(s.Timeout))
	reply := func(r tray.Response) {
		b, _ := json.Marshal(r)
		_, _ = conn.Write(append(b, '\n'))
	}
	fail := func(msg string) { reply(tray.Response{OK: false, Error: msg}) }

	who, err := s.Peer(conn)
	if err != nil {
		s.Logger.Warn("tray channel: caller unknown, closed", "err", err)
		fail(ErrNoPeer.Error())
		return
	}
	line, err := bufio.NewReaderSize(io.LimitReader(conn, maxLine), maxLine).ReadBytes('\n')
	if err != nil && (!errors.Is(err, io.EOF) || len(line) == 0) {
		return
	}
	var req tray.Request
	if err := json.Unmarshal(line, &req); err != nil {
		fail("bad request")
		return
	}
	switch req.Call {
	case "status":
		r, err := s.Backend.Status(ctx)
		answer(reply, fail, r, err)
	case "check":
		r, err := s.Backend.Check(ctx)
		answer(reply, fail, r, err)
	case "link":
		u, err := s.Backend.Link(ctx, who, req.Target)
		if err != nil {
			fail(err.Error())
			return
		}
		reply(tray.Response{OK: true, URL: u})
	default:
		fail("unknown call")
	}
}

func answer(reply func(tray.Response), fail func(string), r tray.Response, err error) {
	if err != nil {
		fail(err.Error())
		return
	}
	r.OK = true
	reply(r)
}
