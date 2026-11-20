
- Joined: CRSP209, CRSP213, CRSP216, CRSP210, TRAY9, LOOK40 (conflicts in design-system next-version resolved by hand), CIX11-22. CIX-integration was contained in every CIX branch.

## Join result
- All 6 group-1 branches and CIX11 to CIX22 joined. Hand-resolved: LOOK40 (design-system next-version: v3 UX-72 wording kept, CRSP210 guard and two entries kept as C1, C2; review visuals rebuilt), CIX12/13/14/15/16/17/18/19/20/21 spec.md test tables (both sides' test names kept, `planned:` dropped where a branch has the test), generated docs rebuilt with docs_index.py.
- `go tool task codegen` after every CIX branch: no file changed.
- Join interaction fixed: import cycle reconcile -> collect -> store/github -> reconcile (CIX13 vs CIX12). Budget and Priority moved to leaf package internal/insights/share; collect aliases them.
- Lint fixes: 2 errcheck, 2 staticcheck in CIX code; gofmt of actions_test.go; prettier on 6 CI files.
- mock.ts NOT removed: wiring 14 hooks in screens/insights/api.ts to the generated client and moving the data into the api-mock of 6 test files is more than an hour. It rides the next release.
- G2: every job in .github/workflows/*.yml already has timeout-minutes (fast_guards G2 PASS).
- Release fold NOT run: main holds 500+ unfolded change notes from earlier releases; folding now would rewrite every feature spec. Notes stay pending.
- fast_guards: only secret-scan fails here (gitleaks is not installed in this sandbox, exit 127). G1/G4/G5 list breaks (informational).
