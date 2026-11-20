package jobsample

import (
	"context"
	"sync"
	"time"
)

// Collector drives sampling of the running jobs: Tick samples every target, and a batch goes out once Batch
// has passed since the last one; Finish sends the final batch. A sender error drops that batch and never
// fails the job (the controller answers nothing; a lost batch only leaves a gap, R5.19).
type Collector struct {
	Cgroup      Sampler
	ProcessTree Sampler
	Sender      Sender
	// Forget is called when a job ends, to drop sampler state; may be nil.
	Forget func(Target)
	// Enabled says whether the controller's HelloAck allowed version 4. Nil means enabled.
	Enabled func() bool

	mu   sync.Mutex
	jobs map[string]*jobState
}

type jobState struct {
	t       Target
	buf     []Sample
	sentAt  time.Time
	unknown string
}

func key(t Target) string { return t.RunnerID }

// Start begins sampling a job at now.
func (c *Collector) Start(t Target, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.jobs == nil {
		c.jobs = map[string]*jobState{}
	}
	c.jobs[key(t)] = &jobState{t: t, sentAt: now}
}

func (c *Collector) enabled() bool { return c.Enabled == nil || c.Enabled() }

func (c *Collector) sampler(t Target) Sampler {
	if t.CgroupPath != "" {
		return c.Cgroup
	}
	return c.ProcessTree
}

// Tick takes one sample of every job and sends the batches that are due.
func (c *Collector) Tick(ctx context.Context, now time.Time) {
	if !c.enabled() {
		return
	}
	type out struct {
		t       Target
		src     Source
		batch   []Sample
		unknown string
	}
	var due []out
	c.mu.Lock()
	for _, js := range c.jobs {
		s := c.sampler(js.t)
		if s == nil {
			continue
		}
		smp, reason, err := s.Sample(ctx, js.t, now)
		if err != nil {
			continue
		}
		if !smp.Known && reason != "" {
			js.unknown = reason
		}
		js.buf = append(js.buf, smp)
		if now.Sub(js.sentAt) >= Batch {
			due = append(due, out{js.t, s.Source(), js.buf, js.unknown})
			js.buf, js.sentAt, js.unknown = nil, now, ""
		}
	}
	c.mu.Unlock()
	for _, o := range due {
		_ = c.Sender.Send(ctx, o.t, o.src, o.batch, false, o.unknown)
	}
}

// Finish takes a last sample, sends what is buffered as the final batch and forgets the job.
func (c *Collector) Finish(ctx context.Context, t Target, now time.Time) {
	c.mu.Lock()
	js := c.jobs[key(t)]
	delete(c.jobs, key(t))
	c.mu.Unlock()
	if js == nil {
		return
	}
	defer func() {
		if c.Forget != nil {
			c.Forget(js.t)
		}
	}()
	if !c.enabled() {
		return
	}
	s := c.sampler(js.t)
	if s == nil {
		return
	}
	if smp, reason, err := s.Sample(ctx, js.t, now); err == nil {
		if !smp.Known && reason != "" {
			js.unknown = reason
		}
		js.buf = append(js.buf, smp)
	}
	_ = c.Sender.Send(ctx, js.t, s.Source(), js.buf, true, js.unknown)
}

// Run ticks on every value of ticks until ctx ends or ticks closes.
func (c *Collector) Run(ctx context.Context, ticks <-chan time.Time) {
	for {
		select {
		case <-ctx.Done():
			return
		case now, ok := <-ticks:
			if !ok {
				return
			}
			c.Tick(ctx, now)
		}
	}
}
