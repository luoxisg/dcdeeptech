# P0 — Publish the existing V3.1 static root with GitHub Actions

## Purpose and review scope

Production baseline is `d2455c05f34e052dd654d3a9d901d4995c8bb5ed` on `luoxisg/dcdeeptech/main`, including DeepFamily V3.1 from PR #10. This workflow bypasses broken recursive submodule checkout. It does not rebuild any application or require cleanup PR #11. All three gitlinks remain unchanged, including the active marketing and portal applications; no submodule URLs are invented.

The workflow PR contains only `.github/workflows/deploy-pages.yml`, `scripts/pages/stage_public.py`, `scripts/pages/public-files.json` and this deployment/QA documentation. Existing public pages, CNAME, DeepFamily files and application code are unchanged. V4 SEO/GEO is a separate source branch and must not be copied into this repair.

## Workflow contract

Pushes to main and manual dispatch trigger the workflow; the deploy job additionally requires `github.ref == 'refs/heads/main'`. The `github-pages` concurrency group queues deployments without cancelling an in-progress production publish. The only permissions are `contents: read`, `pages: write`, `id-token: write`.

The official actions are checkout@v4, configure-pages@v5, upload-pages-artifact@v4 and deploy-pages@v4. Checkout explicitly sets `submodules: false` and `persist-credentials: false`. Configure-pages uses `enablement: false`: it must not auto-enable Pages or silently change settings. The deployment uses environment `github-pages`, with its URL from `steps.deployment.outputs.page_url`.

No npm/pnpm install, Next build, submodule update or unrelated build pipeline is invoked. Python 3 from the hosted runner stages already-built files; only Python standard-library modules and local Git object reads are used. Credentials are not persisted in the checkout.

## Reviewed public artifact

The source repository root remains the static URL root. The workflow creates a temporary **filtered mirror** preserving relative paths, instead of uploading the entire monorepo. The explicit manifest lists existing root HTML variants, CNAME, `.nojekyll`, the lowercase entry, self-contained public static applications, images and public marketing PDFs. It also allows the already-generated DeepFamily static tree. At this baseline, there are 91 explicit files and 72 DeepFamily files: **163 files / 28,888,623 bytes**.

All required files are present, including `/index.html`, `/CNAME`, `/.nojekyll`, `/DeepFamily/`, `/deepfamily/`, the original PNG and every `_next` JS/CSS file. No path is flattened, lowercased or rewritten. The root and DeepFamily have different existing WhatsApp numbers; neither is altered by this repair.

Backend/source trees, `.git`, `.github`, dotfiles other than `.nojekyll`, environment files, package/development metadata, internal configuration, credentials, databases, source maps, symlinks, and gitlinks are not staged. Internal `platform-sg` admin-console HTML and internal API/source documentation are deliberately excluded; they are not public applications. The active front gitlinks remain in Git and their separate deployment processes are untouched. No new application source is made public to compensate for the broken submodules.

The script checks the allowlist against tracked regular-file index entries, verifies working bytes against Git blobs, scans for selected credential/private-key signatures without logging values, copies bytes unchanged and writes a SHA-256 audit report **outside** the public directory. This is not a claim of a comprehensive automated secrets or legal audit; the public allowlist must be reviewed when new public assets are added. Unexpected files inside the generated DeepFamily tree fail the stage rather than silently publishing unknown content.

### Retaining .nojekyll in the official upload action

The inspected upload-pages-artifact@v4 implementation uses tar with `--exclude=".[^/]*"`, which would remove `.nojekyll`. The upload step sets the supported GNU tar environment option `TAR_OPTIONS=--no-wildcards`, making that broad exclusion literal while keeping the action's explicit `.git` and `.github` exclusions. Only allowlisted dotfiles exist in the stage. After upload, the workflow audits the **actual** `$RUNNER_TEMP/artifact.tar`: it must have exactly the audited filenames and hashes, including both `.nojekyll` markers, no links, no private paths and all `_next` assets. A mismatch prevents deploy-pages from running. Uploaded artifacts themselves are not mutated.

Actions-based Pages publishing does not run Jekyll, but the markers are retained as requested and for compatibility. The checked root `.nojekyll` in Git is unchanged.

## Required Pages Source transition — owner action

The owner-reported current setting is **Deploy from a branch → main / (root)**. This task could not independently read it through the API (`Forbidden`) and has not changed it. Adding a workflow does **not** change this setting.

After reviewing and approving the workflow PR:

1. Merge the workflow PR in GitHub. Do not merge cleanup PR #11 as a prerequisite.
2. Open `luoxisg/dcdeeptech` → **Settings** → **Pages** → **Build and deployment**.
3. Under **Source**, select **GitHub Actions** (save if the UI requests it). Leave **Custom domain = dcdeeptech.com**, DNS, Cloudflare and nameservers unchanged.
4. Open **Actions** → **Publish static root to GitHub Pages** → **Run workflow** → select branch **main** → **Run workflow**. Alternatively rerun the workflow that the reviewed merge triggered if it ran before the source switch.
5. If the `github-pages` environment requires an existing approval, the authorized environment reviewer must approve it. Do not weaken environment protections.
6. Inspect the actual Checkout, stage/audit, upload/audit and deploy steps. Confirm the deploy job and `github-pages` deployment succeed; copy the real run URL and environment deployment URL into the QA record. The old failed Jekyll/branch build is not evidence that this new workflow ran.

The current environment cannot create the PR, merge it, change Pages Source, dispatch or inspect runs through the GitHub API because those requests return `Forbidden`. The pushed branch and PR-creation link are the supported handoff. No production success is inferred from a local test or branch push.

## Live acceptance after successful deployment

Use real HTTP requests and a browser on the public domain. Record origin status, content type, final browser URL and run/deployment URL. Browser-test lowercase entries because curl `-L` does not follow HTML meta-refresh.

| URL | Acceptance |
|---|---|
| https://dcdeeptech.com/ | Existing homepage and static assets; content matches main |
| https://dcdeeptech.com/deepfamily | Opens `/DeepFamily/en/` |
| https://dcdeeptech.com/DeepFamily/ | Opens `/DeepFamily/en/` |
| https://dcdeeptech.com/DeepFamily/en/ | 200, English |
| https://dcdeeptech.com/DeepFamily/zh/ | 200, Chinese |
| https://dcdeeptech.com/DeepFamily/en/privacy/ | 200, four country cards |
| https://dcdeeptech.com/DeepFamily/zh/privacy/ | 200, Chinese country content |
| https://dcdeeptech.com/DeepFamily/brand/deepfamily-logo.png | 200, image/png |

At desktop/mobile widths, check six primary navigation items, three Partnership pages, equivalent-route language switching, WhatsApp and Xi Luo LinkedIn icons, styles/JS, browser errors and representative existing `/mpc/`, `/ocp/`, `/USD/`, `/food/` applications. The public entry documents may return 200 and then refresh in the browser, rather than HTTP 301/308. Unknown pages keep existing static-host behavior; this workflow does not install middleware or runtime redirects.

The existing root homepage relies on external CDN scripts. Byte-for-byte preservation and local 200 responses do not independently prove those third-party scripts or the live domain work. Existing missing links such as root `/llms.txt` and some historical PDF aliases were not invented or repaired by this deployment-only task.

## Rollback without resetting main

Before merge, close the PR and leave production unchanged. Record the currently served/last successful deployment URL and commit before releasing.

If the new workflow fails before a successful deployment, inspect that failure first; do not force-push/reset main or delete DeepFamily. After an approved merge, prepare a revert PR for the workflow/staging/documentation commit (or revert the merge with `git revert -m 1 <merge-sha>`), inspect the diff and merge only after review. No site files were changed by this PR, so homepage/CNAME/DeepFamily content does not require replacement.

If reverting the workflow, an owner may restore **Settings → Pages → Source → Deploy from a branch → main / (root)**. **That restores the previous configuration, but the existing unmapped-gitlink failure would recur unless separately resolved.** Do not present this as a guaranteed working rollback. Do not remove active application gitlinks or invent URLs to make it pass. A reviewed correction to the custom staging workflow may be the safer recovery while retaining the last known-good site content. Confirm actual published status and live routes after any rollback. Keep the source and deployment histories; no DNS/custom-domain change is part of rollback.
