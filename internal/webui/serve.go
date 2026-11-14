package webui

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"time"
)

// NewServer is the console's server (web-console R5.1): TLS only, with the
// certificate of the controller's own CA (internal/tlsca, the same one the
// agent link uses), the security headers of R6.3 on every answer. There is no
// plain-HTTP listener for the console: a client that speaks HTTP to this port
// gets TLS's refusal, never a page.
//
// tlsConfig must carry the certificate and a TLS 1.3 minimum
// (tlsca.Authority.ServerTLS).
func NewServer(addr string, tlsConfig *tls.Config, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           Secure(handler),
		TLSConfig:         tlsConfig,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
}

// Serve accepts connections on ln and serves them over TLS. It returns when the
// server is shut down.
func Serve(srv *http.Server, ln net.Listener) error {
	if srv.TLSConfig == nil || len(srv.TLSConfig.Certificates) == 0 && srv.TLSConfig.GetCertificate == nil {
		return errors.New("webui: the console is served over TLS and needs a certificate")
	}
	// The certificate is in TLSConfig, so the file names stay empty.
	return srv.ServeTLS(ln, "", "")
}

// Listen opens the console's TCP listener.
func Listen(ctx context.Context, addr string) (net.Listener, error) {
	return (&net.ListenConfig{}).Listen(ctx, "tcp", addr)
}
