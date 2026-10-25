# Commit-archive Pages fallback (prepared for review)

## Why this is a separate alternative

Base: `dcdeeptech/main` at `b5524ff4eab217760900dcecf784c112b222a6ae`, including the credential-persistence change from PR #13. This branch replaces actions/checkout entirely. It does not try another submodule or authentication-cleanup option. No checkout action means no checkout setup/post-job submodule traversal.

The production `github-pages` job remains main-only with the same events, concurrency group, minimal permissions and official configure/upload/deploy actions. A branch push does not publish this alternative. Review and merge are required before running it on main. Pages Source, custom domain, DNS and Cloudflare are not changed by this branch.

## Retrieval and provenance

The first workflow step downloads `https://codeload.github.com/${GITHUB_REPOSITORY}/tar.gz/${GITHUB_SHA}`. Both repository identity and full lowercase 40-character SHA are checked. It never requests a mutable branch URL, uses no token/Authorization header, retains TLS verification and permits only HTTPS redirects. This currently public repository supports anonymous archive retrieval. If it becomes private, the step fails rather than introducing an unreviewed credential workaround.

The archive's one root must be exactly `dcdeeptech-<requested full SHA>`. Paths, duplicate names, sizes and types are checked before use; traversal, absolute/backslash paths, links and devices fail closed. Only `scripts/pages/stage_public.py` and `scripts/pages/public-files.json` are extracted into a private temporary tools directory. No source repository is extracted into the public site, and no `.git` directory or credential configuration is created.

The staging script opens the same archive directly. It verifies its own bytes and the allowlist match the pinned archive, reads only selected regular-file payloads, and records repository, requested commit and the archive's SHA-256 in the private audit report. Archive authenticity relies on the verified HTTPS GitHub source and immutable commit URL; the directory-prefix check is a consistency check, not an independent cryptographic signature verification.

## Same public allowlist and safety boundary

`scripts/pages/public-files.json` is byte-for-byte unchanged from main. The baseline is still 91 explicit public files plus 72 generated DeepFamily V3.1 files = 163 public files. Root homepage, CNAME, all applications, DeepFamily, lowercase redirect and .nojekyll contents are unchanged. All three gitlinks remain unchanged and are neither fetched nor traversed. There is no npm/pnpm install or Next build.

The common allowlist/type/private-path/credential scanning logic and actual uploaded-tar audit remain. Archive mode does not use the local Git index or invoke any subprocess. The legacy Git-index CLI remains available for comparisons/tests but is not called by the workflow. Unselected archive entries (including source/backend/configuration content) are never copied into the public site. An audit report stays outside the site.

The official upload-pages-artifact action and scoped `TAR_OPTIONS=--no-wildcards` setting remain, retaining reviewed .nojekyll markers. Before deploy-pages runs, the actual tar must equal the expected 163 filename/hash set with no links, private paths or extra credentials. No authentication is persisted in the source tools directory; the official Pages actions still use their normal job-scoped permissions.

## Verification and review evidence

- `python3 -m unittest discover -s scripts/pages -p test_archive_source.py -v`: eight tests passed. The positive test stages all 163 real reviewed public files with Git subprocess execution replaced by an exception; the resulting file/hash set is identical. Synthetic `.git/config`, `.env` and backend source in the archive do not appear in output.
- Negative tests reject short/mutable SHAs, mismatched archive root, absolute/traversal/backslash names, duplicate entries, symlink/hardlink/device members, allowlist tampering, private paths and secret markers.
- Workflow YAML and shell syntax were checked. Only configure-pages@v5, upload-pages-artifact@v4 and deploy-pages@v4 remain; no actions/checkout, Git command or download token is present.
- Read-only GitHub codeload tests confirmed both archive availability and the full-SHA root convention. No production deployment is inferred from a source archive fetch or a local test.

### Real GitHub archive end-to-end result

The implementation was pushed as `8be07dfbc65bb7ff9438ae1cb929f4ef3f0e6164`. The actual first workflow step (parsed from its YAML) was executed locally with that full SHA and a fresh temporary runner directory. It downloaded the real codeload archive, verified its root, and extracted only the two staging tools. The extracted staging script then ran in archive mode, followed by the unchanged upload-style tar creation and actual-tar audit.

Result: PASS — exactly 163 files / 28,888,623 bytes. Every public filename/SHA-256 equals the previous reviewed main-branch artifact. No `.git` directory exists in the temporary source/tools/site tree. The downloaded archive SHA-256 for this test was `a6af54aad473ac7540b369ad70721b17a179723ba65a07c7855bdb4fc0ee38d1`; this records the observed download, not an independently published signature or a permanently stable compression digest. Source commit identity is pinned in the request and root check.

Local evidence: `/tmp/pages-real-archive-result.json`, `/tmp/pages-real-archive-81y4ukgu/dcdeeptech-pages/audit.json`, `/tmp/pages-real-archive-81y4ukgu/artifact.tar`, and `/tmp/pages-archive-unit-tests.txt`. The source tar, tools and reports remain outside the public site. All three gitlink object IDs and the original allowlist file remain unchanged.

Actual hosted Actions execution, Pages environment approval, publication and live-domain acceptance still require the reviewed main workflow run. This is a prepared alternative, not a claim of a successful production deployment. Report any actual new runtime error instead of declaring deployment success.

## Owner activation and rollback

Review the branch diff, unchanged allowlist and audit results. Merge only after approval, then manually run **Actions → Publish static root to GitHub Pages → Run workflow → main** (or inspect the merge-triggered run). Confirm archive download, static staging, actual-tar audit and deploy-pages success plus public-domain URLs before calling recovery complete. Retain existing Pages settings; this alternative does not switch the source automatically.

If required, prepare a reviewed revert PR for this branch's workflow/staging changes, preserving website files and all gitlinks. Reverting restores the previous checkout-based workflow and therefore may restore its known traversal problem; it is not a guaranteed successful recovery. Never reset/force-push main, delete application gitlinks or change DNS to test this alternative. The source and public-artifact audit reports must remain outside published files.
