package poolsize

import (
	"fmt"
	"math"
)

// Floors and ratios of machines R5.58.
const (
	MinGiB       = 4
	MinCPUs      = 2
	GiBPerCPU    = 1.5
	DefaultMemPc = 85
	DefaultCPUPc = 60
)

// Inputs are the figures the check reads. All memory is in bytes.
type Inputs struct {
	TotalBytes int64
	TotalCPUs  int
	// UsedOutsideBytes is memory used outside WSL (median of samples).
	UsedOutsideBytes int64
	// WSLVMBytes is what the WSL VM holds now; GuestBytes is the memory the
	// runner guests take (R5.54). Both count against the memory budget.
	WSLVMBytes, GuestBytes int64
	// DockerCeilingBytes is the most Docker can be given (the declared WSL
	// memory); 0 when there is no ceiling or it is unknown.
	DockerCeilingBytes int64
	BudgetMemPct       int
	BudgetCPUPct       int
}

// Request is the owner's pool size and what it replaces.
type Request struct {
	MemGiB float64
	CPUs   int
	// CurMemGiB and CurCPUs are the saved size; 0 means none yet.
	CurMemGiB float64
	CurCPUs   int
	// ConfirmShrink is the owner's explicit yes to a size below the current.
	ConfirmShrink bool
}

// Result is what the check shows, accepted or not. The sizing inputs are
// always filled so the console can show them (R5.58).
type Result struct {
	OK bool
	// NeedsShrinkConfirm is true when the size passes but is lower than the
	// current one and was not confirmed; OK is false then.
	NeedsShrinkConfirm bool
	Reason             string
	// Short names the budget that is short: memory, cpu, floor, ratio, docker.
	Short string
	// Nearest are sizes that pass, as sentences.
	Nearest []string

	TotalGiB, UsedOutsideGiB, MemBudgetGiB, RoomGiB float64
	CPUBudget                                       int
	DockerCeilingGiB                                float64
	Decided                                         string
	// Half and ThreeQuarters are the recommended sizes (LOOK22): that share
	// of the room. Set whenever the sizing inputs are.
	Half, ThreeQuarters Recommended
}

// Recommended is one recommended pool size.
type Recommended struct {
	MemGiB int
	CPUs   int
}

// Recommend sizes the pool at a share of the room: the memory is that share
// of roomGiB rounded down to whole GiB, at least the floor; the CPUs are the
// same share of the CPU budget, at most memory / GiBPerCPU, at least the floor.
func Recommend(roomGiB float64, cpuBudget int, share float64) Recommended {
	mem := int(math.Floor(roomGiB*share + 1e-9))
	if mem < MinGiB {
		mem = MinGiB
	}
	cpus := int(math.Floor(float64(cpuBudget)*share + 1e-9))
	if byMem := int(math.Floor(float64(mem)/GiBPerCPU + 1e-9)); cpus > byMem {
		cpus = byMem
	}
	if cpus < MinCPUs {
		cpus = MinCPUs
	}
	return Recommended{MemGiB: mem, CPUs: cpus}
}

func gib(b int64) float64 { return float64(b) / float64(GiB) }

func trim(f float64) string {
	if f == math.Trunc(f) {
		return fmt.Sprintf("%d", int64(f))
	}
	return fmt.Sprintf("%.1f", f)
}

func roundUp(f float64) float64 { return math.Ceil(f*2-1e-9) / 2 }

// Check decides whether the pool size fits (R5.58). Order of the checks: the
// floors, the CPU budget, 1.5 GiB per CPU, the memory budget, the Docker
// ceiling. A refusal names the budget that is short and the nearest sizes that
// pass. A size that passes but is below the current one is held until
// ConfirmShrink is true; a shrink is never a side effect.
func Check(in Inputs, r Request) Result {
	memPct, cpuPct := in.BudgetMemPct, in.BudgetCPUPct
	if memPct <= 0 {
		memPct = DefaultMemPc
	}
	if cpuPct <= 0 {
		cpuPct = DefaultCPUPc
	}
	res := Result{
		TotalGiB:         gib(in.TotalBytes),
		UsedOutsideGiB:   gib(in.UsedOutsideBytes),
		DockerCeilingGiB: gib(in.DockerCeilingBytes),
	}
	res.MemBudgetGiB = res.TotalGiB * float64(memPct) / 100
	// The room is the budget less what is used outside WSL and the guests.
	// The WSL VM itself is what the pool becomes, so it is not subtracted.
	res.RoomGiB = res.MemBudgetGiB - res.UsedOutsideGiB - gib(in.GuestBytes)
	if res.RoomGiB < 0 {
		res.RoomGiB = 0
	}
	res.CPUBudget = in.TotalCPUs * cpuPct / 100
	res.Half = Recommend(res.RoomGiB, res.CPUBudget, 0.5)
	res.ThreeQuarters = Recommend(res.RoomGiB, res.CPUBudget, 0.75)
	maxCPUsForMem := int(math.Floor(r.MemGiB/GiBPerCPU + 1e-9))
	refuse := func(short, decided, reason string, nearest ...string) Result {
		res.Short, res.Decided, res.Reason, res.Nearest = short, decided, reason, nearest
		return res
	}
	switch {
	case r.MemGiB < MinGiB || r.CPUs < MinCPUs:
		return refuse("floor", "floor",
			fmt.Sprintf("the pool needs at least %d GiB and %d CPUs", MinGiB, MinCPUs),
			fmt.Sprintf("%d GiB with %d CPUs is the smallest pool", MinGiB, MinCPUs))
	case r.CPUs > res.CPUBudget:
		return refuse("cpu", "CPU budget",
			fmt.Sprintf("%d CPUs is above the CPU budget: %d%% of %d CPUs is %d", r.CPUs, cpuPct, in.TotalCPUs, res.CPUBudget),
			fmt.Sprintf("%d CPUs fits the CPU budget", res.CPUBudget))
	case r.MemGiB > res.RoomGiB:
		near := fmt.Sprintf("%s GiB fits", trim(math.Floor(res.RoomGiB*2)/2))
		if res.RoomGiB >= MinGiB {
			c := int(math.Floor(res.RoomGiB / GiBPerCPU))
			if c > res.CPUBudget {
				c = res.CPUBudget
			}
			near = fmt.Sprintf("%s GiB fits %d CPUs", trim(math.Floor(res.RoomGiB*2)/2), c)
		}
		return refuse("memory", "memory budget",
			fmt.Sprintf("%s GiB is above the memory room: %d%% of %s GiB is %s GiB, less %s GiB used outside WSL and guests leaves %s GiB",
				trim(r.MemGiB), memPct, trim(res.TotalGiB), trim(res.MemBudgetGiB), trim(res.UsedOutsideGiB+gib(in.GuestBytes)), trim(res.RoomGiB)),
			near)
	case float64(r.CPUs)*GiBPerCPU > r.MemGiB+1e-9:
		need := roundUp(float64(r.CPUs) * GiBPerCPU)
		reason := fmt.Sprintf("%s GiB fits %d CPUs; %d CPUs needs %s GiB", trim(r.MemGiB), maxCPUsForMem, r.CPUs, trim(need))
		return refuse("ratio", "1.5 GiB per CPU", reason,
			fmt.Sprintf("%s GiB fits %d CPUs", trim(r.MemGiB), maxCPUsForMem),
			fmt.Sprintf("%d CPUs needs %s GiB", r.CPUs, trim(need)))
	case in.DockerCeilingBytes > 0 && r.MemGiB > res.DockerCeilingGiB:
		return refuse("docker", "Docker ceiling",
			fmt.Sprintf("%s GiB is above what Docker can be given: .wslconfig allows %s GiB", trim(r.MemGiB), trim(res.DockerCeilingGiB)),
			fmt.Sprintf("%s GiB fits under .wslconfig", trim(res.DockerCeilingGiB)))
	}
	res.Decided = "fits"
	shrinks := (r.CurMemGiB > 0 && r.MemGiB < r.CurMemGiB) || (r.CurCPUs > 0 && r.CPUs < r.CurCPUs)
	if shrinks && !r.ConfirmShrink {
		res.NeedsShrinkConfirm = true
		res.Reason = fmt.Sprintf("this lowers the pool from %s GiB and %d CPUs to %s GiB and %d CPUs; confirm to shrink it",
			trim(r.CurMemGiB), r.CurCPUs, trim(r.MemGiB), r.CPUs)
		return res
	}
	res.OK = true
	return res
}
