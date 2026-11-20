// @ts-check
import {
  csvCell,
  statuses,
  statusEn,
  targetDate,
  taskStorageFields,
} from "./task-schema.mjs";
import { captureCatalog } from "./capture-catalog.mjs";
import { captureMethods } from "./capture-methods.mjs";
import { estimateCatalogue } from "./digitization-calc.mjs";
import { handoverTexts, handoverMappings } from "./i18n.mjs";
export { handoverMappings } from "./i18n.mjs";
import { defaultUnitRates, unitRateKeys } from "./unit-pricing.mjs";
import { readAssertions } from "./stewardship-model.mjs";
import { stewardshipFields } from "./stewardship-model.mjs";
export function projectCSV(project, language = "zh") {
  const value = (task, key) =>
    language === "en" && task[key + "En"] ? task[key + "En"] : task[key] || "";
  const header =
    language === "en"
      ? [
          "ID",
          "Action",
          "Priority",
          "Responsibility",
          "Assignee",
          "Collaborators",
          "Status",
          "Start week",
          "End week",
          "Due date",
          "Completed on",
          "Action steps",
          "Deliverables",
          "Dependencies",
          "Next steps",
          "Evidence",
          "Task accepted",
        ]
      : [
          "编号",
          "行动",
          "优先级",
          "负责人职责",
          "具体人名",
          "配合人员",
          "状态",
          "开始周",
          "结束周",
          "截止日",
          "完成日",
          "具体行动",
          "交付物",
          "前置条件",
          "下一步",
          "凭据",
          "任务已确认",
        ];
  const rows = [
    [
      ...header,
      ...stewardshipFields.map(([, zh, en]) => (language === "en" ? en : zh)),
    ],
    ...project.tasks.map((task) => [
      task.id,
      value(task, "title"),
      task.priority,
      value(task, "owner"),
      task.assignee || "",
      value(task, "collaborators"),
      language === "en"
        ? statusEn[statuses.indexOf(task.status)] || task.status
        : task.status,
      task.weekStart,
      task.weekEnd,
      targetDate(task, project.startDate),
      task.completed,
      value(task, "action"),
      value(task, "deliverable"),
      value(task, "dependency"),
      task.next,
      task.evidence,
      task.accepted
        ? language === "en"
          ? "Yes"
          : "是"
        : language === "en"
          ? "No"
          : "否",
      ...stewardshipFields.map(([key]) => task[key] || ""),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function projectJSON(project, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ schemaVersion: 1, exportedAt, ...project }, null, 2);
}

/** @typedef {'owner'|'editor'|'vendor'|'elder'} HandoverRole */
/** @typedef {{path:string,content:string}} HandoverFile */
/** @typedef {Record<string, any>} HandoverState */
export const handoverBoundary = Object.freeze({
  zh: handoverTexts.zh.handoverBoundary,
  en: handoverTexts.en.handoverBoundary,
});
const SEALED = "[已封存 / SEALED]";
const array = (value) => (Array.isArray(value) ? value : []);
const level = (value) =>
  ["public", "family", "sealed"].includes(value?.sensitivity)
    ? value.sensitivity
    : "family";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const pick = (value, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => value?.[key] !== undefined)
      .map((key) => [key, value[key]]),
  );
/** @returns {import("./types.mjs").UnitRates} */
const ratesFor = (state) =>
  /** @type {import("./types.mjs").UnitRates} */ (
    Object.fromEntries(
      unitRateKeys.map((key) => [
        key,
        Math.max(
          0,
          Number(
            state.pricing?.record?.rates?.[key] ?? defaultUnitRates[key],
          ) || 0,
        ),
      ]),
    )
  );
function hasSealed(value) {
  if (typeof value === "string")
    return /"sensitivity"\s*:\s*"sealed"/.test(value);
  if (Array.isArray(value)) return value.some(hasSealed);
  return (
    !!value &&
    typeof value === "object" &&
    (level(value) === "sealed" || Object.values(value).some(hasSealed))
  );
}
const knownRole = (role) =>
  ["owner", "editor", "vendor", "elder"].includes(role) ? role : "vendor";
function redact(value, include) {
  if (Array.isArray(value)) return value.map((row) => redact(row, include));
  if (value && typeof value === "object") {
    if (level(value) === "sealed" && !include)
      return { sensitivity: "sealed", redacted: true, text: SEALED };
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redact(item, include)]),
    );
  }
  return value;
}
function factsFor(state) {
  return [
    ...array(state.facts),
    ...array(state.project?.tasks).flatMap((task) =>
      readAssertions(String(task.outcomes || "")).assertions.map((fact) => ({
        ...fact,
        taskId: task.id,
        sensitivity: level(task) === "sealed" ? "sealed" : level(fact),
      })),
    ),
  ];
}
function oralFor(state, role) {
  const rows = array(state.oralHistories);
  if (role !== "elder") return rows;
  const self = String(state.currentPersonId || state.session?.user?.uid || "");
  return self
    ? rows.filter((row) => String(row.personId || row.subjectId || "") === self)
    : [];
}
/** Optional compatibility role: defaults to owner for callers supplying legacy state. No account authorization is implemented here. */
export function summarizeHandoverReadiness(state, role = "owner") {
  role = knownRole(role);
  const restricted = role === "vendor" || role === "elder",
    people = restricted ? [] : array(state.people),
    facts = restricted ? [] : factsFor(state);
  const oral = role === "vendor" ? [] : oralFor(state, role);
  const tasks =
    role === "elder"
      ? []
      : array(state.project?.tasks).filter(
          (task) => role !== "vendor" || ["WU-02", "WU-03"].includes(task.id),
        );
  const rates = ratesFor(state);
  const result = estimateCatalogue(state.capture || {}, rates, state.team || 4);
  return {
    hasSealedContent:
      !restricted &&
      hasSealed([
        people,
        facts,
        oral,
        tasks,
        state.inventory,
        state.project?.history,
        state.consents,
      ]),
    people: people.length,
    aliases: people.reduce((n, p) => n + array(p.aliases).length, 0),
    facts: facts.length,
    pendingFacts: facts.filter((f) => f.status !== "confirmed").length,
    sealed: restricted
      ? 0
      : facts.filter((f) => level(f) === "sealed").length +
        people.filter((p) => level(p) === "sealed").length +
        oral.filter((o) => level(o) === "sealed").length +
        tasks.filter((t) => level(t) === "sealed").length,
    oralDrafts: oral.filter((row) =>
      [row.transcript, row.note, row.draft].some(
        (text) => typeof text === "string" && text.trim(),
      ),
    ).length,
    oralRecordings: oral.length,
    digitizationItems:
      role === "elder"
        ? 0
        : captureCatalog.filter((row) => Number(state.capture?.[row.id]) > 0)
            .length,
    budgetCents: role === "elder" ? 0 : result.unitQuoteCents,
    completedTasks: tasks.filter((t) => t.status === "已完成").length,
    taskCount: tasks.length,
    completionPercent: tasks.length
      ? Math.round(
          (tasks.filter((t) => t.status === "已完成").length / tasks.length) *
            100,
        )
      : null,
  };
}
/** @param {HandoverState} state @param {{role?:string,includeSealed?:boolean,exportedBy?:string,nowIso?:string}} options @returns {HandoverFile[]} */
export function buildHandoverFiles(
  state,
  {
    role = "owner",
    includeSealed = false,
    exportedBy = "",
    nowIso = new Date().toISOString(),
  } = {},
) {
  role = knownRole(role);
  const include = role === "owner" && includeSealed === true,
    files = [];
  const add = (path, value) =>
    files.push({
      path,
      content:
        typeof value === "string" ? value : JSON.stringify(value, null, 2),
    });
  const project = object(state.project),
    tasks = array(project.tasks),
    facts = factsFor(state);
  const rates = ratesFor(state),
    quantities = object(state.capture);
  const projectId = String(state.projectId || project.id || "dfplan");
  if (role !== "vendor" && role !== "elder") {
    add("people.json", {
      people: array(state.people).map((p) =>
        redact(
          {
            ...pick(p, [
              "id",
              "displayName",
              "responsibility",
              "active",
              "zi",
              "hao",
              "dialectAliases",
              "englishAliases",
            ]),
            aliases: array(p.aliases),
            oldPlaceTags: array(p.oldPlaceTags),
            sensitivity: level(p),
          },
          include,
        ),
      ),
    });
    add("facts_and_assertions.json", {
      facts: facts.map((f) =>
        redact(
          {
            ...pick(f, [
              "id",
              "taskId",
              "text",
              "status",
              "source",
              "evidenceRef",
              "controlledReference",
              "note",
              "updatedAt",
              "personIds",
              "consent",
            ]),
            sensitivity: level(f),
          },
          include,
        ),
      ),
      verification:
        "Unverified unless explicitly recorded; not formal acceptance.",
    });
  }
  if (role !== "elder") {
    add("digitization_inventory.json", {
      currency: "SGD",
      selectedItems: captureCatalog.filter((r) => Number(quantities[r.id]) > 0)
        .length,
      items: captureCatalog.map((row) => ({
        id: row.id,
        label: { zh: row.zh, en: row.en },
        quantity: Math.max(
          0,
          Math.min(100000, Number(quantities[row.id]) || 0),
        ),
        unit: { zh: row.unitZh, en: row.unitEn },
        rateKey: row.rate,
        unitRateCents: rates[row.rate],
        ...(role === "vendor"
          ? {}
          : redact(
              {
                endangermentPriority:
                  state.inventory?.[row.id]?.endangermentPriority ||
                  "not_assessed",
                originalLocation:
                  state.inventory?.[row.id]?.originalLocation || null,
                sensitivity: level(state.inventory?.[row.id]),
              },
              include,
            )),
      })),
      rates,
      estimate: estimateCatalogue(quantities, rates, state.team || 4),
      methods: captureMethods.map((m) => ({
        media: { zh: m[0], en: m[1] },
        risk: { zh: m[2], en: m[3] },
        candidateEquipment: { zh: m[4], en: m[5] },
        targetOutput: { zh: m[6], en: m[7] },
        handling: { zh: m[8], en: m[9] },
      })),
      note: "Planning quantities, not proof of captured files or completed work.",
    });
    const anySealed = hasSealed([
      facts,
      tasks,
      state.people,
      state.oralHistories,
      state.inventory,
      project.history,
      state.consents,
    ]);
    add("audit_and_tasks.json", {
      tasks: tasks
        .filter((t) => role !== "vendor" || ["WU-02", "WU-03"].includes(t.id))
        .map((task) => {
          if (role === "vendor")
            return {
              id: task.id,
              status: statuses.includes(task.status)
                ? task.status
                : "unverified",
              weekStart: Number(task.weekStart) || 0,
              weekEnd: Number(task.weekEnd) || 0,
            };
          const parsed = readAssertions(String(task.outcomes || "")),
            relatedSealed =
              hasSealed(task) ||
              facts.some((f) => f.taskId === task.id && level(f) === "sealed");
          if (relatedSealed && !include)
            return {
              id: task.id,
              sensitivity: "sealed",
              redacted: true,
              text: SEALED,
            };
          return redact(
            {
              ...pick(task, taskStorageFields),
              sensitivity: level(task),
              outcomes: { text: parsed.text, assertions: parsed.assertions },
            },
            include,
          );
        }),
      ...(role === "vendor"
        ? {}
        : {
            history: array(project.history).map((h) =>
              anySealed && !include
                ? { ...pick(h, ["id", "at"]), text: SEALED, redacted: true }
                : redact(
                    pick(h, [
                      "id",
                      "at",
                      "actor",
                      "text",
                      "textEn",
                      "sensitivity",
                    ]),
                    include,
                  ),
            ),
            consentSummary: [
              ...array(state.consents),
              ...array(state.oralHistories).flatMap((row, index) =>
                row.consent?.recording === true
                  ? [
                      {
                        id: `oral-consent-${index + 1}`,
                        sessionId: row.id || null,
                        subjectId: row.personId || row.subjectId || null,
                        scope: "recording-only",
                        status: "self-reported-at-recording",
                        at: row.startedAt || null,
                        otherRights: "not-established",
                        sensitivity: hasSealed(row) ? "sealed" : "family",
                      },
                    ]
                  : [],
              ),
            ].map((c) =>
              redact(
                pick(c, [
                  "id",
                  "subjectId",
                  "sessionId",
                  "otherRights",
                  "scope",
                  "status",
                  "at",
                  "sensitivity",
                ]),
                include,
              ),
            ),
            consentNotice:
              "Absence of a consent record is not permission; recording consent does not grant publication or AI rights.",
          }),
    });
  }
  if (role !== "vendor") {
    const oral = oralFor(state, role);
    if (!oral.length)
      add("oral_histories/index.json", {
        sessions: [],
        note: {
          zh: "当前无可导出的口述初稿。音频须另行授权移交，本包不含音频。",
          en: "No eligible oral-history drafts in this session. Audio requires a separate authorized handover and is not included.",
        },
      });
    oral.forEach((row, index) => {
      const hidden = hasSealed(row) && !include;
      const id = hidden
        ? `session-${index + 1}`
        : `session-${index + 1}-${encodeURIComponent(String(row.id || index + 1)).slice(0, 100)}`;
      const record = hidden
        ? {
            sensitivity: "sealed",
            redacted: true,
            text: SEALED,
            verification: "unverified",
            audioIncluded: false,
          }
        : redact(
            {
              ...pick(row, [
                "id",
                "personId",
                "subjectId",
                "startedAt",
                "prompt",
                "transcript",
                "machineTranscript",
                "transcriptEdited",
                "note",
                "duration",
                "entities",
                "draft",
                "source",
                "consent",
              ]),
              sensitivity: level(row),
              verification: "unverified",
              audioIncluded: false,
            },
            include,
          );
      add(`oral_histories/${id}/transcript.json`, record);
      const transcript = hidden ? SEALED : String(row.transcript || ""),
        draft = hidden
          ? SEALED
          : String(
              row.draft ||
                row.note ||
                row.transcript ||
                "尚无转写 / No transcript yet",
            );
      add(
        `oral_histories/${id}/draft.md`,
        `# [待核实 / UNVERIFIED] ${hidden ? "Oral history" : String(row.source === "scripted-sample" ? "脚本示例 / SCRIPTED SAMPLE" : "口述初稿 / Oral-history draft")}\n\n${draft}\n\n## 原始文字 / Original transcript\n\n${transcript}\n\n${handoverBoundary.zh}\n\n${handoverBoundary.en}\n`,
      );
    });
  }
  const mappings =
    role === "vendor"
      ? [
          [
            "digitization_inventory.json",
            "采集明细、规划单价与候选工艺；未来入库元数据。",
            "Collection quantities, planning rates and candidate methods; future ingestion metadata.",
          ],
          [
            "audit_and_tasks.json",
            "仅 WU-02 / WU-03 状态与计划周数，不含人员、凭据或变更原文。",
            "Only WU-02 / WU-03 status and planned weeks; no identities, evidence or history text.",
          ],
        ]
      : role === "elder"
        ? [
            [
              "oral_histories/",
              "仅明确绑定本人的口述初稿，待核实；无绑定则为空。",
              "Only explicitly self-linked, unverified drafts; empty without an identity link.",
            ],
          ]
        : handoverMappings;
  add(
    "README_HANDOVER.md",
    `# DeepFamily Ingestion Bundle — Phase 1\n\n${handoverBoundary.zh}\n\n${handoverBoundary.en}\n\nSchema: 1.0.0 · Role: ${role} · Sealed originals: ${include}\n\n本包不包含成品 App、家谱渲染、电子书、在线纪念馆或原始音视频。下列 App 映射仅为未来输入用途，不表示功能已建成或已完成正式验收。\nThis is not a finished App, family-tree renderer, ebook, online memorial or media backup. The mappings below are future input purposes, not implemented product features or acceptance evidence.\n\n${mappings.map(([file, zh, en]) => `## ${file}\n${zh}\n\n${en}`).join("\n\n")}\n\n字段 / Fields: IDs 为源记录编号；sensitivity 缺省 family；aliases 缺省 []；unverified 表示待核实；not_assessed / null 表示尚未评估或未登记；预算为规划估算，不是已采集完成的资产价值。\nIDs reference source records; sensitivity defaults to family; aliases default to []; unverified requires review; not_assessed/null means missing assessment or registration; budgets are planning estimates, not captured-asset valuations.\n\n完整性 / Integrity: manifest.files lists every other file; SHA-256 covers UTF-8 content bytes. manifest.json excludes its own hash to avoid circularity. A null/unavailable hash is not verification. Hashes detect changes, not legal authenticity. ZIP Store is not encryption; keep exported archives on encrypted storage.\n`,
  );
  add("manifest.json", {
    schemaVersion: "1.0.0",
    projectId,
    exportedAt: nowIso,
    exportedBy: role === "vendor" ? "" : String(exportedBy),
    role,
    includeSealed: include,
    boundary: handoverBoundary,
    readiness: summarizeHandoverReadiness(state, role),
    integrity: {
      algorithm: "SHA-256",
      manifestSelfHash: "excluded-to-avoid-circularity",
    },
    files: files.map((f) => ({
      path: f.path,
      sha256: null,
      hashStatus: "pending-native-sha256",
    })),
  });
  return files;
}
