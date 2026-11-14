// Package hooks embeds the runner hook scripts that persistent backends write
// into each runner folder (runners R5.17, R5.22, R5.23).
package hooks

import "embed"

//go:embed windows/*.ps1 unix/*.sh
var files embed.FS

// Windows returns the PowerShell hook (name is job-started or job-completed).
func Windows(name string) ([]byte, error) { return files.ReadFile("windows/" + name + ".ps1") }

// Unix returns the shell hook for Linux and macOS.
func Unix(name string) ([]byte, error) { return files.ReadFile("unix/" + name + ".sh") }
