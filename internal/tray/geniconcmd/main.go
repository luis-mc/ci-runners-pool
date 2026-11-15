// Command geniconcmd writes the program icon (the healthy CRSP disc, 16 to 256 px)
// from the tray's own drawing code. Run by go generate in cmd/crsp.
package main

import (
	"fmt"
	"os"

	"github.com/luis-mc/ci-runners-shared-pool/internal/tray"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: geniconcmd <out.ico>")
		os.Exit(2)
	}
	if err := os.WriteFile(os.Args[1], tray.AppICO(), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
