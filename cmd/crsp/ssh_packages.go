package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/update"
)

// releasePackages is the machines.PackageSource of an SSH join to Windows: the
// GitHub release asset of the controller's own version, with its line from
// SHA256SUMS (CRSP123). The controller's own package endpoint (CRSP122) can
// replace it by giving machines.Options.Packages another source.
type releasePackages struct{ version string }

func (r releasePackages) WindowsPackage(ctx context.Context, arch string) (machines.PackageRef, error) {
	rel, err := update.GitHubSource{Version: r.version}.Latest(ctx)
	if err != nil {
		return machines.PackageRef{}, err
	}
	asset := update.AssetName("windows", arch)
	url, ok := rel.Assets[asset]
	if !ok {
		return machines.PackageRef{}, fmt.Errorf("release %s has no %s", rel.Version, asset)
	}
	sumsURL, ok := rel.Assets["SHA256SUMS"]
	if !ok {
		return machines.PackageRef{}, fmt.Errorf("release %s has no SHA256SUMS", rel.Version)
	}
	hr, err := http.NewRequestWithContext(ctx, http.MethodGet, sumsURL, nil)
	if err != nil {
		return machines.PackageRef{}, err
	}
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(hr)
	if err != nil {
		return machines.PackageRef{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return machines.PackageRef{}, fmt.Errorf("SHA256SUMS answered %d", resp.StatusCode)
	}
	sums, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return machines.PackageRef{}, err
	}
	sum, ok := update.SumFor(sums, asset)
	if !ok {
		return machines.PackageRef{}, fmt.Errorf("%s is not listed in SHA256SUMS", asset)
	}
	return machines.PackageRef{Name: asset, URL: url, SHA256: sum}, nil
}
