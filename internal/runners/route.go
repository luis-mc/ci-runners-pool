package runners

import (
	"context"
	"fmt"
	"strings"
)

// Queue is the queue a runner serves (runners R5.70).
type Queue string

// The queues. A runner serves exactly one.
const (
	QueueCI    Queue = "ci"    // the job slots
	QueueLight Queue = "light" // the light slots (scheduling R5.65)
)

// Route says which pool and queue a runner serves. It is stored on the record
// and is the only thing routing reads; the runner name is for people (runners
// R5.70, handover lesson 3). A name may change or repeat without moving a
// runner to another queue.
type Route struct {
	// Pool is the pool name the runner serves; empty means the default pool.
	Pool  string
	Queue Queue
}

// Normal gives the route with an empty queue read as the CI queue.
func (r Route) Normal() Route {
	if r.Queue == "" {
		r.Queue = QueueCI
	}
	return r
}

// Light is true for a route on the light queue.
func (r Route) Light() bool { return r.Normal().Queue == QueueLight }

// Validate refuses a queue that does not exist.
func (r Route) Validate() error {
	switch r.Normal().Queue {
	case QueueCI, QueueLight:
		return nil
	}
	return fmt.Errorf("route queue %q is not ci or light", r.Queue)
}

// RouteForLabels is the route a new runner gets from the labels it was asked
// for: the light label puts it on the light queue. It reads labels, never the
// name. The name is not an input.
func RouteForLabels(pool string, labels []string) Route {
	r := Route{Pool: pool, Queue: QueueCI}
	for _, l := range labels {
		if strings.EqualFold(l, LightLabel) {
			r.Queue = QueueLight
		}
	}
	return r
}

// RouteOf is the route of a record, with an empty queue read as CI.
func RouteOf(r Record) Route { return r.Route.Normal() }

// RunsLight answers the job gate: is the runner with this name on this machine
// on the light queue? It reads the stored route of the record found by name;
// the name is only the key to find the record, never parsed. An unknown runner
// is not light.
func (s *Service) RunsLight(ctx context.Context, machineID, runnerName string) bool {
	all, err := s.Store.ListRunners(ctx, Filter{MachineID: machineID})
	if err != nil {
		return false
	}
	for _, r := range all {
		if r.MachineID == machineID && r.Name == runnerName {
			return RouteOf(r).Light()
		}
	}
	return false
}
