"""Security and Git-free regression tests for the commit-archive fallback."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("stage_public", Path(__file__).with_name("stage_public.py"))
pages = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pages)
COMMIT = "a" * 40
REPO = "luoxisg/dcdeeptech"
PREFIX = "dcdeeptech-" + COMMIT


class ArchiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Git is used only to prepare the local regression fixture, never in the
        # archive staging path under test. Use all 163 existing reviewed files.
        names = pages.selected_files(pages.tracked_entries())
        cls.public = {name: (pages.ROOT / name).read_bytes() for name in names}
        cls.tools = {"scripts/pages/stage_public.py": Path(pages.__file__).read_bytes(),
                     "scripts/pages/public-files.json": pages.MANIFEST.read_bytes()}

    def archive(self, destination, entries):
        with tarfile.open(destination, "w:gz", compresslevel=1) as tar:
            for name, data in entries:
                item = tarfile.TarInfo(name)
                if isinstance(data, tuple):
                    item.type, item.linkname = data
                else:
                    item.size = len(data)
                tar.addfile(item, None if isinstance(data, tuple) else io.BytesIO(data))
        return destination

    def test_stage_all_public_files_with_git_disabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            entries = {**self.public, **self.tools, ".git/config": b"synthetic credential config",
                       ".env": b"synthetic private source", "backend/server.py": b"not public"}
            source = self.archive(tmp / "source.tar.gz", [(PREFIX + "/" + n, b) for n, b in entries.items()])
            with patch.object(pages.subprocess, "check_output", side_effect=AssertionError("Archive staging must not run Git")):
                pages.stage(tmp / "site", tmp / "audit.json", source, REPO, COMMIT)
            actual = {str(p.relative_to(tmp / "site")): hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in (tmp / "site").rglob("*") if p.is_file()}
            self.assertEqual(actual, {n: hashlib.sha256(b).hexdigest() for n, b in self.public.items()})
            report = json.loads((tmp / "audit.json").read_text())
            self.assertEqual(report["source_commit"], COMMIT)
            self.assertEqual(report["source_archive_sha256"], hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertFalse((tmp / "site/.git").exists())
            self.assertFalse((tmp / "site/.env").exists())

    def test_wrong_commit_root_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = self.archive(Path(tmp) / "source.tar.gz", [(PREFIX + "/index.html", b"x")])
            with self.assertRaisesRegex(ValueError, "root"):
                pages.ArchiveSource(archive, REPO, "b" * 40)

    def test_mutable_or_short_commit_rejected(self):
        for commit in ["main", "a" * 7, "A" * 40, "a" * 39]:
            with self.assertRaisesRegex(ValueError, "40-character"):
                pages.ArchiveSource(Path("unused.tar.gz"), REPO, commit)

    def test_unsafe_archive_paths_rejected(self):
        for name in ["/absolute", PREFIX + "/../escape", PREFIX + "/DeepFamily\\bad", "other-root/index.html"]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                archive = self.archive(Path(tmp) / "source.tar.gz", [(name, b"x")])
                with self.assertRaises(ValueError):
                    pages.ArchiveSource(archive, REPO, COMMIT)

    def test_links_and_devices_rejected(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE]:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                archive = self.archive(Path(tmp) / "source.tar.gz", [(PREFIX + "/bad", (kind, "/etc/passwd"))])
                with self.assertRaisesRegex(ValueError, "Links/devices"):
                    pages.ArchiveSource(archive, REPO, COMMIT)

    def test_duplicate_members_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = self.archive(Path(tmp) / "source.tar.gz", [(PREFIX + "/index.html", b"one"), (PREFIX + "/index.html", b"two")])
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                pages.ArchiveSource(archive, REPO, COMMIT)

    def test_allowlist_must_match_same_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source = self.archive(tmp / "source.tar.gz", [(PREFIX + "/scripts/pages/public-files.json", b"changed")])
            with self.assertRaisesRegex(ValueError, "Allowlist differs"):
                pages.stage(tmp / "site", tmp / "audit.json", source, REPO, COMMIT)
            self.assertFalse((tmp / "site").exists())

    def test_existing_private_path_and_secret_checks_remain(self):
        for name in [".git/config", "DeepFamily/.env", "credentials.json", "DeepFamily/private.key", "backend/server.py"]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                pages.safe_path(name)
        with self.assertRaisesRegex(ValueError, "private credential"):
            pages.scan_content("index.html", b"-----BEGIN PRIVATE KEY-----")


if __name__ == "__main__":
    unittest.main()
