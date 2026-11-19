"""Keep media permission scoped to reviewed paths and immutable source bytes."""
import hashlib
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import stage_public as policy


class MediaBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="pages-media-policy-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.media = "DeepFamily/media/clan-film.mobile.mp4"
        self.paths = set(policy.REQUIRED) | {
            "DeepFamily/_next/test.js", "DeepFamily/_next/test.css", self.media,
        }
        for name in self.paths:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b"public test fixture")
        self.entries = {name: ("100644", "fixture-blob") for name in self.paths}
        self.config = {
            "files": sorted(policy.REQUIRED),
            "static_trees": {"DeepFamily": [".html", ".png", ".js", ".css"]},
            "approved_media": {self.media: hashlib.sha256(b"public test fixture").hexdigest()},
        }
        self.manifest = self.root / "manifest.json"
        self.addCleanup(patch.stopall)
        patch.object(policy, "ROOT", self.root).start()
        patch.object(policy, "MANIFEST", self.manifest).start()

    def select(self):
        self.manifest.write_text(json.dumps(self.config))
        return policy.selected_files(self.entries)

    def test_accepts_exact_reviewed_media_with_matching_hash(self):
        self.assertIn(self.media, self.select())

    def test_rejects_another_mp4_without_expanding_type_policy(self):
        self.entries["DeepFamily/media/unapproved.mp4"] = ("100644", "fixture-blob")
        with self.assertRaisesRegex(ValueError, "Unexpected static-tree file"):
            self.select()

    def test_rejects_changed_approved_media_bytes(self):
        (self.root / self.media).write_bytes(b"unreviewed replacement")
        with self.assertRaisesRegex(ValueError, "Approved media hash mismatch"):
            self.select()

    def test_rejects_an_untracked_media_approval(self):
        self.config["approved_media"]["DeepFamily/media/missing.vtt"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "absent from tracked static tree"):
            self.select()

    def test_rejects_media_outside_the_deepfamily_media_directory(self):
        self.config["approved_media"]["other/film.mp4"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "Invalid approved media path"):
            self.select()

    def test_preserves_existing_private_path_and_secret_rejections(self):
        for name in [".git/config", "DeepFamily/.env", "../secret.mp4", "DeepFamily/private.key"]:
            with self.assertRaises(ValueError):
                policy.safe_path(name)
        with self.assertRaisesRegex(ValueError, "Potential private credential"):
            policy.scan_content("fixture.txt", b"-----BEGIN PRIVATE KEY-----")

    def test_only_dfplan_runtime_mjs_gets_a_source_path_exception(self):
        for name in ["dfplan/src/app.mjs", "dfplan/src/domain/task-schema.mjs", "dfplan/src/ui/views/list.mjs"]:
            policy.safe_path(name)
        for name in ["other/src/app.mjs", "dfplan/src/app.js", "dfplan/src/tests/private.mjs", "dfplan/src/ui/.env", "dfplan/src/ui/private.key", "dfplan/src/backend/app.mjs"]:
            with self.assertRaises(ValueError):
                policy.safe_path(name)

    def test_runtime_directory_entries_are_allowed_only_as_directories(self):
        for name in ["dfplan/src", "dfplan/src/ui", "dfplan/src/ui/views", "dfplan/src/domain"]:
            policy.safe_path(name, directory=True)
            with self.assertRaises(ValueError):
                policy.safe_path(name)
        for name in ["dfplan/src/tests", "dfplan/src/.git", "other/src"]:
            with self.assertRaises(ValueError):
                policy.safe_path(name, directory=True)

    def test_rejects_case_conflicting_dfplan_source(self):
        self.entries["DFplan/index.html"] = ("100644", "fixture-blob")
        with self.assertRaisesRegex(ValueError, "source paths must use lowercase"):
            self.select()


class RedirectBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="pages-redirect-policy-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.manifest = self.root / "manifest.json"
        self.source = policy.GENERATED_FILES["DFplan/index.html"]
        template = self.root / self.source
        template.parent.mkdir(parents=True)
        template.write_text("legacy redirect")
        self.entries = {self.source: ("100644", "fixture-blob")}
        self.manifest.write_text(json.dumps({"generated_files": policy.GENERATED_FILES}))
        self.addCleanup(patch.stopall)
        patch.object(policy, "ROOT", self.root).start()
        patch.object(policy, "MANIFEST", self.manifest).start()

    def test_only_reviewed_tracked_template_generates_legacy_url(self):
        self.assertEqual(policy.generated_files(self.entries, ["dfplan/index.html"]), policy.GENERATED_FILES)
        with self.assertRaisesRegex(ValueError, "tracked regular template"):
            policy.generated_files({}, ["dfplan/index.html"])

    def test_output_rejects_case_insensitive_filesystem_before_copying(self):
        (self.root / "case-probe").mkdir()
        output = self.root / "site"
        if (self.root / "CASE-PROBE").exists():
            with self.assertRaisesRegex(ValueError, "case-sensitive filesystem"):
                policy.prepare_output(output)
        else:
            policy.prepare_output(output)
            self.assertFalse((output / "DFplan").exists())
        self.assertEqual(list((output / "dfplan").iterdir()), [])

    def test_rejects_private_source_mapping_or_duplicate_destination(self):
        with self.assertRaisesRegex(ValueError, "also selected as source"):
            policy.generated_files(self.entries, list(policy.DFPLAN_REQUIRED))
        self.manifest.write_text(json.dumps({"generated_files": {"DFplan/index.html": "dfplan-backend/firestore.rules"}}))
        with self.assertRaisesRegex(ValueError, "Unexpected generated"):
            policy.generated_files(self.entries, ["dfplan/index.html"])

    def audit(self, extra=None, corrupt=False):
        contents = {name: name.encode() for name in policy.REQUIRED | policy.DFPLAN_REQUIRED}
        report = self.root / "audit.json"
        report.write_text(json.dumps({"generated_files": policy.GENERATED_FILES,
                                     "files": {name: policy.sha256(data) for name, data in contents.items()}}))
        if corrupt:
            contents["DFplan/index.html"] = b"overwritten by application"
        if extra:
            contents[extra] = b"must not be public"
        archive = self.root / "artifact.tar"
        with tarfile.open(archive, "w") as tar:
            for name, data in contents.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
        policy.audit_tar(archive, report)

    def test_audit_preserves_distinct_case_sensitive_urls_and_hashes(self):
        self.audit()
        with self.assertRaisesRegex(ValueError, "files/hashes differ"):
            self.audit(corrupt=True)

    def test_audit_rejects_backend_and_template_sources(self):
        for name in ["dfplan-backend/firestore.rules", self.source, "DFPLAN-BACKEND/firebase.json"]:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "Private/source path"):
                self.audit(extra=name)


if __name__ == "__main__":
    unittest.main()
