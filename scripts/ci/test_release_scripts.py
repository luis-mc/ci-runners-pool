import os
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "release-guard.sh")
NOTES = os.path.join(HERE, "release-notes-fallback.sh")
WORKFLOW = os.path.join(HERE, "..", "..", ".github", "workflows", "release.yml")


class Repo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = self.tmp.name
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")
        self.git("config", "commit.gpgsign", "false")

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *a):
        r = subprocess.run(["git", *a], cwd=self.d, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout.strip()

    def commit(self, msg):
        self.git("commit", "-q", "--allow-empty", "-m", msg)
        return self.git("rev-parse", "HEAD")

    def run_script(self, *a):
        return subprocess.run(["bash", *a], cwd=self.d, capture_output=True, text=True)


class Guard(Repo):
    def test_commit_on_main_passes(self):
        sha = self.commit("a")
        self.assertEqual(self.run_script(GUARD, sha, "main").returncode, 0)

    def test_commit_on_unmerged_branch_refused(self):
        self.commit("a")
        self.git("checkout", "-q", "-b", "ops")
        sha = self.commit("unmerged")
        r = self.run_script(GUARD, sha, "main")
        self.assertEqual(r.returncode, 1)
        self.assertIn("not reachable from main", r.stderr)

    def test_missing_main_refused(self):
        sha = self.commit("a")
        r = self.run_script(GUARD, sha, "origin/main")
        self.assertEqual(r.returncode, 1)
        self.assertIn("fetch main first", r.stderr)


class Notes(Repo):
    def notes_file(self, text):
        p = os.path.join(self.d, ".git", "notes.txt")
        with open(p, "w") as f:
            f.write(text)
        return p

    def test_keeps_generated_list(self):
        self.commit("a")
        self.git("tag", "v0.1.0")
        self.commit("b")
        self.git("tag", "v0.1.1")
        r = self.run_script(NOTES, "v0.1.1", self.notes_file("## What's Changed\n* x"))
        self.assertEqual((r.returncode, r.stdout), (0, ""))

    def test_writes_subjects_between_tags(self):
        self.commit("a")
        self.git("tag", "v0.1.0")
        self.commit("fix one")
        self.commit("add two")
        self.git("tag", "v0.1.1")
        r = self.run_script(NOTES, "v0.1.1", self.notes_file("**Full Changelog**: x"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("- add two", r.stdout)
        self.assertIn("- fix one", r.stdout)
        self.assertNotIn("- a\n", r.stdout)
        self.assertIn("since v0.1.0", r.stdout)

    def test_first_release_lists_all(self):
        self.commit("only")
        self.git("tag", "v0.1.0")
        r = self.run_script(NOTES, "v0.1.0", self.notes_file(""))
        self.assertIn("- only", r.stdout)


class Workflow(unittest.TestCase):
    def test_every_job_waits_for_guard(self):
        text = open(WORKFLOW).read()
        self.assertIn("release-guard.sh", text)
        self.assertIn("needs: guard", text)  # version, which build and msi follow
        self.assertIn("needs: [guard, version, build, msi, installers-unix]", text)
        self.assertIn("release-notes-fallback.sh", text)

    def test_release_assets_carry_the_version(self):
        # OPS40 (DL-96): installers and archives are named <name>_<version>.<ext>.
        text = open(WORKFLOW).read()
        self.assertIn('VERSION: ${{ needs.version.outputs.value }}', text)
        for want in (
            'dist/crsp-${target}_${VERSION}.zip',
            'dist/crsp-${target}_${VERSION}.tar.gz',
            'dist/crsp-windows-${arch}_${VERSION}.msi',
            'dist/${base%.*}_${VERSION}.${base##*.}',
        ):
            self.assertIn(want, text)
        # The CI artifacts keep their stable names (artifact-prune, DL-22).
        self.assertIn("name: msi-windows-${{ matrix.goarch }}", text)
        self.assertIn("name: pkg-${{ matrix.os }}-${{ matrix.arch }}", text)

    def test_version_rename_of_native_installers(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "pkgs", "pkg-linux-amd64"))
            os.makedirs(os.path.join(d, "dist"))
            for n in ("crsp-linux-amd64.deb", "crsp-linux-amd64.rpm"):
                open(os.path.join(d, "pkgs", "pkg-linux-amd64", n), "w").close()
            script = (
                'VERSION=0.1.15; for f in pkgs/*/crsp-*; do base="$(basename "$f")"; '
                'cp "$f" "dist/${base%.*}_${VERSION}.${base##*.}"; done; ls dist'
            )
            r = subprocess.run(["bash", "-c", script], cwd=d, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(
                r.stdout.split(), ["crsp-linux-amd64_0.1.15.deb", "crsp-linux-amd64_0.1.15.rpm"]
            )


if __name__ == "__main__":
    unittest.main()
