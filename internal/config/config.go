// Package config holds the one validated configuration schema (STACKSPEC 15).
//
// Every setting is an environment variable named CRSP_*. A value that looks like
// a placeholder is refused, so a copied .env.example never boots.
//
// Secrets are not configuration: the GitHub App private key and the webhook
// secret live in the OS secret store, never in env, the database or logs.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// Environment variable names.
const (
	EnvDataDir    = "CRSP_DATA_DIR"
	EnvListenAddr = "CRSP_LISTEN_ADDR"
	EnvLogLevel   = "CRSP_LOG_LEVEL"
)

// Config is the validated configuration of a running process.
type Config struct {
	// DataDir holds the SQLite database and other local state.
	DataDir string
	// ListenAddr is the controller's HTTP listen address (host:port).
	ListenAddr string
	// LogLevel is the minimum level written to the structured log.
	LogLevel slog.Level
}

var placeholder = regexp.MustCompile(`(?i)^\s*(<[^>]*>|\$\{[^}]*\}|change[-_ ]?me|replace[-_ ]?me|todo|tbd|xxx+|your[-_ ].*|example)\s*$`)

// Load reads and validates the configuration. getenv is os.Getenv in production.
// All problems are reported together.
func Load(getenv func(string) string) (Config, error) {
	var errs []error
	get := func(name string) string {
		v := strings.TrimSpace(getenv(name))
		if v != "" && placeholder.MatchString(v) {
			errs = append(errs, fmt.Errorf("%s: %q is a placeholder; set a real value or unset it", name, v))
			return ""
		}
		return v
	}

	cfg := Config{
		DataDir:    get(EnvDataDir),
		ListenAddr: get(EnvListenAddr),
		LogLevel:   slog.LevelInfo,
	}

	if cfg.DataDir == "" {
		dir, err := os.UserConfigDir()
		if err != nil {
			errs = append(errs, fmt.Errorf("%s: not set and no user config dir: %w", EnvDataDir, err))
		} else {
			cfg.DataDir = filepath.Join(dir, "crsp")
		}
	} else if !filepath.IsAbs(cfg.DataDir) {
		errs = append(errs, fmt.Errorf("%s: %q must be an absolute path", EnvDataDir, cfg.DataDir))
	}

	if cfg.ListenAddr == "" {
		cfg.ListenAddr = "127.0.0.1:8080"
	}
	if err := validateListenAddr(cfg.ListenAddr); err != nil {
		errs = append(errs, fmt.Errorf("%s: %w", EnvListenAddr, err))
	}

	if v := get(EnvLogLevel); v != "" {
		if err := cfg.LogLevel.UnmarshalText([]byte(v)); err != nil {
			errs = append(errs, fmt.Errorf("%s: %q is not one of debug, info, warn, error", EnvLogLevel, v))
		}
	}

	if err := errors.Join(errs...); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func validateListenAddr(addr string) error {
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("%q is not host:port", addr)
	}
	n, err := strconv.Atoi(port)
	if err != nil || n < 0 || n > 65535 {
		return fmt.Errorf("%q has an invalid port", addr)
	}
	return nil
}
