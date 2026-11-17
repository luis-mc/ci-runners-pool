package api

import (
	"context"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/webhookhealth"
)

// WebhookHealth is what the console reads about a repository's webhook
// deliveries (github-integration R5.50). *webhookhealth.Tracker implements it.
type WebhookHealth interface {
	Get(fullName string) webhookhealth.State
	SwitchBack(fullName string) webhookhealth.State
	WebhooksOff() bool
}

var _ WebhookHealth = (*webhookhealth.Tracker)(nil)

func toWebhookHealth(st webhookhealth.State) gen.WebhookHealth {
	out := gen.WebhookHealth{Mode: gen.WebhookHealthMode(st.Mode), FailuresInARow: st.Failures}
	if !st.LastAt.IsZero() {
		at := st.LastAt
		res := gen.WebhookHealthLastResult(st.Last)
		out.LastDeliveryAt, out.LastResult = &at, &res
	}
	if !st.SwitchedAt.IsZero() {
		at := st.SwitchedAt
		out.PollingSince = &at
	}
	return out
}

// withHealth adds the webhook health to a repository when the area has it.
func (s *server) withHealth(r gen.Repository) gen.Repository {
	a := s.ghArea()
	if a == nil || a.Health == nil {
		return r
	}
	h := toWebhookHealth(a.Health.Get(r.FullName))
	if a.Health.WebhooksOff() {
		off := true
		h.WebhooksOff = &off
	}
	r.Webhook = &h
	return r
}

// SetRepositoryWebhookMode implements PUT /api/v1/repositories/{repositoryId}/webhook-mode.
func (s *server) SetRepositoryWebhookMode(ctx context.Context, req gen.SetRepositoryWebhookModeRequestObject) (gen.SetRepositoryWebhookModeResponseObject, error) {
	fail := func(err error) (gen.SetRepositoryWebhookModeResponseObject, error) {
		code, body := failure(err)
		return gen.SetRepositoryWebhookModedefaultJSONResponse{StatusCode: code, Body: body}, nil
	}
	a := s.ghArea()
	if a == nil || a.Health == nil {
		return gen.SetRepositoryWebhookModedefaultJSONResponse{StatusCode: 501, Body: notImplemented()}, nil
	}
	if req.Body == nil || req.Body.Mode != gen.WebhookModeUpdateModeWebhook {
		return fail(auth.Invalid("only the webhook mode can be chosen"))
	}
	v, err := a.Repos.Get(ctx, s.principal(ctx), req.RepositoryId)
	if err != nil {
		return fail(err)
	}
	return gen.SetRepositoryWebhookMode200JSONResponse(toWebhookHealth(a.Health.SwitchBack(v.FullName))), nil
}
