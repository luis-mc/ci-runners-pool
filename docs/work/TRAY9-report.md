# TRAY9 report

**Cause.** The 0.1.17 update left a stage file `done` (0.1.17). `WindowMode` returned `live` for any done stage, and `Model.State` trusts any stage in ModeLive, so the window showed Done 0.1.17 and never offered 0.1.18. Also the Review heading read the stage's version before the offer.

**Fix.**
- `internal/tray/update_native.go` WindowMode: done is live only when no newer release than the stage version (fallback: running version) is known; otherwise review.
- `internal/updatewindow/model.go`: a done stage whose version equals From while To is newer is a leftover (never Done; falls to Review, or Downloading after Update now). Review heading uses To, not the stage version.
- Failed path: a failed stage is already review in WindowMode and ignored in ModeReview; covered by tests, no change needed.
- Toast/automatic path: real done 0.1.18 (Latest 0.1.18) is still live and Done; tested.

**Tests.** `TestWindowModeTable` (8), `TestLeftoverDoneStageTable` (7 + request flow). tray + updatewindow pass (~1 s), vet clean, golangci-lint 0 issues, GOOS=windows build ok. fast_guards: secret-scan fails only because gitleaks is not installed here.
