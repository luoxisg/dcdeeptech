# DeepFamily / DFplan

一级菜单「访谈测试版」提供独立浮层中的三轮虚构 Mock 访谈、记忆锚点、可编辑初稿及本机保存/导出；手机底部导航也提供入口。打开和关闭不重绘工作区。该测试入口与已有正式访谈及事实核对页面并存，不会向 Firestore 写入测试对话。Live WS 的本地启动、API 费用与隐私边界见 [backend/README.md](../backend/README.md)。Pages 只发布前端，不能托管 Python 语音服务；真实语音需要自行启动本地服务并配置模型接口。

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

The twelve capture lines aggregate into the **existing six administrator-managed rate keys**; they introduce no new Firestore fields. Oral-history audio means digitization, not interviewing/transcription. Exact rate estimates and reference package budgets are labeled separately. Internal cost, margin and FX analysis are not included in the public estimator. Existing guest, owner/admin and pricing permissions are unchanged.

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

## Interview beta: real local recording

The existing **访谈测试版 / Interview beta** entry now defaults to real microphone recording in the same warm paper/green interface as DFplan. It is also linked from Overview and the scripted oral-history page. Nothing is recorded until the narrator-consent checkbox is checked and Start is clicked. HTTPS and a browser supporting `MediaRecorder` are required.

Pause/resume excludes paused time; mute records silence; “Done” retains the current clip and advances the question. Extra recordings after the three prompts are supported. Finish opens a keyboard-aware bottom sheet with actual audio playback, individual downloads, optional editable notes and TXT export. MIME/extension detection follows the actual browser container (WebM, M4A, Ogg, AAC or a correctly labeled default). No invented transcript is shown. Browser speech recognition is off by default and requires the separate opt-in below.

Audio files and notes stay in memory, never LocalStorage or Firestore. Optional browser speech recognition may process live speech through its provider; see the opt-in details below. Closing the overlay finalizes the current clip and releases the microphone, retaining clips for reopening on this page. Reset is confirmed. Reload/navigation warns about unrequested downloads; page exit, sign-out or account/access change clears audio and object URLs. A roughly 128 MiB session limit retains available audio and asks the user to download/reset rather than evicting earlier clips. This is not a durable archive: verify downloaded files and back them up appropriately.

The previous Mock / configured WebSocket AI interface is preserved under **Other interview options**, with its original backend and configuration unchanged. Local recordings are not automatically passed into that service. No Firebase rule or production-data change is included.

Checks: `node scripts/dfplan/recording.test.mjs`; the mobile browser gate uses Chromium’s synthetic audio input with the real MediaRecorder and decoder, checking non-silent playable bytes, pause/mute, exact download bytes, notes, keyboard focus, close/reopen, reset, denied/delayed permission and no project writes at 375x812 / 390x844. No human microphone was used in automated QA; physical Samsung/iOS behavior still needs device testing.

## Free live speech-to-text / 免费实时语音转文字

In **Interview beta**, check **Enable free live transcription** before starting a new recording, and select Mandarin (`zh-CN`) or Singapore English (`en-SG`). There is no application API key, paid transcription API or Firebase upload. Recognition is provided by the browser, so support, availability, accuracy and limits depend on the browser/provider/network. Android Chrome is a suggested option, not a universal guarantee. This is not a promise of offline or Singapore-only processing: the browser may send speech to its service and process it abroad. Leave the separate opt-in off for sensitive recordings. The setting is session-local and clears on reset/sign-out.

The Web Speech API handles **live microphone input**, not existing audio files. Saved clips are not uploaded by this live-recognition option. Use the separate on-device Whisper action below to transcribe saved audio. The current audio recording continues if recognition is unsupported, denied or fails. No mocked transcript or story script is substituted in the application. The previous configured local Whisper/AI option is separate and unchanged.

Interim text is revised in place. Pause/mute abort recognition; resume starts a fresh recognition attempt without losing prior words. Stop waits up to 1.5 seconds for final words, then keeps an explicitly partial result so provider failure cannot indefinitely block saving the audio. Silent reconnection retries and per-clip text length are bounded. Late events after pause/reset/logout cannot resurrect private text or attach to a later clip.

Each clip retains its original machine transcript plus an editable reviewed transcript and separate manual notes. TXT export includes the machine original after edits and marks uncertainty/incompleteness. All text remains unverified and never automatically changes task acceptance, assertions or family archives. Export audio and TXT separately before refreshing.

`node scripts/dfplan/transcription.test.mjs` covers revisions, pause/resume, final-result timing, error/timeout, bounded restarts, cancellation and text limits. Mobile QA combines real synthetic MediaRecorder audio with a **mocked SpeechRecognition provider** to exercise UI wiring, language selection, edits/exports, provider failures and unsupported fallback without sending test speech to a third party. Provider recognition quality and availability still require an actual supported device/network test; synthetic QA does not certify recognition accuracy.


### Saved-audio transcription on this device (free, optional)

If browser live recognition returns no text, the review sheet now says so explicitly and shows the recorded provider failure when available. Empty text is not labeled as a received partial transcript.

In Interview beta, open playback and choose **Transcribe this clip on this device**. To recover a previous recording, use **Import a saved recording** (WebM, WAV, M4A/MP4, Ogg, MP3 or AAC), select Mandarin or English in the review sheet, then click the transcription button. Each clip must be at most 5 minutes and 12 MiB. Decoding support depends on the browser.

The first explicit action downloads approximately 70–100 MB of public runtime/model assets from jsDelivr and Hugging Face. No assets are fetched merely by opening the app/recorder. The optional native-ESM runtime is pinned to Transformers.js 3.8.1 in the import map; Whisper tiny q8 is pinned to revision `ff4177021cc41f7db950912b73ea4fdf7d01d8e7`. WASM inference runs in a dedicated worker with one thread, including browsers without cross-origin isolation. Audio is decoded/downmixed to 16 kHz locally and transferred to the worker, never uploaded. The worker rejects non-GET/HEAD fetches. Public model files may remain in browser cache; private audio/text is not persisted there. A network connection is needed for the initial download, and a cache hit is not guaranteed.

Progress, cancellation and failure are visible. Closing playback/recorder, resetting, signing out or hiding/unloading the page cancels processing; cancelling retains existing clips, while reset/sign-out clears session material as before. Existing manually edited text is never overwritten; reimport the source audio if a new machine pass is needed. Download audio and TXT before refreshing. Tiny-model accuracy, dialect support and phone speed vary; results are unverified, not factual acceptance. No API key, paid inference service, Firebase change or family-record write is involved.

Verification: `node scripts/dfplan/local-asr.test.mjs` covers PCM preparation, import validation, real-error labels, cancellation/stale completion and protection of audio/notes/manual edits. The optional `check-local-asr-browser.mjs` performs **actual inference**, separate from mocked live-recognition wiring tests:

```bash
ASR_FIXTURE=/path/to/public-speech.webm ASR_EXPECT='expected words' node scripts/dfplan/check-local-asr-browser.mjs
```

Set `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH` for an external QA installation if needed. This network/model-download test is deliberately not part of ordinary CI. Tested public Mandarin speech from the public [ModelScope ASR example](https://isv-data.oss-cn-hangzhou.aliyuncs.com/ics/MaaS/ASR/test_audio/asr_example.wav), transcoded to WebM returned “每天都要快乐哦”; 375×812 and 390×844 UI checks cover real inference, populated editable text, TXT export, no audio upload, no project write and 48/54 px controls. The public [JFK English fixture](https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav) also produced the expected “ask not what your country can do for you” text. This does not certify a physical Samsung device or any private recording.
