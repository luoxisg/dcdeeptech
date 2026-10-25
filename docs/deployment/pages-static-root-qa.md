# Pages recovery QA — 25 October 2026

## State and scope

Production base inspected: `d2455c05f34e052dd654d3a9d901d4995c8bb5ed`, containing DeepFamily V3.1 from PR #10. The user-supplied failure for legacy Pages build #241 occurs during checkout: `No url found for submodule path '_deprecated_vllm' in .gitmodules` (Git exit 128). The latest tree/index contain three unmapped mode-160000 entries and no `.gitmodules`: `_deprecated_vllm`, `front/apps/marketing`, `front/apps/portal`.

This branch leaves **all three** gitlinks intact and does not depend on cleanup PR #11. It adds only the custom workflow, public staging/allowlist logic and deployment documentation. It does not run a site build or include V4 SEO output. No existing website, CNAME, application, Pages setting or DNS file is modified.

## Local verification actually executed

1. Parsed `.github/workflows/deploy-pages.yml` with PyYAML `BaseLoader` and asserted push/main plus dispatch events, main-only deploy-job guard, exactly `contents: read`, `pages: write`, `id-token: write`, concurrency group `github-pages` with `cancel-in-progress: false`, and environment URL from `steps.deployment.outputs.page_url`.
2. Verified the only actions are checkout@v4, configure-pages@v5, upload-pages-artifact@v4 and deploy-pages@v4. Checkout has `submodules: false`, `persist-credentials: false`. Configure-pages has `enablement: false`. Run commands only invoke the Python staging/audit script, with no installs, Next builds or recursive submodule updates.
3. Read the official upload-pages-artifact@v4 and configure-pages@v5 action definitions from their GitHub raw sources. Found the dotfile exclusion in the upload action and tested the required `.nojekyll` retention.
4. Ran `python3 scripts/pages/stage_public.py --output /tmp/dcdeeptech-workflow-qa/site --report /tmp/dcdeeptech-workflow-qa/audit.json`. Result: PASS — 163 reviewed files / 28,888,623 bytes. The 91 explicit public paths plus 72 DeepFamily output files are tracked regular files; working bytes equal index blobs. All copies are SHA-256 checked. No submodule command was executed by staging.
5. Reproduced the official action's GNU tar command locally with `TAR_OPTIONS=--no-wildcards`, `--dereference --hard-dereference`, explicit `.git`/`.github` exclusions and the literalized `.[^/]*` exclusion. Ran `python3 scripts/pages/stage_public.py --audit-tar /tmp/dcdeeptech-workflow-qa/artifact.tar --report /tmp/dcdeeptech-workflow-qa/audit.json`. PASS — the actual tar has exactly the audited file/hash set, including both `.nojekyll` files and all Next JS/CSS. No symlink/hardlink or unreviewed entry was accepted.
6. Security-negative checks passed: traversal, absolute paths, Git metadata, backend/admin source paths, environment/private-key filenames, a synthetic private-key marker and a hidden-file archive injection were rejected. Matched secret values are never logged. The audit report stays outside the public directory. These checks supplement the explicit allowlist; they are not a comprehensive secrets/copyright certification.
7. Compared staged root `index.html`, `CNAME`, `.nojekyll`, `DeepFamily/index.html` and `deepfamily/index.html` against `git show origin/main:<path>`: byte-identical. The script verifies every selected static file against its index blob, including all homepage assets and the entire DeepFamily output.
8. Served the audited stage with `python3 -m http.server 3116 --bind 127.0.0.1 --directory /tmp/dcdeeptech-workflow-qa/site`. Headless Chromium checks passed using the existing local browser tooling; no npm/pnpm install or Next command was run for this repair.
9. `git diff --check` passed. The proposed tree changes are restricted to the new workflow, staging logic/manifest and these documentation files. Existing tracked blobs and gitlinks are preserved.

## Staged browser results (not live-domain results)

- `/deepfamily`, `/deepfamily/`, `/DeepFamily`, `/DeepFamily/` opened `/DeepFamily/en/`.
- EN/ZH home, privacy, Family Offices, Clan Associations and Social Impact pages returned 200. Both privacy pages contained four country cards.
- Six primary navigation items, three Partnership entries and equivalent-route language switching passed at 390, 768 and 1440px. No horizontal overflow in the checked privacy views.
- WhatsApp icon target is `https://wa.me/6581279739`; LinkedIn icon target is `https://www.linkedin.com/in/xi-luo-923717184`. Accessible labels remain present.
- Brand logo returned `image/png`. Static hero artwork remained active; no unapproved video element was rendered. No DeepFamily browser page errors or local asset 404s occurred.
- Root `/`, `/mpc/`, `/ocp/`, `/USD/`, `/food/`, `/image/DCdeeptech_logo-removebg-preview.png` and `/images/1OCP.jpg` returned 200 in staging. Root content/asset bytes were preserved. Third-party CDN-dependent root rendering is not claimed as independently validated.
- Entry documents may return HTTP 200 plus HTML meta-refresh; they are not server-side HTTP 301/308 redirects. No runtime server or middleware was added.

Local evidence files: `/tmp/dcdeeptech-workflow-qa/audit.json`, `artifact.tar`, `browser-results.txt`. These are not in the public artifact or committed into production content. The same audit is enforced again inside the proposed workflow before deploy-pages runs.

## External checks and blockers

Actual HTTP HEAD requests were attempted for all of the following:

- `https://dcdeeptech.com/`
- `https://dcdeeptech.com/deepfamily`
- `https://dcdeeptech.com/DeepFamily/`
- `https://dcdeeptech.com/DeepFamily/en/`
- `https://dcdeeptech.com/DeepFamily/zh/`
- `https://dcdeeptech.com/DeepFamily/zh/privacy/`
- `https://dcdeeptech.com/DeepFamily/brand/deepfamily-logo.png`

Every request failed at the proxy with curl exit 56: **`CONNECT tunnel failed, response 403`**. These are not origin HTTP status results, and do not establish whether the public site is up or down. Public-domain acceptance remains unverified.

Read-only GitHub API checks failed:

- `gh api repos/luoxisg/dcdeeptech/pages` → `Get "https://api.github.com/repos/luoxisg/dcdeeptech/pages": Forbidden`
- `gh api repos/luoxisg/dcdeeptech/actions/runs ...` → `Get "https://api.github.com/repos/luoxisg/dcdeeptech/actions/runs": Forbidden`

Pages Source is therefore **owner-reported branch main / root, independently unverified, unchanged by this task**. No custom workflow run/deployment URL exists from this work yet, and no successful GitHub checkout/build/deployment is asserted. Review/approval and merging of this PR, selection of Pages Source = GitHub Actions, environment approval if required, dispatch and real run inspection are still necessary. See the runbook for exact UI steps and live acceptance.

## Rollback and release gate

Before merge, keep the existing production state. After approval, follow the runbook transition and verify the actual deploy-pages result and public URLs. If rollback is required, use a reviewed revert PR, not a hard reset or force-push. Restoring branch-based Pages Source would reintroduce the known unmapped-gitlink checkout blocker unless separately resolved; it is not an automatically working fallback. Homepage/CNAME/DeepFamily source files are unchanged by this PR and need not be replaced. Do not change DNS, Cloudflare or the custom domain.

## Delivery evidence

Workflow implementation commit: `c6e503fa21d7f9f9613c5adff6a344c2e9eeb061`. Branch `fix/pages-static-root-workflow` was pushed successfully to `luoxisg/dcdeeptech`. The proposed tree is exactly five additions; all prior blobs and gitlink object IDs remain unchanged.

`gh pr create --repo luoxisg/dcdeeptech --base main --head fix/pages-static-root-workflow --title "Restore V3.1 Pages publishing with static-root Actions workflow" --body-file /tmp/dcdeeptech-pages-workflow-pr.md` failed with `Post "https://api.github.com/graphql": Forbidden`. No PR number or deployment run URL is claimed. Create/review the PR at https://github.com/luoxisg/dcdeeptech/pull/new/fix/pages-static-root-workflow; the prepared description is available in the task workspace at `/tmp/dcdeeptech-pages-workflow-pr.md`.

Release remains blocked at owner review/approval and GitHub access/settings: merge the reviewed workflow PR, switch Pages Source to GitHub Actions, run the workflow on main and inspect its real result. Public URL acceptance must then be checked from a network that can reach dcdeeptech.com. This task did not merge a PR, edit Pages Source, dispatch a deployment, change DNS or alter the custom domain.
