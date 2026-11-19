package keys

import (
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/addresses"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry"
)

// The labels and OCI annotations of every image (registry R5.7).
const (
	LabelRevision   = "org.opencontainers.image.revision"
	LabelSource     = "org.opencontainers.image.source"
	LabelBaseName   = "org.opencontainers.image.base.name"
	LabelBaseDigest = "org.opencontainers.image.base.digest"
	LabelProfile    = "io.crsp.profile"
	LabelLineage    = "io.crsp.lineage"
	LabelStackHash  = "io.crsp.stack-hash"
	LabelKey        = "io.crsp.key"
)

// StdLineageRepo stands for the repository in the lineage of a standard
// image, which belongs to no repository.
const StdLineageRepo = "std"

// Lineage is the value of io.crsp.lineage: repository, profile and arch joined
// by "|". A standard image has no repository and uses StdLineageRepo.
func Lineage(repository, profile, arch string) string {
	if repository == "" {
		repository = StdLineageRepo
	}
	return repository + "|" + profile + "|" + registry.OCIArch(arch)
}

// ParseLineage splits a lineage value; ok is false for anything else. The
// repository of a standard image comes back as "".
func ParseLineage(s string) (repository, profile, arch string, ok bool) {
	p := strings.Split(s, "|")
	if len(p) != 3 || p[0] == "" || p[1] == "" || (p[2] != "amd64" && p[2] != "arm64") {
		return "", "", "", false
	}
	if p[0] == StdLineageRepo {
		p[0] = ""
	}
	return p[0], p[1], p[2], true
}

// LabelsFor returns the labels every image of the key carries (R5.7). repository
// is owner/name of the run ("" for a standard image), commit the run's commit;
// site gives the GitHub address the source label points at.
// REG1 checks them again at promotion against the key input.
func LabelsFor(key registry.Key, in registry.KeyInput, ref registry.ProfileRef, site addresses.Set, repository, commit string) map[string]string {
	source := ""
	if repository != "" {
		source = site.RepoPage(repository)
	}
	return map[string]string{
		LabelRevision:   commit,
		LabelSource:     source,
		LabelBaseName:   ref.BaseName,
		LabelBaseDigest: in.BaseDigest,
		LabelProfile:    in.Profile,
		LabelLineage:    Lineage(repository, in.Profile, in.Arch),
		LabelStackHash:  in.StackHash,
		LabelKey:        key.String(),
	}
}
