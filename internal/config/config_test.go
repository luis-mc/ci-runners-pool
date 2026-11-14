package config

import (
	"log/slog"
	"path/filepath"
	"strings"
	"testing"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddr != "127.0.0.1:8080" || cfg.LogLevel != slog.LevelInfo || cfg.DataDir == "" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestLoadValues(t *testing.T) {
	dir := t.TempDir()
	cfg, err := Load(env(map[string]string{
		EnvDataDir: dir, EnvListenAddr: "127.0.0.1:9000", EnvLogLevel: "debug",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DataDir != dir || cfg.ListenAddr != "127.0.0.1:9000" || cfg.LogLevel != slog.LevelDebug {
		t.Fatalf("unexpected: %+v", cfg)
	}
}

func TestLoadRefusesPlaceholders(t *testing.T) {
	for _, v := range []string{"<path>", "<...>", "changeme", "CHANGE_ME", "your-data-dir", "${CRSP_DATA_DIR}", "TODO"} {
		_, err := Load(env(map[string]string{EnvDataDir: v}))
		if err == nil || !strings.Contains(err.Error(), "placeholder") {
			t.Errorf("value %q: want placeholder error, got %v", v, err)
		}
	}
}

func TestLoadRefusesBadValues(t *testing.T) {
	abs := filepath.Join(t.TempDir(), "d")
	cases := map[string]map[string]string{
		"relative dir": {EnvDataDir: "relative/dir"},
		"no port":      {EnvDataDir: abs, EnvListenAddr: "localhost"},
		"bad port":     {EnvDataDir: abs, EnvListenAddr: "localhost:99999"},
		"bad level":    {EnvDataDir: abs, EnvLogLevel: "loud"},
	}
	for name, m := range cases {
		if _, err := Load(env(m)); err == nil {
			t.Errorf("%s: want error", name)
		}
	}
}

func TestLoadReportsAllProblems(t *testing.T) {
	_, err := Load(env(map[string]string{EnvDataDir: "<x>", EnvListenAddr: "bad", EnvLogLevel: "loud"}))
	if err == nil {
		t.Fatal("want error")
	}
	for _, name := range []string{EnvDataDir, EnvListenAddr, EnvLogLevel} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("error does not mention %s: %v", name, err)
		}
	}
}
