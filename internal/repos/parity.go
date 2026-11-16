package repos

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// Names the parity workflow reads (CRSP134). None ends in _KEY, _TOKEN,
// _SECRET or _PASS (the owner's naming rule). CRSP_ACCESS is a repository
// secret; the other two are repository variables.
const (
	ParitySecretName     = "CRSP_ACCESS"
	ParityVarURL         = "CRSP_URL"
	ParityVarFingerprint = "CRSP_CA_FINGERPRINT"
)

// parityPermissions are the App permissions the setup needs, by GitHub's name.
var parityPermissions = []string{"secrets", "actions_variables"}

// SecretWriter writes a repository Actions secret. The GitHub adapter
// implements it; a repository service built on a narrower GitHub keeps
// working and answers that the setup is not available.
type SecretWriter interface {
	SetSecret(ctx context.Context, installationID int64, owner, repo, name, value string) error
}

// ParityInput is what the setup needs from the controller.
type ParityInput struct {
	// ControllerURL and CAFingerprint go to the repository variables.
	ControllerURL string
	CAFingerprint string
	// App describes the GitHub App, for the pages that grant a permission.
	AppSlug       string
	AppOwnerLogin string
	AppOwnerType  string
	// Issue makes the parity credential; it returns the value once and the id.
	Issue func(ctx context.Context) (value, id string, err error)
	// Revoke undoes Issue when the writes fail, so no credential is left that
	// nobody holds.
	Revoke func(ctx context.Context, id string) error
}

// ParityResult is the outcome. When MissingPermissions is not empty nothing
// was made and nothing was written: the owner grants the permission on the
// named GitHub pages and runs the action again.
type ParityResult struct {
	Done               bool
	MissingPermissions []string
	AppPermissionsURL  string
	InstallationURL    string
	SecretName         string
	VariableNames      []string
	CredentialID       string
}

// ErrParityUnavailable: the GitHub adapter cannot write secrets in this build.
var ErrParityUnavailable = errors.New("the GitHub adapter of this build cannot write repository secrets")

// grantPages names the two GitHub pages that grant an App permission: the
// App's permissions page (the App's owner changes the request), then the
// installation page (the installation's owner accepts it).
func grantPages(in ParityInput, ins Installation) (appURL, installURL string) {
	slug := url.PathEscape(in.AppSlug)
	if strings.EqualFold(in.AppOwnerType, "Organization") && in.AppOwnerLogin != "" {
		appURL = "https://github.com/organizations/" + url.PathEscape(in.AppOwnerLogin) + "/settings/apps/" + slug + "/permissions"
	} else {
		appURL = "https://github.com/settings/apps/" + slug + "/permissions"
	}
	if strings.EqualFold(ins.AccountType, "Organization") && ins.AccountLogin != "" {
		installURL = fmt.Sprintf("https://github.com/organizations/%s/settings/installations/%d", url.PathEscape(ins.AccountLogin), ins.ID)
	} else {
		installURL = fmt.Sprintf("https://github.com/settings/installations/%d", ins.ID)
	}
	return appURL, installURL
}

// freshInstallation reads the installation's permissions from GitHub, so a
// permission the owner just granted counts at once; when GitHub cannot be
// reached it uses the stored copy.
func (s *Service) freshInstallation(ctx context.Context, id int64) (Installation, error) {
	stored, err := s.installation(ctx, id)
	if err != nil {
		return Installation{}, err
	}
	live, err := s.cfg.GitHub.ListAppInstallations(ctx)
	if err != nil {
		return stored, nil
	}
	for _, i := range live {
		if i.ID == id {
			return toInstallation(i), nil
		}
	}
	return stored, nil
}

// SetupParity writes what `crsp parity check` needs into a repository: the
// access credential as the Actions secret CRSP_ACCESS, and the controller
// address and CA fingerprint as the variables CRSP_URL and CRSP_CA_FINGERPRINT.
// The owner copies nothing. The permission is checked first; with a permission
// missing nothing is made (R5.84).
func (s *Service) SetupParity(ctx context.Context, p auth.Principal, repoID int64, in ParityInput) (ParityResult, error) {
	if err := auth.Require(p, auth.RoleAdmin); err != nil {
		return ParityResult{}, err
	}
	r, err := s.cfg.Store.GetRepository(ctx, repoID)
	if err != nil {
		return ParityResult{}, err
	}
	if err := s.requireGitHubAdmin(ctx, p, r); err != nil {
		return ParityResult{}, err
	}
	sw, ok := s.cfg.GitHub.(SecretWriter)
	if !ok {
		return ParityResult{}, ErrParityUnavailable
	}
	if in.ControllerURL == "" || in.CAFingerprint == "" || in.Issue == nil {
		return ParityResult{}, auth.Invalid("the controller address and its certificate fingerprint are not known")
	}
	ins, err := s.freshInstallation(ctx, r.InstallationID)
	if err != nil {
		return ParityResult{}, err
	}
	if missing := missingParity(ins.Permissions); len(missing) > 0 {
		res := ParityResult{MissingPermissions: missing}
		res.AppPermissionsURL, res.InstallationURL = grantPages(in, ins)
		s.cfg.Audit.Audit(ctx, p, "parity.needs_permission", "repository", r.FullName, "missing: "+strings.Join(missing, ", "))
		return res, nil
	}
	value, id, err := in.Issue(ctx)
	if err != nil {
		return ParityResult{}, err
	}
	// The value is sealed to the repository's key inside SetSecret and goes
	// nowhere else: not to the audit, not to a log, not to an error.
	undo := func(cause error) (ParityResult, error) {
		if in.Revoke != nil {
			if rerr := in.Revoke(ctx, id); rerr != nil {
				cause = errors.Join(cause, fmt.Errorf("the new credential could not be revoked: %w", rerr))
			}
		}
		s.cfg.Audit.Audit(ctx, p, "parity.setup_failed", "repository", r.FullName, "the writes to GitHub failed")
		return ParityResult{}, cause
	}
	if err := sw.SetSecret(ctx, r.InstallationID, r.Owner, r.Name, ParitySecretName, value); err != nil {
		return undo(fmt.Errorf("writing the secret %s: %w", ParitySecretName, err))
	}
	for _, v := range []github.Variable{{Name: ParityVarURL, Value: in.ControllerURL}, {Name: ParityVarFingerprint, Value: in.CAFingerprint}} {
		if err := s.cfg.GitHub.SetVariable(ctx, r.InstallationID, r.Owner, r.Name, v); err != nil {
			return undo(fmt.Errorf("writing the variable %s: %w", v.Name, err))
		}
	}
	names := []string{ParityVarURL, ParityVarFingerprint}
	sort.Strings(names)
	s.cfg.Audit.Audit(ctx, p, "parity.setup", "repository", r.FullName,
		"secret "+ParitySecretName+", variables "+strings.Join(names, ", ")+", credential "+id)
	return ParityResult{Done: true, SecretName: ParitySecretName, VariableNames: names, CredentialID: id}, nil
}

// missingParity names each parity permission the installation does not hold at
// write. The shared table (R5.23) does not list `secrets`, because every other
// feature works without it.
func missingParity(granted map[string]string) []string {
	var missing []string
	for _, n := range parityPermissions {
		if g := granted[n]; g != "write" && g != "admin" {
			missing = append(missing, n)
		}
	}
	return missing
}
