import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHandoverFiles,
  summarizeHandoverReadiness,
  handoverBoundary,
} from "../dfplan/src/domain/exports.mjs";
import { writeAssertions } from "../dfplan/src/domain/stewardship-model.mjs";
import {
  createZipBlob,
  crc32,
  computeSha256Hex,
  finalizeHandoverFiles,
} from "../dfplan/src/adapters/zip-writer.mjs";
import { currentHandoverRole } from "../dfplan/src/application/handover.mjs";
const at = "2026-11-20T00:00:00.000Z";
const fact = {
  id: "F1",
  text: "SEALED_FACT",
  source: "SEALED_SOURCE",
  note: "SEALED_NOTE",
  status: "unverified",
  updatedAt: at,
  sensitivity: "sealed",
};
const state = () => ({
  projectId: "test-project",
  project: {
    tasks: [
      {
        id: "WU-02",
        title: "PRIVATE_VENDOR_TITLE",
        assignee: "PRIVATE_VENDOR_PERSON",
        status: "进行中",
        weekStart: 1,
        weekEnd: 2,
        evidence: "PRIVATE_EVIDENCE",
      },
      { id: "WU-03", status: "未开始", weekStart: 2, weekEnd: 4 },
      {
        id: "WU-07",
        status: "已完成",
        outcomes: writeAssertions("context repeats SEALED_FACT", [fact]),
      },
    ],
    history: [
      { id: "H1", at, actor: "PRIVATE_ACTOR", text: "Old change: SEALED_FACT" },
    ],
  },
  people: [
    { id: "P0", displayName: "Public family person" },
    {
      id: "P1",
      displayName: "SEALED_PERSON",
      aliases: ["SEALED_ALIAS"],
      sensitivity: "sealed",
    },
  ],
  oralHistories: [
    { id: "S1", transcript: "Normal draft", subjectId: "self", note: "A note" },
    {
      id: "S2",
      subjectId: "other",
      transcript: "SEALED_TRANSCRIPT",
      draft: "SEALED_DRAFT",
      entities: [{ text: "SEALED_ENTITY" }],
      sensitivity: "sealed",
    },
  ],
  capture: { documents: 10, photos: 2 },
  inventory: {
    documents: { originalLocation: "PRIVATE_LOCATION" },
    photos: { originalLocation: "SEALED_LOCATION", sensitivity: "sealed" },
  },
  session: { user: { uid: "self" } },
});
const bundle = (role, includeSealed = false) =>
  buildHandoverFiles(state(), {
    role,
    includeSealed,
    exportedBy: "PRIVATE_EXPORTER",
    nowIso: at,
  });
const content = (files) => files.map((f) => f.content).join("\n");
const parse = (files, path) =>
  JSON.parse(files.find((f) => f.path === path).content);
test("legacy state defaults to owner/family and empty aliases without a future access-control module", async () => {
  const files = buildHandoverFiles(
    {
      project: { tasks: [], history: [] },
      people: [{ id: "P", displayName: "Name" }],
    },
    { nowIso: at },
  );
  assert.equal(parse(files, "manifest.json").role, "owner");
  assert.deepEqual(parse(files, "people.json").people[0].aliases, []);
  assert.equal(parse(files, "people.json").people[0].sensitivity, "family");
  assert.ok(files.some((f) => f.path === "oral_histories/index.json"));
});
test("owner is default-redacted; only explicit owner inclusion reveals sealed originals", () => {
  assert.doesNotMatch(
    content(bundle("owner")),
    /SEALED_FACT|SEALED_PERSON|SEALED_ALIAS|SEALED_SOURCE|SEALED_TRANSCRIPT|SEALED_DRAFT|SEALED_ENTITY|SEALED_LOCATION/,
  );
  const all = content(bundle("owner", true));
  for (const marker of [
    "SEALED_FACT",
    "SEALED_PERSON",
    "SEALED_ALIAS",
    "SEALED_SOURCE",
    "SEALED_TRANSCRIPT",
    "SEALED_DRAFT",
    "SEALED_LOCATION",
  ])
    assert.ok(all.includes(marker), marker);
  assert.equal(
    parse(bundle("owner", true), "manifest.json").includeSealed,
    true,
  );
});
test("editor forces sealed redaction even when includeSealed is true, including history and encoded task assertions", () => {
  const files = bundle("editor", true);
  assert.equal(parse(files, "manifest.json").includeSealed, false);
  assert.doesNotMatch(
    content(files),
    /SEALED_FACT|SEALED_PERSON|SEALED_ALIAS|SEALED_SOURCE|SEALED_TRANSCRIPT|SEALED_DRAFT|SEALED_LOCATION/,
  );
  assert.match(content(files), /已封存 \/ SEALED/);
});
test("vendor strictly exports a whitelisted inventory and restricted tasks, never identity, assertion, oral or audit originals", () => {
  const files = bundle("vendor", true),
    all = content(files);
  assert.deepEqual(files.map((f) => f.path).sort(), [
    "README_HANDOVER.md",
    "audit_and_tasks.json",
    "digitization_inventory.json",
    "manifest.json",
  ]);
  assert.doesNotMatch(
    all,
    /SEALED_|PRIVATE_VENDOR|PRIVATE_LOCATION|PRIVATE_EVIDENCE|PRIVATE_ACTOR|PRIVATE_EXPORTER|Public family person/,
  );
  const tasks = parse(files, "audit_and_tasks.json");
  assert.deepEqual(Object.keys(tasks), ["tasks"]);
  assert.deepEqual(
    tasks.tasks.map((t) => t.id),
    ["WU-02", "WU-03"],
  );
  assert.deepEqual(Object.keys(tasks.tasks[0]).sort(), [
    "id",
    "status",
    "weekEnd",
    "weekStart",
  ]);
  const r = summarizeHandoverReadiness(state(), "vendor");
  assert.equal(r.people, 0);
  assert.equal(r.facts, 0);
  assert.equal(r.oralDrafts, 0);
  assert.equal(r.sealed, 0);
});
test("elder export includes only explicitly self-linked drafts and no full family records", () => {
  const files = bundle("elder");
  assert.ok(files.some((f) => f.path.startsWith("oral_histories/session-1-")));
  assert.ok(content(files).includes("Normal draft"));
  assert.doesNotMatch(
    content(files),
    /SEALED_TRANSCRIPT|PRIVATE_VENDOR|Public family person/,
  );
  assert.equal(
    files.some((f) => f.path === "people.json"),
    false,
  );
  const missing = state();
  delete missing.session;
  assert.equal(summarizeHandoverReadiness(missing, "elder").oralDrafts, 0);
  assert.ok(
    buildHandoverFiles(missing, { role: "elder", nowIso: at }).some(
      (f) => f.path === "oral_histories/index.json",
    ),
  );
});
test("nested sealed aliases and malformed embedded sealed records fail closed; inputs remain unchanged", () => {
  const input = state();
  input.people.push({
    id: "Nested",
    aliases: [{ sensitivity: "sealed", value: "NESTED_PRIVATE" }],
  });
  input.project.tasks.push({
    id: "WU-08",
    outcomes: '[broken {"sensitivity":"sealed", "text":"BROKEN_PRIVATE"',
  });
  const original = structuredClone(input);
  const files = buildHandoverFiles(input, { role: "editor" });
  assert.doesNotMatch(content(files), /NESTED_PRIVATE|BROKEN_PRIVATE/);
  assert.deepEqual(input, original);
});
test("manifest has schema, boundary in both languages, exact file list, placeholders and no circular self-hash", () => {
  const files = bundle("owner"),
    m = parse(files, "manifest.json");
  assert.equal(m.schemaVersion, "1.0.0");
  assert.equal(m.exportedAt, at);
  assert.equal(m.boundary.zh, handoverBoundary.zh);
  assert.match(
    m.boundary.en,
    /formal project acceptance, legal title, or a trust instrument/,
  );
  assert.deepEqual(
    m.files.map((f) => f.path),
    files.filter((f) => f.path !== "manifest.json").map((f) => f.path),
  );
  assert.ok(m.files.every((f) => f.sha256 === null));
});
test("native SHA-256 matches standard digest and has an explicit non-secure fallback; finalized hashes cover real UTF-8 bytes", async () => {
  assert.equal(
    await computeSha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.match(await computeSha256Hex("abc", null), /^UNAVAILABLE_SHA256/);
  const files = await finalizeHandoverFiles(bundle("editor"));
  const m = parse(files, "manifest.json");
  for (const f of m.files) {
    const row = files.find((v) => v.path === f.path);
    assert.equal(f.sha256, await computeSha256Hex(row.content));
    assert.equal(f.bytes, new TextEncoder().encode(row.content).length);
  }
  const fallback = await finalizeHandoverFiles(
    bundle("owner"),
    async () => "UNAVAILABLE_SHA256_INSECURE_CONTEXT",
  );
  assert.ok(
    parse(fallback, "manifest.json").files.every(
      (f) => f.sha256 === null && f.hashStatus.startsWith("UNAVAILABLE"),
    ),
  );
});
test("ZIP Store local/central/end headers, UTF-8 flag, CRC32 and offsets round-trip without external libraries", async () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const files = [
    { path: "口述史/初稿.md", content: "家族记忆 — 中文内容" },
    { path: "manifest.json", content: "{}" },
  ];
  const bytes = new Uint8Array(await createZipBlob(files).arrayBuffer()),
    view = new DataView(bytes.buffer),
    decoder = new TextDecoder();
  assert.equal(view.getUint32(0, true), 0x04034b50);
  let offset = 0;
  for (const file of files) {
    assert.equal(view.getUint16(offset + 6, true), 0x0800);
    assert.equal(view.getUint16(offset + 8, true), 0);
    const nameLength = view.getUint16(offset + 26, true),
      length = view.getUint32(offset + 18, true),
      start = offset + 30 + nameLength;
    assert.equal(decoder.decode(bytes.slice(offset + 30, start)), file.path);
    assert.equal(
      decoder.decode(bytes.slice(start, start + length)),
      file.content,
    );
    assert.equal(
      view.getUint32(offset + 14, true),
      crc32(bytes.slice(start, start + length)),
    );
    offset = start + length;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), files.length);
  assert.equal(view.getUint32(bytes.length - 6, true), offset);
  assert.throws(
    () => createZipBlob([{ path: "../escape", content: "x" }]),
    /Unsafe/,
  );
  assert.throws(
    () =>
      createZipBlob([
        { path: "A.json", content: "" },
        { path: "a.json", content: "" },
      ]),
    /duplicate/,
  );
});
test("existing membership mapping does not let a payload select owner; admin maps to editor and unknown formal users fail restricted", () => {
  const s = (role) => ({
    ready: true,
    mode: "formal",
    session: { admin: { role } },
  });
  assert.equal(currentHandoverRole(s("owner")), "owner");
  assert.equal(currentHandoverRole(s("admin")), "editor");
  assert.equal(currentHandoverRole(s("editor")), "editor");
  assert.equal(currentHandoverRole(s("unknown")), "vendor");
  assert.equal(currentHandoverRole({ ...s("owner"), ready: false }), "vendor");
});

test("command export snapshots actual session notes, ignores payload role, audits current data and cancels on identity change", async () => {
  const { store } = await import("../dfplan/src/application/store.mjs");
  const { commands } =
    await import("../dfplan/src/application/command-bus.mjs");
  const { setStoragePort } =
    await import("../dfplan/src/application/actions.mjs");
  const { seedTasks } = await import("../dfplan/src/domain/seed-tasks.mjs");
  const { installHandoverCommands, registerHandoverRecordings } =
    await import("../dfplan/src/application/handover.mjs");
  const previous = store.getState();
  let downloads = [],
    saved = 0,
    filesBuilt = [],
    statuses = [],
    finalizer = async (files) => files;
  const project = {
    startDate: "",
    tasks: structuredClone(seedTasks),
    history: [],
  };
  installHandoverCommands({
    projectId: "real-project-key",
    finalize: (files) => {
      filesBuilt = files;
      return finalizer(files);
    },
    zip: () => new Blob(["zip"]),
    download: (blob, name) => downloads.push(name),
    status: (status) => statuses.push(status),
  });
  registerHandoverRecordings(
    () => ({
      clips: [
        {
          id: "actual-clip",
          transcript: "ACTUAL_SESSION_NOTES",
          note: "manual note",
          consent: { recording: true },
        },
      ],
    }),
    () => () => {},
  );
  setStoragePort({
    async save() {
      throw Error("Ordinary no-op save must not be used for cloud audit.");
    },
    async audit(text, textEn) {
      saved++;
      const next = store.getState().project;
      return {
        project: {
          ...next,
          history: [
            ...next.history,
            { id: String(saved), at, actor: "Test", text, textEn },
          ],
        },
      };
    },
  });
  try {
    store.update({
      ready: true,
      mode: "formal",
      project,
      people: state().people,
      peopleReady: true,
      language: "en",
      session: {
        user: { uid: "same", email: "test@example.invalid" },
        admin: { role: "editor", displayName: "Test" },
      },
    });
    await commands.run("handover-export", {
      format: "zip",
      role: "owner",
      includeSealed: "true",
    });
    assert.equal(downloads.length, 1);
    assert.equal(saved, 1);
    assert.equal(parse(filesBuilt, "manifest.json").role, "editor");
    assert.equal(
      parse(filesBuilt, "manifest.json").projectId,
      "real-project-key",
    );
    assert.equal(parse(filesBuilt, "manifest.json").includeSealed, false);
    assert.ok(content(filesBuilt).includes("ACTUAL_SESSION_NOTES"));
    assert.ok(
      store.getState().project.history[0].text.includes("handover-export"),
    );
    store.update({ peopleReady: false });
    await assert.rejects(
      commands.run("handover-export", { format: "json" }),
      /directory has not loaded/,
    );
    assert.equal(downloads.length, 1);
    assert.equal(saved, 1);
    store.update({ peopleReady: true });
    setStoragePort({
      async audit() {
        return { project: store.getState().project };
      },
    });
    await assert.rejects(
      commands.run("handover-audit", {
        event: { type: "missing-audit", role: "editor" },
      }),
      /audit/,
    );
    let finish;
    finalizer = (files) =>
      new Promise((resolve) => (finish = () => resolve(files)));
    const pending = commands.run("handover-export", { format: "json" });
    store.update({
      session: {
        user: { uid: "changed" },
        admin: { role: "owner", displayName: "Changed" },
      },
    });
    finish();
    await assert.rejects(pending, /Identity changed/);
    assert.equal(downloads.length, 1);
    assert.equal(saved, 1);
  } finally {
    store.update(previous);
    setStoragePort(null);
    registerHandoverRecordings(
      () => null,
      () => () => {},
    );
  }
});

test("sealed history-only records cannot leak through later unclassified history copies", () => {
  const input = {
    project: {
      tasks: [],
      history: [
        {
          id: "old",
          at,
          actor: "Test",
          text: "HISTORY_ONLY_SECRET",
          sensitivity: "sealed",
        },
        { id: "copy", at, actor: "Test", text: "copied HISTORY_ONLY_SECRET" },
      ],
    },
  };
  assert.equal(
    summarizeHandoverReadiness(input, "owner").hasSealedContent,
    true,
  );
  assert.doesNotMatch(
    content(buildHandoverFiles(input, { role: "editor" })),
    /HISTORY_ONLY_SECRET/,
  );
  assert.match(
    content(buildHandoverFiles(input, { role: "owner", includeSealed: true })),
    /HISTORY_ONLY_SECRET/,
  );
});

test("recording-only consent is a self-reported summary, never inferred from an imported clip or expanded to AI/publication rights", () => {
  const input = {
    project: { tasks: [], history: [] },
    oralHistories: [
      {
        id: "recorded",
        startedAt: at,
        transcript: "words",
        consent: {
          recording: true,
          publication: "not_recorded",
          ai: "not_recorded",
        },
      },
      { id: "imported", transcript: "imported words" },
    ],
  };
  const summary = parse(
    buildHandoverFiles(input),
    "audit_and_tasks.json",
  ).consentSummary;
  assert.equal(summary.length, 1);
  assert.equal(summary[0].sessionId, "recorded");
  assert.equal(summary[0].subjectId, null);
  assert.equal(summary[0].scope, "recording-only");
  assert.equal(summary[0].status, "self-reported-at-recording");
  assert.equal(summary[0].otherRights, "not-established");
  assert.equal(
    Object.hasOwn(
      parse(
        buildHandoverFiles(input, { role: "vendor" }),
        "audit_and_tasks.json",
      ),
      "consentSummary",
    ),
    false,
  );
});

test("standard handover retains every existing bilingual task storage field but no arbitrary session fields", async () => {
  const { seedTasks } = await import("../dfplan/src/domain/seed-tasks.mjs");
  const { taskStorageFields } =
    await import("../dfplan/src/domain/task-schema.mjs");
  const source = {
    ...structuredClone(seedTasks[0]),
    outcomes: "Original note",
    sessionToken: "NEVER_EXPORT_SESSION_TOKEN",
  };
  const files = buildHandoverFiles({
    project: { tasks: [source], history: [] },
  });
  const row = parse(files, "audit_and_tasks.json").tasks[0];
  for (const key of taskStorageFields)
    if (key !== "outcomes" && source[key] !== undefined)
      assert.deepEqual(row[key], source[key], key);
  assert.equal(row.outcomes.text, "Original note");
  assert.doesNotMatch(content(files), /NEVER_EXPORT_SESSION_TOKEN/);
});
