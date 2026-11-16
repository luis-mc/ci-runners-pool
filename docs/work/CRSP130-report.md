# CRSP130 report

Branch CRSP130-release-guard. Change: release.yml `guard` job (tag must be on origin/main, before build/upload); `publish` job notes fallback from commit subjects. Scripts: scripts/ci/release-guard.sh, release-notes-fallback.sh; tests: scripts/ci/test_release_scripts.py (15 unittest pass locally). Docs: operations R5.46, test row, change note.
Not run: actionlint, yamllint, docs_check.py, docs_fold.py (not installed here); change note written by hand in the same format as CRSP90.md. YAML parsed with PyYAML.
Nothing tagged or released.
