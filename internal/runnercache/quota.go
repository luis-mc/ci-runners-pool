package runnercache

import (
	"errors"
	"fmt"
)

const (
	// GiB is one gibibyte.
	GiB int64 = 1 << 30

	// DefaultToolQuotaGiB is the default quota of a runner's tool cache.
	DefaultToolQuotaGiB = 20
	// DefaultRustQuotaGiB is the default cap of a runner's Rust build cache.
	DefaultRustQuotaGiB = 40
	// DefaultMinFreePct is the free space under which new jobs are held.
	DefaultMinFreePct = 10
	// ResumeMarginPct is added to the minimum before held jobs go again, so
	// the guard does not flap around the limit.
	ResumeMarginPct = 2
)

// Quota is the declared cache sizing of one machine's runners, in GiB per
// runner. A zero field takes its default. Quotas come from configuration.
type Quota struct {
	ToolGiB int `json:"tool_gib" yaml:"tool_gib"`
	RustGiB int `json:"rust_gib" yaml:"rust_gib"`
	// MinFreePct is the disk guard threshold in percent of the volume.
	MinFreePct int `json:"min_free_pct" yaml:"min_free_pct"`
}

// WithDefaults fills the zero fields.
func (q Quota) WithDefaults() Quota {
	if q.ToolGiB == 0 {
		q.ToolGiB = DefaultToolQuotaGiB
	}
	if q.RustGiB == 0 {
		q.RustGiB = DefaultRustQuotaGiB
	}
	if q.MinFreePct == 0 {
		q.MinFreePct = DefaultMinFreePct
	}
	return q
}

// Validate refuses a quota that cannot work. Call it on a defaulted value.
func (q Quota) Validate() error {
	switch {
	case q.ToolGiB < 0 || q.RustGiB < 0:
		return errors.New("a cache quota cannot be negative")
	case q.MinFreePct < 1 || q.MinFreePct > 50:
		return fmt.Errorf("min_free_pct %d is outside 1 to 50", q.MinFreePct)
	}
	return nil
}

// ToolBytes is the tool cache quota in bytes.
func (q Quota) ToolBytes() int64 { return int64(q.ToolGiB) * GiB }

// RustBytes is the Rust build cache cap in bytes.
func (q Quota) RustBytes() int64 { return int64(q.RustGiB) * GiB }
