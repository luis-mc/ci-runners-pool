package insights

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/redact"
)

const (
	// WindowLength is the window every pass reads: the last 7 days (R5.9, R6.3).
	WindowLength = 7 * 24 * time.Hour
	// Interval is how often the engine runs the analysers (R6.3).
	Interval = 15 * time.Minute
	// SlowPass is the pass length over which the engine logs a warning and the doctor shows it (R6.3).
	SlowPass = 30 * time.Second
)

// Clock is the engine's time source, so tests need no sleeps.
type Clock interface {
	Now() time.Time
	// After returns a channel that receives once d has passed.
	After(d time.Duration) <-chan time.Time
}

// SystemClock is the real clock.
type SystemClock struct{}

// Now returns the current time.
func (SystemClock) Now() time.Time { return time.Now() }

// After is time.After.
func (SystemClock) After(d time.Duration) <-chan time.Time { return time.After(d) }

// PassStats is what the doctor reads about the last pass of one analyser (R6.3, R6.8).
type PassStats struct {
	Analyser string
	Took     time.Duration
	OK       bool
	Slow     bool
	Err      string
}

// engine is the Engine of this package.
type engine struct {
	analysers []Analyser
	store     FindingStore
	runs      RunLog
	clock     Clock
	log       *slog.Logger
	redactor  *redact.Redactor
	onPass    func(PassStats)
}

// Option configures NewEngine.
type Option func(*engine)

// WithClock sets the clock (tests use a fake).
func WithClock(c Clock) Option { return func(e *engine) { e.clock = c } }

// WithLogger sets the logger; nil keeps the default.
func WithLogger(l *slog.Logger) Option {
	return func(e *engine) {
		if l != nil {
			e.log = l
		}
	}
}

// WithPassHook sets a callback run after every analyser pass, with its stats (the doctor's feed, R6.3).
func WithPassHook(f func(PassStats)) Option { return func(e *engine) { e.onPass = f } }

// NewEngine returns the Engine over the analysers. runs may be nil (no run log).
func NewEngine(analysers []Analyser, store FindingStore, runs RunLog, opts ...Option) Engine {
	e := &engine{analysers: analysers, store: store, runs: runs, clock: SystemClock{},
		log: slog.Default(), redactor: redact.New()}
	for _, o := range opts {
		o(e)
	}
	return e
}

// RunOnce runs every analyser once, one at a time, over the 7 days ending at now, and syncs each one's
// findings. A failed analyser is counted and logged and resolves nothing (R6.8); the others still run.
func (e *engine) RunOnce(ctx context.Context, now time.Time) error {
	now = now.UTC()
	w := Window{From: now.Add(-WindowLength), To: now}
	var errs []error
	for _, a := range e.analysers {
		if ctx.Err() != nil {
			errs = append(errs, ctx.Err())
			break
		}
		if err := e.pass(ctx, a, w, now); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (e *engine) pass(ctx context.Context, a Analyser, w Window, now time.Time) (err error) {
	start := e.clock.Now()
	var runID int64
	if e.runs != nil {
		if id, berr := e.runs.Begin(ctx, a.Name(), w, now); berr != nil {
			e.log.Warn("insights: run log begin failed", "analyser", a.Name(), "err", e.safe(berr))
		} else {
			runID = id
		}
	}
	var found []Finding
	var res SyncResult
	// A panic in an analyser is a failed pass, never a crash (R6.8).
	func() {
		defer func() {
			if p := recover(); p != nil {
				err = fmt.Errorf("analyser %s panicked: %v", a.Name(), p)
			}
		}()
		found, err = a.Analyse(ctx, w)
		if err == nil {
			found = ownedOnly(a, found)
			res, err = e.store.Sync(ctx, a.Kinds(), found, now)
		}
	}()
	took := e.clock.Now().Sub(start)
	st := PassStats{Analyser: a.Name(), Took: took, OK: err == nil, Slow: took > SlowPass}
	if err != nil {
		st.Err = e.safe(err)
		e.log.Warn("insights: pass failed", "analyser", a.Name(), "err", st.Err)
	}
	if st.Slow {
		e.log.Warn("insights: slow pass", "analyser", a.Name(), "took", took.String())
	}
	if e.runs != nil && runID != 0 {
		if eerr := e.runs.End(ctx, runID, e.clock.Now().UTC(), err == nil, len(found), res.Resolved, st.Err); eerr != nil {
			e.log.Warn("insights: run log end failed", "analyser", a.Name(), "err", e.safe(eerr))
		}
	}
	if e.onPass != nil {
		e.onPass(st)
	}
	if err != nil {
		return fmt.Errorf("%s: %s", a.Name(), st.Err)
	}
	return nil
}

// ownedOnly drops findings of kinds the analyser does not own: Sync resolves by owned kinds, so a stray kind
// would be opened but never closed.
func ownedOnly(a Analyser, found []Finding) []Finding {
	owned := map[Kind]bool{}
	for _, k := range a.Kinds() {
		owned[k] = true
	}
	out := found[:0:0]
	for _, f := range found {
		if owned[f.Kind] {
			out = append(out, f)
		}
	}
	return out
}

func (e *engine) safe(err error) string { return e.redactor.Redact(err.Error()) }

// Run calls RunOnce at once and then every Interval until ctx ends. A failed pass never stops the loop.
func (e *engine) Run(ctx context.Context) error {
	for {
		_ = e.RunOnce(ctx, e.clock.Now())
		select {
		case <-ctx.Done():
			return nil
		case <-e.clock.After(Interval):
		}
	}
}
