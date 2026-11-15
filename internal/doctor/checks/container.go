package checks

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/container"
	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
)

// The container checks of the doctor (R5.31): the engine answers, the image is
// current, each tool of each layer is found in the image, the tool cache is
// writable by the job user, and the pool settings and runner records agree.
// They live in this file only (and its test) so they do not touch the M1 files.
// Port of `pool.<name>.files-current`, `pool.<name>.layer-*` (dev-standards
// test_dl149_pool_layers.py, test_doctor.py).

// M2 is the milestone of the container checks.
const M2 = 2

// probeTimeout bounds one engine call. A probe that does not answer is a
// warning (cannot probe), never a failure.
const probeTimeout = 60 * time.Second

// ContainerPool is one pool of container runners on one machine, as the
// container checks read it.
type ContainerPool struct {
	Name                   string
	MachineID, MachineName string
	// Image is the image reference of the pool; ImageKey is the key its
	// declared layers and pinned versions give (runners R5.33).
	Image    string
	ImageKey string
	// Layers are the declared layers; "base" is always checked.
	Layers []string
	// CacheDir is the host folder mounted as the tool cache; JobUser is the
	// user the job runs as inside the container ("uid:gid" or a name).
	CacheDir string
	JobUser  string
	// DeclaredRunners is what the pool settings say; RecordedRunners is what
	// the runner records hold.
	DeclaredRunners, RecordedRunners int
}

// ContainerSource gives the container checks their data. Engine returns the
// engine of a machine through its agent, or doctor.ErrUnreachable.
type ContainerSource interface {
	Pools(ctx context.Context) ([]ContainerPool, error)
	Engine(ctx context.Context, machineID string) (container.Engine, error)
}

// RegisterContainer adds the container checks. The agent wiring of src is the
// pool lifecycle (runners R5.31 to R5.33), a later wave.
func RegisterContainer(reg *doctor.Registry, src ContainerSource) {
	c := &containerChecks{src: src}
	for _, k := range []doctor.Check{
		doctor.NewCheck("container.engine", doctor.GroupBackend, M2, false, c.engine),
		doctor.NewCheck("container.image.current", doctor.GroupBackend, M2, false, c.imageCurrent),
		doctor.NewCheck("container.layer.tools", doctor.GroupBackend, M2, false, c.layerTools),
		doctor.NewCheck("container.toolcache", doctor.GroupBackend, M2, false, c.toolCache),
		doctor.NewCheck("container.records", doctor.GroupBackend, M2, false, c.records),
	} {
		reg.Register(k)
	}
}

type containerChecks struct{ src ContainerSource }

func poolSubject(p ContainerPool) doctor.Subject {
	return doctor.Subject{Kind: "pool", ID: p.MachineID + ":" + p.Name, Name: p.Name + " on " + p.MachineName}
}

func machineSubjectOf(p ContainerPool) doctor.Subject {
	return doctor.Subject{Kind: "machine", ID: p.MachineID, Name: p.MachineName}
}

func cannotProbe(check string, s doctor.Subject, what, why string) doctor.Finding {
	return doctor.Finding{Check: check, Subject: s, Severity: doctor.Warn, Title: what + ": cannot probe",
		Detail: why + " The probe could not run, so nothing is known about it.",
		Fix:    doctor.Fix{Text: "Check that the container engine answers, then run the doctor again.", Command: "crsp doctor --check container.engine"}}
}

func (c *containerChecks) pools(ctx context.Context, env doctor.Env, check string) ([]ContainerPool, []doctor.Finding) {
	ps, err := c.src.Pools(ctx)
	if err != nil {
		return nil, []doctor.Finding{skipFor(check, controllerSubject, "The container pools", err)}
	}
	var out []ContainerPool
	for _, p := range ps {
		if env.Scope.MatchMachine(p.MachineID, p.MachineName) {
			out = append(out, p)
		}
	}
	return out, nil
}

// engineOf returns a usable engine of the pool's machine, or the finding that
// says why not (skip: unreachable; warn: the engine cannot be read).
func (c *containerChecks) engineOf(ctx context.Context, p ContainerPool, check string, s doctor.Subject, what string) (container.Engine, *doctor.Finding) {
	eng, err := c.src.Engine(ctx, p.MachineID)
	if err != nil {
		f := skipFor(check, s, "The container engine of "+p.MachineName, err)
		return nil, &f
	}
	pctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	st, err := eng.Detect(pctx)
	if err != nil {
		f := cannotProbe(check, s, what, "The engine could not be read ("+err.Error()+").")
		return nil, &f
	}
	if !st.Usable {
		f := cannotProbe(check, s, what, "The container engine is not usable: "+st.Reason+".")
		return nil, &f
	}
	return eng, nil
}

// engine: the engine answers on each machine that has a container pool.
func (c *containerChecks) engine(ctx context.Context, env doctor.Env) []doctor.Finding {
	ps, out := c.pools(ctx, env, "container.engine")
	seen := map[string]bool{}
	for _, p := range ps {
		if seen[p.MachineID] {
			continue
		}
		seen[p.MachineID] = true
		s := machineSubjectOf(p)
		eng, err := c.src.Engine(ctx, p.MachineID)
		if err != nil {
			out = append(out, skipFor("container.engine", s, "The container engine of "+p.MachineName, err))
			continue
		}
		pctx, cancel := context.WithTimeout(ctx, probeTimeout)
		st, derr := eng.Detect(pctx)
		cancel()
		switch {
		case derr != nil:
			out = append(out, cannotProbe("container.engine", s, "The container engine", "The engine could not be read ("+derr.Error()+")."))
		case !st.Usable:
			out = append(out, doctor.Finding{Check: "container.engine", Subject: s, Severity: doctor.Fail,
				Title: "The container engine does not answer", Detail: st.Reason + ".",
				Fix: doctor.Fix{Text: "Start or install the container engine. Container runners need it.", Link: machineLink(doctor.Machine{ID: p.MachineID})}})
		default:
			out = append(out, doctor.Finding{Check: "container.engine", Subject: s, Severity: doctor.OK,
				Title: "The container engine answers", Detail: fmt.Sprintf("Docker %s through %s.", st.Version, st.Route)})
		}
	}
	return out
}

// imageCurrent: the image of each pool carries the key of the declared layers
// and pinned versions (port of `files-current`).
func (c *containerChecks) imageCurrent(ctx context.Context, env doctor.Env) []doctor.Finding {
	ps, out := c.pools(ctx, env, "container.image.current")
	for _, p := range ps {
		s := poolSubject(p)
		eng, bad := c.engineOf(ctx, p, "container.image.current", s, "The image of "+p.Name)
		if bad != nil {
			out = append(out, *bad)
			continue
		}
		pctx, cancel := context.WithTimeout(ctx, probeTimeout)
		res, err := eng.Run(pctx, "image", "inspect", "--format", `{{index .Config.Labels "`+container.ImageKeyLabel+`"}}`, p.Image)
		cancel()
		switch {
		case err != nil:
			out = append(out, cannotProbe("container.image.current", s, "The image of "+p.Name, "The engine call failed ("+firstLineOf(err.Error())+")."))
		case res.ExitCode != 0 && strings.Contains(strings.ToLower(res.Stderr), "no such image"):
			out = append(out, doctor.Finding{Check: "container.image.current", Subject: s, Severity: doctor.Fail,
				Title: "The image of " + p.Name + " is not built", Detail: p.Image + " is not on " + p.MachineName + ".",
				Fix: doctor.Fix{Text: "Build the image for this pool.", Command: "crsp images build " + p.Name}})
		case res.ExitCode != 0:
			out = append(out, cannotProbe("container.image.current", s, "The image of "+p.Name, "The engine said: "+firstLineOf(res.Stderr)+"."))
		case strings.TrimSpace(res.Stdout) != p.ImageKey:
			out = append(out, doctor.Finding{Check: "container.image.current", Subject: s, Severity: doctor.Fail,
				Title: "The image of " + p.Name + " is out of date", Detail: "The image was built from another set of layers or pinned versions than the pool declares now.",
				Fix: doctor.Fix{Text: "Rebuild the image for this pool.", Command: "crsp images build " + p.Name}})
		default:
			out = append(out, doctor.Finding{Check: "container.image.current", Subject: s, Severity: doctor.OK,
				Title: "The image of " + p.Name + " is current"})
		}
	}
	return out
}

// layerScript prints `ok <tool>` or `missing <tool>` for each tool and `done` last.
func layerScript(tools []string) string {
	var b strings.Builder
	for _, t := range tools {
		if strings.HasPrefix(t, "$") {
			v := strings.TrimPrefix(t, "$")
			fmt.Fprintf(&b, `if [ -n "${%s:-}" ] && [ -d "${%s}" ]; then echo "ok %s"; else echo "missing %s"; fi; `, v, v, t, t)
			continue
		}
		fmt.Fprintf(&b, `if command -v %s >/dev/null 2>&1; then echo "ok %s"; else echo "missing %s"; fi; `, shellWord(t), t, t)
	}
	b.WriteString("echo done")
	return b.String()
}

func shellWord(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }

// layerTools: each tool of each declared layer (and base) is found in the
// image. A tool the probe ran and did not find is fail; a probe that could not
// run is warn (port of `layer-*`).
func (c *containerChecks) layerTools(ctx context.Context, env doctor.Env) []doctor.Finding {
	ps, out := c.pools(ctx, env, "container.layer.tools")
	for _, p := range ps {
		eng, bad := c.engineOf(ctx, p, "container.layer.tools", poolSubject(p), "The tools of "+p.Name)
		if bad != nil {
			out = append(out, *bad)
			continue
		}
		names := append([]string{"base"}, p.Layers...)
		seen := map[string]bool{}
		for _, name := range names {
			if seen[name] {
				continue
			}
			seen[name] = true
			s := doctor.Subject{Kind: "pool_layer", ID: p.MachineID + ":" + p.Name + ":" + name, Name: p.Name + " layer " + name}
			tools, known := container.LayerTools(name)
			if !known {
				out = append(out, doctor.Finding{Check: "container.layer.tools", Subject: s, Severity: doctor.Fail,
					Title: "The layer " + name + " is not known", Detail: "Known layers: " + strings.Join(container.LayerNames(), ", ") + ".",
					Fix: doctor.Fix{Text: "Remove the layer from the pool settings or fix its name."}})
				continue
			}
			out = append(out, probeLayer(ctx, eng, p, s, name, tools))
		}
	}
	return out
}

func probeLayer(ctx context.Context, eng container.Engine, p ContainerPool, s doctor.Subject, name string, tools []string) doctor.Finding {
	pctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	res, err := eng.Run(pctx, "run", "--rm", "--entrypoint", "sh", p.Image, "-c", layerScript(tools))
	what := "The tools of layer " + name
	switch {
	case err != nil:
		return cannotProbe("container.layer.tools", s, what, "The engine call failed ("+firstLineOf(err.Error())+").")
	case !strings.Contains(res.Stdout, "done"):
		why := "The probe did not finish"
		if res.Stderr != "" {
			why += ": " + firstLineOf(res.Stderr)
		}
		return cannotProbe("container.layer.tools", s, what, why+".")
	}
	var missing []string
	for _, line := range strings.Split(res.Stdout, "\n") {
		if t, ok := strings.CutPrefix(strings.TrimSpace(line), "missing "); ok {
			missing = append(missing, t)
		}
	}
	if len(missing) > 0 {
		return doctor.Finding{Check: "container.layer.tools", Subject: s, Severity: doctor.Fail,
			Title: "The image of " + p.Name + " lacks tools of layer " + name, Detail: "Not found in the image: " + strings.Join(missing, ", ") + ".",
			Fix: doctor.Fix{Text: "Rebuild the image for this pool.", Command: "crsp images build " + p.Name}}
	}
	return doctor.Finding{Check: "container.layer.tools", Subject: s, Severity: doctor.OK, Title: "Every tool of layer " + name + " is in the image of " + p.Name}
}

// toolCache: the job user can write the tool cache folder inside a container.
func (c *containerChecks) toolCache(ctx context.Context, env doctor.Env) []doctor.Finding {
	ps, out := c.pools(ctx, env, "container.toolcache")
	for _, p := range ps {
		s := poolSubject(p)
		eng, bad := c.engineOf(ctx, p, "container.toolcache", s, "The tool cache of "+p.Name)
		if bad != nil {
			out = append(out, *bad)
			continue
		}
		args := []string{"run", "--rm", "--entrypoint", "sh"}
		if p.JobUser != "" {
			args = append(args, "--user", p.JobUser)
		}
		args = append(args, "--mount", "type=bind,source="+p.CacheDir+",target="+container.LaneInside.Tools, p.Image, "-c",
			`if touch `+container.LaneInside.Tools+`/.crsp-doctor 2>/dev/null && rm -f `+container.LaneInside.Tools+`/.crsp-doctor; then echo writable; else echo not-writable; fi`)
		pctx, cancel := context.WithTimeout(ctx, probeTimeout)
		res, err := eng.Run(pctx, args...)
		cancel()
		switch {
		case err != nil:
			out = append(out, cannotProbe("container.toolcache", s, "The tool cache of "+p.Name, "The engine call failed ("+firstLineOf(err.Error())+")."))
		case res.ExitCode == 0 && strings.Contains(res.Stdout, "not-writable"):
			out = append(out, doctor.Finding{Check: "container.toolcache", Subject: s, Severity: doctor.Fail,
				Title: "The tool cache of " + p.Name + " cannot be written", Detail: "The job user " + p.JobUser + " cannot create a file in " + p.CacheDir + " on " + p.MachineName + ". Jobs would download every tool again, or fail.",
				Fix: doctor.Fix{Text: "Give the job user write access to the folder, or let the agent make it again.", Command: "crsp pool repair-cache " + p.Name}})
		case res.ExitCode == 0 && strings.Contains(res.Stdout, "writable"):
			out = append(out, doctor.Finding{Check: "container.toolcache", Subject: s, Severity: doctor.OK, Title: "The tool cache of " + p.Name + " is writable"})
		default:
			out = append(out, cannotProbe("container.toolcache", s, "The tool cache of "+p.Name, "The engine said: "+firstLineOf(res.Stderr)+"."))
		}
	}
	return out
}

// records: the pool settings and the runner records agree.
func (c *containerChecks) records(ctx context.Context, env doctor.Env) []doctor.Finding {
	ps, out := c.pools(ctx, env, "container.records")
	for _, p := range ps {
		s := poolSubject(p)
		if p.DeclaredRunners == p.RecordedRunners {
			out = append(out, doctor.Finding{Check: "container.records", Subject: s, Severity: doctor.OK, Title: "The settings and records of " + p.Name + " agree"})
			continue
		}
		out = append(out, doctor.Finding{Check: "container.records", Subject: s, Severity: doctor.Warn,
			Title:  "The settings and records of " + p.Name + " differ",
			Detail: fmt.Sprintf("The pool says %d runners; %d are recorded.", p.DeclaredRunners, p.RecordedRunners),
			Fix:    doctor.Fix{Text: "Apply the pool settings again so the runners match.", Command: "crsp pool apply " + p.Name}})
	}
	return out
}

func firstLineOf(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	if s == "" {
		return "no message"
	}
	return s
}
