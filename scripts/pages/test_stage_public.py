"""Keep media permission scoped to reviewed paths and immutable source bytes."""
import hashlib
import json
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


if __name__ == "__main__":
    unittest.main()
