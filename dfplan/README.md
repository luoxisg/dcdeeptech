# DeepFamily / DFplan

Live entry: https://dcdeeptech.com/dfplan/ · isolated demo: https://dcdeeptech.com/dfplan/?demo=1

A buildless native-ESM EN/ZH planning workspace. The ten WU tasks, existing task confirmations, named assignments, stewardship fields, LocalStorage keys, Firestore collections and authorization rules remain compatible. Task completion is separate from independent family acceptance: absent independent audit data, formal acceptance is **unverified**.

## Architecture and maintenance

- `index.html`: import map owns every source module's cache version. Its inline module imports the mapped `src/app.mjs`. Update the map's versions together when publishing changes; source imports never contain version queries.
- `src/domain`: pure schema, seed tasks, assertion metadata, estimator math, translations and export logic. Imports directly in Node 22 without browser globals.
- `src/application`: unidirectional store, declarative command registry, injected storage contract and application commands. No UI dependency.
- `src/adapters`: existing LocalStorage behavior and Firebase client, including an isolated hash invitation parser. Tokens are consumed before navigation, scrubbed from the URL and never persisted by the UI.
- `src/ui`: escaped HTML templates, four independent region mounts, lazy views/dialogs. Forms are preserved during background state updates; explicit `raw()` is reserved for program-owned markup.
- `styles`: ordered CSS layers, token-based standard/elder scaling; no override chains or `!important`. No bundler, frontend dependencies or build output.

At widths below 768px, the four thumb-zone tabs are Overview, Tasks, Fact Verification and Digitization. All older pages remain accessible through Menu. Scroll positions are remembered per view. Standard controls have a 48px minimum target; elder mode uses 54px targets and 20px body text. Task lists and twelve capture lines reflow into cards. Dialogs use swipe-dismiss handles, sticky actions and `visualViewport` keyboard avoidance.

## Data and permissions

`?demo=1` uses separate project/people keys and never imports the Firebase SDK or accesses live records. Its five generic people are fictional examples. Patrick preview affects only that demo directory and never grants live access or pricing permissions. The signed-out live site exposes no family project data. Local-only mode is selected only if the existing backend configuration is disabled.

The twelve capture lines aggregate into the **existing six administrator-managed rate keys**; they introduce no new Firestore fields. Oral-history audio means digitization, not interviewing/transcription. Exact rate estimates, reference package budgets and planning FX assumptions are labeled separately. Existing guest, owner/admin and pricing permissions are unchanged.

Fact verification is an optional, versioned metadata block inside the existing `outcomes` text field, appended only after an explicit save:

```text
Existing free-text outcomes are retained here.

[DeepFamily assertions v1]
{"version":1,"assertions":[...]}
```

Unknown/malformed metadata remains untouched text. Confirm/review/note actions preserve original task status and acceptance. Editor changes preserve assertion metadata. The existing 12,000-character field limit is enforced without truncation; JSON/CSV retain the entire string and sources. This is planning metadata, not a replacement for independent review or original archive files. No automatic cloud migration or production initialization runs on page load.

JSON exports include all loaded tasks/history. Local saves preserve history up to the pre-existing 5,000-event validation limit and reject further writes instead of silently truncating it. The existing cloud read limit is also unchanged. Import is explicit; cloud revision checks and task deletion restrictions remain intact. Failed/corrupt local reads block automatic overwrites and offer raw backup export.

## Run and verify

```sh
python3 -m http.server 8080
# http://localhost:8080/dfplan/?demo=1
node scripts/dfplan/check-model.mjs
node scripts/dfplan/native-architecture.test.mjs
npx tsc --allowJs --checkJs --noEmit dfplan/src/**/*.mjs
# Include entry and deeper lazy modules as well:
npx tsc --allowJs --checkJs --noEmit dfplan/src/app.mjs dfplan/src/**/*.mjs dfplan/src/ui/views/*.mjs dfplan/src/ui/dialogs/*.mjs
node scripts/dfplan/check-mobile.mjs
```

TypeScript and Playwright are **QA-only tools**, not app dependencies. The browser check accepts `PLAYWRIGHT_MODULE` (external Playwright installation) and `CHROMIUM_PATH` (browser executable). It tests both 375x812 and 390x844, EN/ZH, 48/54px targets, overflow, scroll memory, preserved input focus, simulated visualViewport keyboard resizing, facts, exports and demo/live isolation. Keyboard checks are automated simulation; they do not certify a physical Samsung keyboard/browser combination.

The Pages workflow stages only explicit files in `scripts/pages/public-files.json`, audits content and hashes, and preserves all other sites. Backend scripts only update their source-file paths for this reorganization; this frontend release does **not** deploy Firebase rules or initialize records.

## Oral-history module / 口述访谈

Open **Oral history / 口述访谈** from Overview, Menu (before Fact Verification), or the WU-05 task card. Direct link: `?demo=1#interview`. The original uploaded prototype is adapted into native domain, application, browser-adapter, lazy-view and review-dialog modules; scoped CSS is isolated in `styles/interview.css`. No iframe, new framework or runtime dependency.

Three bilingual scripted turns support interruption, pausing, 3.5-second pause-tolerance demonstration, deduplicated unverified tags, original transcript review and editable drafts. Edited EN/ZH drafts stay in memory across view switches and are not overwritten by later sample turns. Restart requires confirmation. Export/copy includes original sample wording and verification items; no automatic AI, recording, transcription, archive write, task update or fact-confirmation occurs. Export before reloading.

The optional microphone level test asks permission only on explicit activation. It uses local audio amplitude without recording or uploading. Leaving the module stops all tracks and animation; delayed permission grants after navigation are stopped immediately.

Additional verification: `node scripts/dfplan/interview.test.mjs` checks state transitions, pause/interrupt races, draft preservation and complete three-turn flow. `check-mobile.mjs` also exercises WU-05 entry, focus-preserving edits, TXT download, reset confirmation, fake microphone permission cleanup and zero project writes at both mobile sizes.

Live interview drafts and microphone state are cleared on sign-out, access loss or an account change, including when another view is active. Ordinary view switches retain drafts within the same session.
