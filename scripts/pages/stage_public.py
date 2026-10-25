#!/usr/bin/env python3
"""Stage only reviewed, tracked public files; never initialize submodules.

The report stays outside the public site. The archive audit checks every file
and hash without extracting an untrusted tar archive.
"""
import argparse
import hashlib
import json
import re
import subprocess
import tarfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("public-files.json")
REQUIRED = {
    "index.html", "CNAME", ".nojekyll", "DeepFamily/.nojekyll",
    "DeepFamily/index.html", "deepfamily/index.html",
    "DeepFamily/en/index.html", "DeepFamily/zh/index.html",
    "DeepFamily/en/privacy/index.html", "DeepFamily/zh/privacy/index.html",
    "DeepFamily/brand/deepfamily-logo.png",
}
PRIVATE_PARTS = {".git", ".github", ".aws", ".claude", ".ssh", "node_modules", "__pycache__",
                 "backend", "backend-cq", "platform-sg", "SG-CN", "src", "tests"}
PRIVATE_SUFFIXES = {".py", ".pyc", ".ts", ".tsx", ".toml", ".ini", ".yml", ".yaml",
                    ".db", ".sqlite", ".sqlite3", ".pem", ".key", ".map"}
SECRET_PATTERNS = (
    rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----",
    rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b",
    rb"\bAKIA[0-9A-Z]{16}\b",
    rb"\bsk-(?:proj-|or-v1-)[A-Za-z0-9_-]{35,}\b",
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_path(name):
    p = PurePosixPath(name)
    require(not p.is_absolute() and ".." not in p.parts and "\\" not in name, "Unsafe path: " + name)
    require(p.parts and all(part not in PRIVATE_PARTS for part in p.parts), "Private/source path: " + name)
    require(all(not part.startswith(".") or part == ".nojekyll" for part in p.parts), "Hidden file: " + name)
    require(p.suffix.lower() not in PRIVATE_SUFFIXES, "Non-public file type: " + name)
    require(not p.name.lower().startswith(("env.", "credentials", "id_rsa", "id_ed25519")), "Sensitive filename: " + name)
    return p


def scan_content(name, data):
    for pattern in SECRET_PATTERNS:
        # Never include matched credential contents in logs.
        require(not re.search(pattern, data), "Potential private credential in allowlisted file: " + name)


def tracked_entries():
    raw = subprocess.check_output(["git", "ls-files", "--stage", "-z"], cwd=ROOT)
    entries = {}
    for record in raw.split(b"\0"):
        if not record:
            continue
        metadata, name = record.split(b"\t", 1)
        mode, oid, stage = metadata.decode().split()
        require(stage == "0", "Unmerged index entry")
        entries[name.decode()] = (mode, oid)
    return entries


def selected_files(entries, check_worktree=True):
    config = json.loads(MANIFEST.read_text())
    files = set(config["files"])
    for tree, suffixes in config["static_trees"].items():
        safe_path(tree)
        for name in entries:
            if name.startswith(tree + "/"):
                path = safe_path(name)
                require(path.suffix.lower() in suffixes or path.name == ".nojekyll", "Unexpected static-tree file: " + name)
                files.add(name)
    require(REQUIRED <= files, "Required production files absent from allowlist")
    require(any(n.startswith("DeepFamily/_next/") and n.endswith(".js") for n in files), "Missing Next JavaScript")
    require(any(n.startswith("DeepFamily/_next/") and n.endswith(".css") for n in files), "Missing Next stylesheets")
    for name in files:
        safe_path(name)
        require(name in entries and entries[name][0] in {"100644", "100755"}, "Not a tracked regular file: " + name)
        if check_worktree:
            target = ROOT / name
            require(not target.is_symlink() and all(not parent.is_symlink() for parent in target.parents if parent != ROOT.parent), "Symlink in public path: " + name)
            require(target.resolve().is_relative_to(ROOT), "Path escapes repository: " + name)
    return sorted(files)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


class ArchiveSource:
    """Read a GitHub codeload archive without extracting the repository or Git links."""
    def __init__(self, archive, repository, commit):
        require(repository is not None and re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository), "Invalid repository identity")
        require(commit is not None and re.fullmatch(r"[0-9a-f]{40}", commit), "A full lowercase 40-character commit SHA is required")
        self.prefix = repository.split("/")[1] + "-" + commit
        self.archive = archive
        self.repository = repository
        self.commit = commit
        self.tar = tarfile.open(archive, "r:gz")
        self.members = {}
        seen = set()
        expanded = 0
        try:
            for number, member in enumerate(self.tar, 1):
                require(number <= 100000, "Too many archive members")
                path = PurePosixPath(member.name)
                require(not path.is_absolute() and ".." not in path.parts and chr(92) not in member.name, "Unsafe source archive path")
                require(path.parts and path.parts[0] == self.prefix, "Archive root does not match the requested repository/commit")
                normalized = str(path)
                require(normalized not in seen, "Duplicate source archive path")
                seen.add(normalized)
                require(member.isdir() or member.isfile(), "Links/devices are forbidden in source archives")
                require(0 <= member.size <= 512 * 1024 * 1024, "Oversized archive member")
                expanded += member.size
                require(expanded <= 1024 * 1024 * 1024, "Source archive exceeds expanded size limit")
                if member.isdir():
                    continue
                require(len(path.parts) > 1, "Missing archive relative filename")
                self.members[str(PurePosixPath(*path.parts[1:]))] = member
        except Exception:
            self.tar.close()
            raise

    def entries(self):
        return {name: ("100644", "archive") for name in self.members}

    def read(self, name):
        return self.tar.extractfile(self.members[name]).read()

    def close(self):
        self.tar.close()


def stage(output, report_path, archive=None, repository=None, commit=None):
    output, report_path = output.resolve(), report_path.resolve()
    require(not output.is_relative_to(ROOT), "Stage outside the source/tools directory, preferably RUNNER_TEMP")
    require(not report_path.is_relative_to(output), "Audit report must not be publicly staged")
    require(not output.exists(), "Output already exists; use a fresh staging directory")
    source = ArchiveSource(archive, repository, commit) if archive else None
    try:
        # Both bootstrap tools and allowlist must belong to the exact same archive.
        if source:
            require(MANIFEST.read_bytes() == source.read("scripts/pages/public-files.json"), "Allowlist differs from source archive")
            require(Path(__file__).read_bytes() == source.read("scripts/pages/stage_public.py"), "Staging script differs from source archive")
        entries = source.entries() if source else tracked_entries()
        files = selected_files(entries, check_worktree=source is None)
        hashes = {}
        output.mkdir(parents=True)
        for name in files:
            data = source.read(name) if source else (ROOT / name).read_bytes()
            scan_content(name, data)
            if source is None:
                require(data == subprocess.check_output(["git", "cat-file", "blob", entries[name][1]], cwd=ROOT), "Working file differs from tracked blob: " + name)
            hashes[name] = sha256(data)
            if name == "CNAME":
                require(data.decode().strip() == "dcdeeptech.com", "Unexpected custom domain; do not change it automatically")
            if name == "DeepFamily/brand/deepfamily-logo.png":
                require(data.startswith(b"\x89PNG\r\n\x1a\n"), "Brand logo is not PNG")
            destination = output / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            require(sha256(destination.read_bytes()) == hashes[name], "Copy changed bytes: " + name)
        provenance = {"source_commit": commit, "source_repository": repository,
                      "source_archive_sha256": sha256(archive.read_bytes())} if source else {
                          "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip()}
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps({**provenance, "files": hashes}, indent=2) + "\n")
        print("PASS: staged", len(hashes), "reviewed static files; source bytes preserved; no submodule command executed.")
    finally:
        if source:
            source.close()


def audit_tar(archive, report_path):
    expected = json.loads(report_path.read_text())["files"]
    actual = {}
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            require(not member.issym() and not member.islnk(), "Link in Pages artifact: " + member.name)
            if member.isdir():
                if str(PurePosixPath(member.name)) != ".":
                    safe_path(str(PurePosixPath(member.name)))
                continue
            require(member.isfile(), "Non-regular archive entry: " + member.name)
            name = str(PurePosixPath(member.name))
            safe_path(name)
            require(name in expected and name not in actual, "Unexpected or duplicate archive file: " + name)
            data = tar.extractfile(member).read()
            scan_content(name, data)
            actual[name] = sha256(data)
    require(actual == expected, "Artifact files/hashes differ from audited stage (including .nojekyll)")
    require(REQUIRED <= set(actual), "Artifact missing required site files")
    print("PASS: actual Pages tar has exactly", len(actual), "audited files; .nojekyll and all _next assets retained.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--audit-tar", type=Path)
    parser.add_argument("--source-archive", type=Path)
    parser.add_argument("--repository")
    parser.add_argument("--commit")
    args = parser.parse_args()
    if args.audit_tar:
        audit_tar(args.audit_tar, args.report)
    else:
        require(args.output is not None, "--output is required when staging")
        stage(args.output, args.report, args.source_archive, args.repository, args.commit)


if __name__ == "__main__":
    main()
