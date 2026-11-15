package agent

import (
	"context"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
)

// ImageSource lists the job images of this machine; ok is false when the agent
// has no container backend, so the list is not known rather than empty.
type ImageSource func(ctx context.Context) (images []runners.Image, ok bool, err error)

// BuildMachineReport reads the KVM state, the container engine and the images.
// It reads only: it never loads a module, edits `.wslconfig` or starts an
// engine (machines R5.53, runners R5.47). facts carries what `.wslconfig` sets.
func BuildMachineReport(ctx context.Context, sys Sys, facts *agentv1.Facts, imgs ImageSource, now time.Time) *agentv1.MachineReport {
	rep := &agentv1.MachineReport{ReportedAtUnixMs: now.UnixMilli(), Kvm: &agentv1.KvmReport{}}
	k := rep.Kvm
	if sys.GOOS() == "windows" {
		w := ReadWSLKVM(sys)
		k.DeviceKnown, k.DevicePresent = w.Known, w.DevicePresent
		k.ModuleKnown, k.ModuleLoaded, k.Module = w.Known, w.ModuleLoaded, w.Module
		k.NestedKnown, k.NestedVirtualization = facts.GetWslConfigPresent(), facts.GetWslNestedVirtualization()
	} else {
		k.DeviceKnown, k.DevicePresent = true, sys.ReadWritable("/dev/kvm")
	}
	e := DetectEngine(sys)
	rep.Engine = &agentv1.EngineReport{Kind: string(e.Kind), Usable: e.Usable, Version: e.Version, Reason: e.Reason}
	if imgs != nil {
		list, ok, err := imgs(ctx)
		if ok && err == nil {
			rep.ImagesKnown = true
			for _, im := range list {
				rep.Images = append(rep.Images, &agentv1.ImageReport{
					Key: im.Key, Tag: im.Tag, Os: im.OS, Layers: im.Layers, SizeMb: im.SizeMB, CreatedUnixMs: im.CreatedAt.UnixMilli(),
				})
			}
		}
	}
	return rep
}

// reportMachine builds and sends one MachineReport.
func (l *link) reportMachine(ctx context.Context, commandID string) {
	l.factMu.Lock()
	f := l.facts
	l.factMu.Unlock()
	rep := BuildMachineReport(ctx, l.cfg.sys(), f, l.cfg.Images, time.Now())
	rep.CommandId = commandID
	rep.RunnerSwap = l.cfg.RunnerFiles != nil
	_ = l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_MachineReport{MachineReport: rep}})
}
