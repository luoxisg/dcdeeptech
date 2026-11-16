import {
  renderDashboard,
  matchesDashboardTask,
} from "./dashboard.mjs?v=20261116-people";
import {
  renderPeople,
  assigneeSelect,
} from "./people-ui.mjs?v=20261116-people";
import {
  cloudEnabled,
  connectBackend,
} from "./backend-client.js?v=20261116-people";
import {
  cloudError,
  cloudGate,
  cloudBar,
  adminDialog,
  guestDialog,
} from "./cloud-ui.js?v=20261116-people";
import {
  renderPhone,
  phoneEditor,
  matchesCategory,
} from "./phone-ui.js?v=20261116-people";
import { seedTasks } from "./data.js";
import {
  statuses,
  statusEn,
  targetDate,
  today,
  validateProject,
  csvCell,
} from "./model.mjs";

const KEY = "deepfamily.dfplan.v1",
  LANG = "deepfamily.dfplan.language";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const phoneQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia(
        "(max-width: 900px), (pointer: coarse) and (max-width: 1200px)",
      )
    : { matches: false };
const isPhone = () => phoneQuery.matches;
let largeText = false;
try {
  largeText = localStorage.getItem("deepfamily.dfplan.largeText") === "true";
} catch {}
const icons = {
  text: "M3 5h12M9 5v15m-5 0h10M16 12h6m-3 0v8m-3 0h6",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  people:
    "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 21v-4a6 6 0 0 1 12 0v4M17 5a3 3 0 0 1 0 6m2 10v-4a5 5 0 0 0-2-4",
  photo: "M3 4h18v16H3zM3 16l6-7 5 6 3-4 4 5M16 7h1",
  backup: "M4 4h15l2 2v15H3V4zM7 4v6h10V4M7 21v-7h10v7",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8",
  archive: "M3 3h18v5H3zM5 8v13h14V8M9 12h6",
  tree: "M12 21V5M4 18v-5h16v5M7 8h10M5 21h-2v-3h4v3zM11 5h-2V2h6v3h-4M19 21h-2v-3h4v3z",
  app: "M6 2h12v20H6zM10 18h4M9 6h6M9 10h6",
  review: "M8 3h8v3H8zM8 4H4v18h16V4h-4M8 13l3 3 5-6",
  handover: "M3 12h4v9H3zM7 14l4-2h8a2 2 0 0 1 0 4h-5m-7 4h9l6-5M12 4l3 3 5-5",
  question:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3M12 17h.01",
  play: "m9 5 11 7-11 7z",
  pause: "M7 5v14M17 5v14",
  home: "M3 10 12 3l9 7v10H3z M9 20v-7h6v7",
  board: "M3 4h5v16H3z M10 4h5v10h-5z M17 4h4v13h-4z",
  list: "M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1",
  timeline: "M4 4v16h17M8 7h9M11 12h9M7 17h7",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2",
  arrow: "M5 12h14M14 7l5 5-5 5",
  plus: "M12 5v14M5 12h14",
  search: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16M16 16l6 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  upload: "M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4",
  check: "m5 12 4 4L19 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2",
  calendar: "M4 5h16v16H4z M8 2v6M16 2v6M4 10h16",
  close: "m6 6 12 12M18 6 6 18",
  menu: "M4 6h16M4 12h16M4 18h16",
  leaf: "M20 3C8 2 2 6 5 14c3 8 16 6 15-11ZM4 21 15 10",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  chevron: "m9 5 7 7-7 7",
  folder: "M3 6h7l2 3h9v11H3z",
  globe:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18",
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.leaf}"/></svg>`;
const art = (name) =>
  `<span class="phone-picture" aria-hidden="true"><svg viewBox="0 0 96 96" fill="none"><rect x="4" y="4" width="88" height="88" rx="25" fill="#e8eedf"/><circle cx="75" cy="20" r="10" fill="#ecdcc7"/><path d="M13 76c10-7 20-7 29 0" stroke="#b2bd9b" stroke-width="2"/><g transform="translate(20 20) scale(2.3)" stroke="#284f3d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[name] || icons.leaf}"/></g></svg></span>`;
let lang =
  new URLSearchParams(location.search).get("lang") === "en" ? "en" : "zh";
try {
  if (!new URLSearchParams(location.search).has("lang"))
    lang = localStorage.getItem(LANG) === "en" ? "en" : "zh";
} catch {}
let project = { startDate: "", tasks: structuredClone(seedTasks), history: [] };
let storageIssue = false;
try {
  const saved = localStorage.getItem(KEY);
  if (saved) project = validateProject(JSON.parse(saved));
} catch {
  storageIssue = true;
}
const legacyProject = storageIssue ? null : structuredClone(project);
const hasLegacy = (() => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
})();
let startBaseline = "",
  pendingImportRevision = -1;
let cloud = null,
  cloudSession = { phase: cloudEnabled ? "connecting" : "local" },
  cloudLoaded = false,
  cloudRevision = -1,
  cloudUpdatedAt = "",
  cloudMessage = "",
  cloudSaving = false;
if (cloudEnabled) {
  project = { startDate: "", tasks: structuredClone(seedTasks), history: [] };
  storageIssue = false;
}
const cloudReady = () => cloudSession.phase === "ready" && cloudLoaded;
let people = [],
  peopleReady = false,
  peopleMessage = "",
  peopleBusy = false,
  peopleFormError = "";
let peopleDraft = { displayName: "", responsibility: "" };
let dashboardSelection = { person: "all", priority: "all" },
  dashboardDrilldown = null;
const canManagePeople = () =>
  cloudReady() && ["owner", "admin"].includes(cloudSession.admin?.role);
const views = [
  "overview",
  "board",
  "list",
  "timeline",
  "history",
  "dashboard",
  "people",
];
let view = views.includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "overview",
  category = "all",
  query = "",
  filter = "all",
  owner = "",
  mobile = false,
  editing = null,
  editingWasNew = false,
  pendingImport = null;
const s = (zh, en) => (lang === "en" ? en : zh);
const names = () => [
  s("传承总览", "Overview"),
  s("任务看板", "Task board"),
  s("行动清单", "Action list"),
  s("传承时间线", "Timeline"),
  s("更新记录", "Activity log"),
  s("仪表盘", "Dashboard"),
  s("人员管理", "People"),
];
const value = (t, k) =>
  lang === "en" && t[k + "En"] ? t[k + "En"] : t[k] || "";
const statusLabel = (st) =>
  lang === "en" ? statusEn[statuses.indexOf(st)] || st : st;
const dateLabel = (d) => d || s("待确定", "To be agreed");
const fmt = (at) =>
  new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(at));
const due = (t) => targetDate(t, project.startDate);
const overdue = (t) => !!due(t) && due(t) < today() && t.status !== "已完成";
const complete = (t) =>
  t.status === "已完成" && t.accepted && !!t.evidence.trim() && !!t.completed;
const statusBadge = (t) =>
  `<span class="status status-${statuses.indexOf(t.status)}"><i></i>${esc(statusLabel(t.status))}</span>`;
const priority = (t) =>
  `<span class="priority ${t.priority}">${t.priority}</span>`;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4500);
}
async function persist(next, zh, en, replacing = false) {
  if (cloudEnabled) {
    if (!cloudReady() || cloudSaving) {
      toast(
        s(
          "请先登录并等待云端读取完成。",
          "Sign in and wait for the cloud records to load.",
        ),
      );
      return false;
    }
    cloudSaving = true;
    const submit = $('#task-form [type="submit"]');
    if (submit) submit.disabled = true;
    document.body.classList.add("cloud-saving");
    try {
      await cloud.save(next, cloudRevision, zh, en);
      cloudMessage = "";
      toast(
        s(
          "已保存到后端，其他管理员会同步看到。",
          "Saved in the backend. Other administrators will receive the update.",
        ),
      );
      return true;
    } catch (error) {
      cloudMessage = cloudError(error, lang);
      toast(cloudMessage);
      return false;
    } finally {
      cloudSaving = false;
      document.body.classList.remove("cloud-saving");
      if (submit) submit.disabled = false;
      render();
    }
  }
  if (storageIssue && !replacing) {
    toast(
      s(
        "请先导出模板或导入有效备份，再恢复编辑，避免覆盖无法读取的本机数据。",
        "Import a valid backup before editing to avoid overwriting unreadable browser data.",
      ),
    );
    return false;
  }
  const at = new Date().toISOString();
  next.history = [
    {
      id: crypto.randomUUID(),
      at,
      actor: s("本机用户", "Local user"),
      text: zh,
      textEn: en,
    },
    ...project.history,
  ].slice(0, 5000);
  try {
    validateProject(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    project = next;
    storageIssue = false;
    render();
    toast(s("已保存到当前浏览器", "Saved in this browser"));
    return true;
  } catch {
    toast(
      s(
        "保存失败，请导出备份并检查浏览器存储空间。",
        "Save failed. Export a backup and check browser storage.",
      ),
    );
    return false;
  }
}
function filtered() {
  return project.tasks.filter(
    (t) =>
      (!query ||
        [
          t.id,
          t.title,
          t.titleEn,
          t.owner,
          t.ownerEn,
          t.assignee,
          t.action,
          t.actionEn,
          t.next,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!owner || t.owner === owner || t.assignee === owner) &&
      (filter === "all" ||
        (["P0", "P1", "P2"].includes(filter) && t.priority === filter) ||
        (filter === "overdue" && overdue(t)) ||
        t.status === filter) &&
      matchesCategory(t, category) &&
      (!dashboardDrilldown ||
        matchesDashboardTask(t, project, people, dashboardDrilldown)),
  );
}
function changeView(v, reset = true) {
  if (reset) dashboardDrilldown = null;
  if (isPhone() && reset) {
    query = "";
    filter = "all";
    owner = "";
    category = "all";
  }
  view = v;
  mobile = false;
  location.hash = v;
  render();
  (document.querySelector(".module-heading h1") || $("#page-title"))?.focus({
    preventScroll: true,
  });
  if (isPhone()) window.scrollTo({ top: 0, behavior: "instant" });
}
function toolbar() {
  return `<div class="toolbar"><label class="search">${icon("search")}<input id="search" type="search" aria-label="${s("搜索任务", "Search tasks")}" placeholder="${s("搜索任务、负责人或下一步…", "Search tasks, people or next steps…")}" value="${esc(query)}"></label><select id="owner-filter" aria-label="${s("筛选负责人", "Filter by owner")}"><option value="">${s("全部负责人", "All owners")}</option>${[
    ...new Set(project.tasks.flatMap((t) => [t.assignee, t.owner])),
  ]
    .filter(Boolean)
    .map(
      (o) =>
        `<option value="${esc(o)}" ${owner === o ? "selected" : ""}>${esc(
          project.tasks.some((t) => t.owner === o)
            ? value(
                project.tasks.find((t) => t.owner === o),
                "owner",
              )
            : o,
        )}</option>`,
    )
    .join(
      "",
    )}</select><select id="status-filter" aria-label="${s("筛选状态", "Filter by status")}"><option value="all">${s("全部任务", "All tasks")}</option><option value="P0" ${filter === "P0" ? "selected" : ""}>${s("P0 优先事项", "P0 priorities")}</option><option value="overdue" ${filter === "overdue" ? "selected" : ""}>${s("已逾期", "Overdue")}</option>${statuses.map((st) => `<option value="${st}" ${filter === st ? "selected" : ""}>${esc(statusLabel(st))}</option>`).join("")}</select><span class="results">${filtered().length} ${s("项", "tasks")}</span>${query || filter !== "all" || owner ? `<button class="text-button" data-action="clear">${s("清除", "Clear")}</button>` : ""}</div>`;
}
function taskCard(t) {
  return `<article class="task-card" draggable="true" data-task="${esc(t.id)}"><button class="card-open" data-action="edit" data-id="${esc(t.id)}"><span class="card-meta"><span>${esc(t.id)}</span>${priority(t)}${icon("arrow")}</span><h3>${esc(value(t, "title"))}</h3><p>${esc(t.next || value(t, "action"))}</p><span class="card-person"><i>${esc((t.assignee || value(t, "owner")).slice(0, 1) || "?")}</i>${esc(t.assignee || s("人名待确认", "Person to confirm"))} · ${esc(value(t, "owner"))}</span><span class="card-date ${overdue(t) ? "late" : ""}">${icon("calendar")}${esc(dateLabel(due(t)))}<small>W${t.weekStart}–${t.weekEnd}</small></span></button><select class="status-select status-${statuses.indexOf(t.status)}" data-status="${esc(t.id)}" aria-label="${esc(t.id + " " + s("状态", "status"))}">${statuses.map((st) => `<option value="${st}" ${t.status === st ? "selected" : ""}>${esc(statusLabel(st))}</option>`).join("")}</select></article>`;
}
function empty() {
  return `<div class="empty">${icon("search")}<h3>${s("未找到匹配的行动", "No matching actions")}</h3><p>${s("试试其他关键词，或清除筛选。", "Try another keyword or clear the filters.")}</p><button class="secondary" data-action="clear">${s("清除筛选", "Clear filters")}</button></div>`;
}
function overview() {
  const rows = filtered(),
    p0 = rows.filter((t) => t.priority === "P0");
  return `<div class="overview-grid"><section class="priority-panel"><div class="panel-top"><div><span class="section-kicker">01 / ${s("筑牢根基", "LAY THE FOUNDATIONS")}</span><h2>${s("先把这几件事落实", "Start with what matters")}</h2></div><span class="outline-tag">P0 · ${s("优先行动", "PRIORITY")}</span></div>${p0.map((t) => `<button class="focus-row" data-action="edit" data-id="${esc(t.id)}"><span class="task-index">${esc(t.id.slice(-2))}</span><span class="focus-body"><strong>${esc(value(t, "title"))}</strong><span>${esc(t.next || value(t, "deliverable"))}</span><small>${esc(t.assignee || s("人名待确认", "Person to confirm"))} · ${esc(value(t, "owner"))} <b>·</b> ${esc(dateLabel(due(t)))}</small></span>${statusBadge(t)}${icon("chevron")}</button>`).join("") || `<div class="empty compact">${s("当前筛选下没有优先事项。", "No priorities match these filters.")}</div>`}</section><aside class="legacy-note"><span class="section-kicker">${s("传承的尺度", "OUR STANDARD OF CARE")}</span><h2>${s("让记忆有出处，<br>让家人接得住。", "Rooted in evidence.<br>Ready for the next generation.")}</h2><div class="note-rule"></div>${[
    [
      s("资料有编号、有来源", "Numbered records with clear sources"),
      s("授权与访问边界明确", "Clear consent and access boundaries"),
    ],
    [
      s("长辈与下一代共同审阅", "Reviewed by elders and the next generation"),
      s("档案可导出、可恢复", "Archives that can be exported and restored"),
    ],
  ]
    .flat()
    .map((x) => `<p>${icon("check")}${x}</p>`)
    .join(
      "",
    )}<span class="note-seal">${s("慎终追远 · 薪火相传", "REMEMBER · PRESERVE · PASS ON")}</span></aside></div><div class="section-heading"><div><span class="section-kicker">02 / ${s("记录与延续", "RECORD & CONTINUE")}</span><h2>${s("把每一份记忆，落成行动", "Turn every memory into an action")}</h2></div><button class="text-button" data-view="list">${s("全部行动", "All actions")} ${icon("arrow")}</button></div><div class="card-grid">${
    rows
      .filter((t) => t.priority !== "P0")
      .map(taskCard)
      .join("") ||
    `<div class="empty compact">${s("当前筛选下没有其他行动。", "No other actions match these filters.")}</div>`
  }</div>`;
}
function board() {
  return `<p class="helper">${s("拖动卡片或选择状态来推进任务。标记完成前，请补齐交付凭据和家族验收。", "Drag cards or use the status menu. Completion requires evidence, a completion date and family acceptance.")}</p><div class="kanban">${statuses
    .map(
      (st, i) =>
        `<section class="lane" data-lane="${st}"><h2><i class="dot status-${i}"></i>${esc(statusLabel(st))}<span>${filtered().filter((t) => t.status === st).length}</span></h2>${
          filtered()
            .filter((t) => t.status === st)
            .map(taskCard)
            .join("") ||
          `<div class="drop-zone">${icon("leaf")}<span>${s("在这里开始下一步", "A place for the next step")}</span></div>`
        }</section>`,
    )
    .join("")}</div>`;
}
function list() {
  return filtered().length
    ? `<div class="table-wrap"><table><thead><tr>${[s("行动事项", "Action"), s("优先级", "Priority"), s("负责人描述", "Responsibility"), s("具体人名", "Assignee"), s("状态", "Status"), s("截止日", "Due date"), s("下一步", "Next step")].map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${filtered()
        .map(
          (t) =>
            `<tr><td><button class="table-title" data-action="edit" data-id="${esc(t.id)}"><small>${esc(t.id)}</small>${esc(value(t, "title"))}</button></td><td>${priority(t)}</td><td>${esc(value(t, "owner"))}</td><td>${esc(t.assignee || s("待确认", "To confirm"))}</td><td>${statusBadge(t)}</td><td class="${overdue(t) ? "late" : ""}">${esc(dateLabel(due(t)))}</td><td>${esc(t.next || s("待填写", "To be added"))}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : empty();
}
function timeline() {
  const weeks = Math.max(12, ...project.tasks.map((t) => t.weekEnd));
  return `<p class="helper">${s("建议周期从启动日起算；手动截止日优先。横向滚动查看全部周次。", "Suggested weeks run from the start date; manual due dates take precedence. Scroll horizontally to see all weeks.")}</p><div class="phase-strip"><span>01 ${s("盘点与保全", "Inventory & safeguard")} <b>W1–2</b></span><span>02 ${s("采集与完善", "Collect & improve")} <b>W2–8</b></span><span>03 ${s("审阅与交接", "Review & hand over")} <b>W8–12</b></span></div><div class="timeline-wrap"><div class="timeline" style="--weeks:${weeks}"><div class="timeline-head">${s("行动 / 建议周次", "Action / suggested weeks")}</div>${Array.from({ length: weeks }, (_, i) => `<div class="week-label">W${i + 1}</div>`).join("")}${filtered()
    .map(
      (t) =>
        `<div class="timeline-row"><button data-action="edit" data-id="${esc(t.id)}"><small>${esc(t.id)}</small>${esc(value(t, "title"))}</button>${Array.from({ length: weeks }, (_, i) => `<div class="week-cell">${i + 1 >= t.weekStart && i + 1 <= t.weekEnd ? `<button class="bar ${t.priority} ${complete(t) ? "finished" : ""}" data-action="edit" data-id="${esc(t.id)}" aria-label="${esc(value(t, "title") + " W" + (i + 1))}">${i + 1 === t.weekStart ? t.priority : ""}</button>` : ""}</div>`).join("")}</div>`,
    )
    .join("")}</div></div>${filtered().length ? "" : empty()}`;
}
function history() {
  return `<section class="history-list">${project.history.length ? project.history.map((h) => `<article><span class="history-mark">${icon("check")}</span><div><h3>${esc(lang === "en" && h.textEn ? h.textEn : h.text)}</h3><p>${esc(h.actor)} · ${esc(fmt(h.at))} <span>UTC+8</span></p></div></article>`).join("") : `<div class="empty">${icon("history")}<h3>${s("每一步，都值得被记住", "Every step deserves a record")}</h3><p>${s("保存任务或调整启动日期后，更新会记录在这里。", "Updates appear here when you save a task or change the start date.")}</p></div>`}</section>`;
}
function render() {
  const active = document.activeElement,
    activeId = active?.id,
    selection = active?.selectionStart;
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.title = s(
    "家族传承计划 · DeepFamily",
    "Family Legacy Plan · DeepFamily",
  );
  document.body.classList.toggle("phone-layout", isPhone());
  document.body.classList.toggle("larger-text", largeText);
  document.body.classList.toggle(
    "module-view",
    ["dashboard", "people"].includes(view),
  );
  if (cloudEnabled && !cloudReady()) {
    $("#app").innerHTML = cloudGate(cloudSession, !!cloud, cloudMessage, {
      s,
      esc,
      icon,
    });
    return;
  }
  if (isPhone()) {
    $("#app").innerHTML = renderPhone(
      {
        project,
        view,
        query,
        filter,
        owner,
        category,
        largeText,
        storageIssue,
        cloudEnabled,
        lang,
        dashboardContent: view === "dashboard" ? dashboardView() : "",
        peopleContent: view === "people" ? peopleView() : "",
        drilldown: !!dashboardDrilldown,
      },
      { s, esc, icon, art, value, complete, due, dateLabel, fmt, filtered },
    );
    decorateCloud();
    if (["search", "person-name", "person-responsibility"].includes(activeId)) {
      const input = $("#" + activeId);
      input?.focus();
      input?.setSelectionRange(selection, selection);
    }
    return;
  }
  const done = project.tasks.filter(complete).length,
    percent = project.tasks.length
      ? Math.round((done / project.tasks.length) * 100)
      : 0;
  $("#app").innerHTML =
    `${mobile ? '<button class="nav-scrim" data-action="menu" aria-label="Close navigation"></button>' : ""}<aside class="sidebar ${mobile ? "mobile-open" : ""}"><a class="brand" href="${lang === "en" ? "/DeepFamily/en/" : "/DeepFamily/zh/"}"><img src="./assets/seal.svg" width="39" height="39" alt=""><span>DeepFamily<small>${s("让家族记忆，世代相承", "MEMORY ACROSS GENERATIONS")}</small></span></a><div class="workspace"><span class="family-character" aria-hidden="true">吴</span><span><strong>${s("Wu 家族传承计划", "Wu Family Legacy")}</strong><small>FAMILY LEGACY WORKSPACE</small></span></div><p class="nav-caption">${s("传承工作空间", "YOUR WORKSPACE")}</p><nav aria-label="${s("项目导航", "Project navigation")}">${views.map((v, i) => `<button data-view="${v}" class="${view === v ? "active" : ""}" ${view === v ? 'aria-current="page"' : ""}>${icon(["home", "board", "list", "timeline", "history", "board", "people"][i])}<span>${names()[i]}</span>${v === "list" ? `<b>${project.tasks.length}</b>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="family-motto"><span>家</span><p>${s("承先人之志，<br>启后人之路。", "Honor those before us.<br>Make room for those to come.")}</p><small>${s("先整理家族内部事项，再讨论对外展示。", "Care for the family archive before considering public display.")}</small></div><a href="https://wu-family-project-hub.luoxi.chatgpt.site/" class="source-link">${s("打开原私密云端工作台", "Original private cloud workspace")} ↗</a><a href="https://github.com/luoxisg/dcdeeptech/tree/main/dfplan" target="_blank" rel="noopener" class="source-link">GitHub ${s("源码", "source")} ↗</a></div></aside><main id="main"><header class="topbar"><div class="breadcrumb"><button class="icon-button menu-button" data-action="menu" aria-label="${s("打开导航", "Open navigation")}" aria-expanded="${mobile}">${icon("menu")}</button><span>DeepFamily</span>${icon("chevron")}<strong>${s("家族传承计划", "Family legacy plan")}</strong></div><div class="topbar-right"><span class="local-status"><i></i>${s("本机保存", "Saved locally")}</span><div class="language-switch" role="group" aria-label="Language / 语言"><button data-lang="zh" class="${lang === "zh" ? "selected" : ""}" aria-pressed="${lang === "zh"}">中</button><button data-lang="en" class="${lang === "en" ? "selected" : ""}" aria-pressed="${lang === "en"}">EN</button></div></div></header><div class="content"><section class="hero"><div class="hero-copy"><span class="eyebrow">A LEGACY WORTH KEEPING</span><h1>${s("把家族记忆，<br>认真交给下一代。", "Keep the memories.<br>Carry the legacy forward.")}</h1><p>${s("从一张老照片，到一部家族史。<br>让每一份资料被珍藏，让每一步传承有章可循。", "From a treasured photograph to a family history.<br>A thoughtful plan to preserve what connects us.")}</p><div class="hero-tags"><span>${icon("folder")}${s("10 项基础行动", "10 foundational actions")}</span><span>${icon("clock")}${s("12 周建议周期", "12-week suggested plan")}</span></div></div><img class="heritage-art" src="./assets/heritage-tree.svg" alt="" width="540" height="340"><span class="hero-corner">${s("根深 · 叶茂 · 家长青", "ROOTS · STORIES · GENERATIONS")}</span></section><div class="storage-note">${icon("shield")}<p>${s("此页为公开的计划模板；你的修改仅保存在当前浏览器，不会自动同步。请定期导出备份，勿在此记录密码或敏感家族资料。", "This is a public planning template. Your edits stay in this browser and do not sync automatically. Export backups regularly; keep passwords and sensitive family records elsewhere.")}</p><button data-action="export-json">${s("备份", "Back up")}${icon("download")}</button></div>${storageIssue ? `<div role="alert" class="alert">${s("本机存储无法读取。当前显示基础模板；请先检查或导出原有浏览器数据，再保存。", "Browser storage could not be read. The base template is shown; check or recover existing browser data before saving.")}</div>` : ""}<section class="metrics" aria-label="${s("项目进度", "Project progress")}"><div class="metric"><span>${s("传承进度", "LEGACY PROGRESS")}</span><strong>${percent}<small>%</small></strong><div class="progress"><i style="width:${percent}%"></i></div><p>${done} / ${project.tasks.length} ${s("项已验收完成", "actions accepted")}</p></div><div class="metric"><span>${s("优先落实", "PRIORITIES")}</span><strong>${project.tasks.filter((t) => t.priority === "P0" && !complete(t)).length}<small>${s("项", "open")}</small></strong><p>${s("联系人 · 盘点 · 备份 · 授权", "Contacts · assets · backups · consent")}</p></div><div class="metric"><span>${s("等待家族审阅", "FAMILY REVIEW")}</span><strong>${project.tasks.filter((t) => t.status === "待家族确认").length}<small>${s("项", "open")}</small></strong><p>${s("共同审阅，才是传承的开始", "Shared review makes a shared legacy")}</p></div><div class="metric start-metric"><span>${s("项目启动日", "PROJECT START")}</span><button data-action="start">${esc(dateLabel(project.startDate))}${icon("calendar")}</button><p>${s("确认日期，让计划循序展开", "Set the date to bring the plan to life")}</p></div></section><div class="section-heading main-heading"><div><span class="section-kicker">THE FAMILY ARCHIVE / ${s("有序传承", "THOUGHTFUL STEWARDSHIP")}</span><h2 id="page-title" tabindex="-1">${names()[views.indexOf(view)]}</h2><p>${s("负责人及周期为建议，请核实后逐项推进。", "Owners and schedules are proposals. Verify each before proceeding.")}</p></div><div class="actions"><button class="icon-button" data-action="import" title="${s("导入项目备份", "Import project backup")}" aria-label="${s("导入项目备份", "Import project backup")}">${icon("upload")}</button><button class="secondary" data-action="export-csv">${icon("download")}${s("导出清单", "Export CSV")}</button><button class="primary" data-action="add">${icon("plus")}${s("新增行动", "Add action")}</button></div></div>${view !== "history" ? toolbar() : ""}<div id="view-content">${{ overview, board, list, timeline, history, dashboard: dashboardView, people: peopleView }[view]()}</div><footer class="page-footer"><span><img src="./assets/seal.svg" width="22" height="22" alt="">DeepFamily <b>·</b> ${s("家族传承计划", "Family legacy plan")}</span><span>${s("珍藏过去，连接未来。", "Preserve the past. Connect the future.")} <b>·</b> UTC+8</span></footer></div></main>`;
  decorateCloud();
  if (dashboardDrilldown && !isPhone() && view === "list")
    $("#view-content")?.insertAdjacentHTML("beforebegin", drilldownNote());
  if (["search", "person-name", "person-responsibility"].includes(activeId)) {
    const input = $("#" + activeId);
    input.focus();
    input.setSelectionRange(selection, selection);
  }
}
function drilldownNote() {
  return `<div class="dashboard-drilldown-note"><span>${s("正在查看仪表盘选中的任务", "Showing the actions selected in the dashboard")}</span><button class="module-button" data-action="clear">${s("显示全部任务", "Show all actions")}</button></div>`;
}
function dashboardView() {
  return renderDashboard(project, people, dashboardSelection, {
    s,
    esc,
    icon,
    lang,
  });
}
function peopleView() {
  return renderPeople(
    project,
    people,
    {
      canManage: canManagePeople(),
      ready: peopleReady,
      error: peopleMessage,
      busy: peopleBusy,
      draft: peopleDraft,
      formError: peopleFormError,
    },
    { s, esc, icon },
  );
}
function openDashboardTasks(options = {}) {
  dashboardDrilldown = { ...dashboardSelection, focus: "all", ...options };
  category = "all";
  filter = "all";
  owner = "";
  query = "";
  changeView("list", false);
}
async function refreshPeople() {
  const uid = cloudSession.user?.uid;
  const rows = await cloud.listPeople();
  if (!cloudReady() || uid !== cloudSession.user?.uid) return;
  people = rows;
  peopleReady = true;
  peopleMessage = "";
  render();
}
function openEditor(task) {
  editingWasNew = !task;
  editing = task
    ? structuredClone(task)
    : {
        id:
          "WU-" +
          String(
            Math.max(
              0,
              ...project.tasks.map((t) => Number(t.id.replace("WU-", "")) || 0),
            ) + 1,
          ).padStart(2, "0"),
        title: "",
        titleEn: "",
        owner: "",
        ownerEn: "",
        assignee: "",
        collaborators: "",
        collaboratorsEn: "",
        action: "",
        actionEn: "",
        deliverable: "",
        deliverableEn: "",
        dependency: "",
        dependencyEn: "",
        next: "",
        evidence: "",
        priority: "P1",
        status: "未开始",
        weekStart: 1,
        weekEnd: 1,
        due: "",
        completed: "",
        accepted: false,
        updatedAt: "",
      };
  if (isPhone()) {
    $("#editor").innerHTML = phoneEditor(editing, editingWasNew, lang, {
      s,
      esc,
      icon,
      art,
      value,
      assigneeField: (task) => assigneeSelect(task, people, { s, esc }),
    });
    $("#editor").showModal();
    return;
  }
  const t = editing,
    key = (k) => (lang === "en" ? k + "En" : k);
  const input = (k, label, type = "text", extra = "") =>
    `<label>${label}<input name="${k}" type="${type}" value="${esc(t[k] ?? (k.endsWith("En") ? t[k.slice(0, -2)] || "" : ""))}" ${extra}></label>`;
  const bilingual = (k, label, rows = 2) =>
    `<label>${label}<textarea name="${key(k)}" rows="${rows}" maxlength="12000">${esc(value(t, k))}</textarea></label>`;
  $("#editor").innerHTML =
    `<form id="task-form"><div class="dialog-head"><div><span class="eyebrow">${esc(t.id)} / ${s("行动详情", "ACTION DETAILS")}</span><h2 id="dialog-title">${s("让传承有据可循", "Give the next step a clear purpose")}</h2></div><button type="button" class="icon-button" data-close="editor" aria-label="${s("关闭", "Close")}">${icon("close")}</button></div><div class="form-body">${input(key("title"), s("行动名称", "Action title"), "text", 'required maxlength="160"')}<div class="form-grid"><label>${s("优先级", "Priority")}<select name="priority">${["P0", "P1", "P2"].map((p) => `<option ${p === t.priority ? "selected" : ""}>${p}</option>`).join("")}</select></label><label>${s("当前状态", "Status")}<select name="status">${statuses.map((st) => `<option value="${st}" ${st === t.status ? "selected" : ""}>${statusLabel(st)}</option>`).join("")}</select></label>${input(key("owner"), s("负责人描述", "Responsibility"))}${assigneeSelect(t, people, { s, esc })}${input(key("collaborators"), s("配合人员", "Collaborators"))}${input("weekStart", s("建议开始周", "Suggested start week"), "number", 'min="1" max="104" required')}${input("weekEnd", s("建议结束周", "Suggested end week"), "number", 'min="1" max="104" required')}${input("due", s("手动截止日", "Manual due date"), "date")}${input("completed", s("实际完成日", "Completion date"), "date")}</div><small class="form-hint">${s("手动截止日留空时，按启动日与建议结束周计算。", "Leave the manual due date blank to calculate it from the start date and end week.")}</small>${bilingual("action", s("具体行动", "Action steps"), 3)}${bilingual("deliverable", s("交付物与完成标准", "Deliverables and acceptance criteria"), 3)}${bilingual("dependency", s("前置条件", "Dependencies"))}<label>${s("下一步 / 阻碍（中英文共用）", "Next step / blockers (shared across languages)")}<textarea name="next" rows="2" maxlength="12000">${esc(t.next)}</textarea></label><details class="translations"><summary>${s("补充英文内容（可选）", "Chinese content (optional)")}</summary>${[
      "title",
      "owner",
      "collaborators",
      "action",
      "deliverable",
      "dependency",
    ]
      .map((k, i) => {
        const opposite = lang === "en" ? k : k + "En";
        return `<label>${["Title", "Owner", "Collaborators", "Action", "Deliverables", "Dependencies"][i]} · ${lang === "en" ? "中文" : "English"}<textarea name="${opposite}" rows="2" maxlength="${k === "title" ? 160 : 12000}">${esc(t[opposite])}</textarea></label>`;
      })
      .join(
        "",
      )}</details><fieldset class="acceptance"><legend>${s("交付与家族验收", "Delivery and family acceptance")}</legend><label>${s("交付凭据 / 受控文件链接", "Evidence / controlled file reference")}<textarea name="evidence" rows="2" maxlength="12000" placeholder="${s("仅记录交付说明或文件编号，请勿记录密码。", "Use a delivery note or file reference. Never enter passwords.")}">${esc(t.evidence)}</textarea></label><label class="checkbox"><input type="checkbox" name="accepted" ${t.accepted ? "checked" : ""}>${s("已确认交付，并经家族验收", "Delivery confirmed and accepted by the family")}</label></fieldset><p id="form-error" class="form-error" role="alert"></p></div><div class="dialog-footer"><small>${s("仅保存到当前浏览器", "Saved in this browser only")}</small><button type="button" class="secondary" data-close="editor">${s("取消", "Cancel")}</button><button class="primary" type="submit">${s("保存行动", "Save action")}</button></div></form>`;
  if (cloudEnabled) {
    const note = $("#editor .dialog-footer small");
    if (note)
      note.textContent = s(
        "保存到后端并记录本次修改",
        "Saved in the backend with an activity record",
      );
  }
  $("#editor").showModal();
}
function changeStatus(id, status) {
  const t = project.tasks.find((t) => t.id === id);
  if (!t || t.status === status) return;
  if (
    status === "已完成" &&
    (!t.accepted || !t.evidence.trim() || !t.completed)
  ) {
    openEditor({ ...t, status, completed: t.completed || today() });
    $("#form-error").textContent = s(
      "完成前请提供凭据、完成日期，并确认家族验收。",
      "Add evidence, a completion date and family acceptance before completing this action.",
    );
    render();
    return;
  }
  const tasks = project.tasks.map((t) =>
    t.id === id
      ? {
          ...t,
          status,
          completed: status === "已完成" ? t.completed : "",
          updatedAt: new Date().toISOString(),
        }
      : t,
  );
  persist(
    { ...project, tasks },
    `${id}：${t.status} → ${status}`,
    `${id}: ${statusEn[statuses.indexOf(t.status)]} → ${statusEn[statuses.indexOf(status)]}`,
  );
}
function exportFile(type, dataProject = project) {
  let data, mime;
  if (type === "json") {
    data = JSON.stringify(
      {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        ...dataProject,
      },
      null,
      2,
    );
    mime = "application/json";
  } else {
    const header =
      lang === "en"
        ? [
            "ID",
            "Action",
            "Priority",
            "Responsibility",
            "Assignee",
            "Collaborators",
            "Start week",
            "End week",
            "Status",
            "Due date",
            "Completed on",
            "Action steps",
            "Deliverables",
            "Dependencies",
            "Next step",
            "Evidence",
            "Family accepted",
          ]
        : [
            "任务编号",
            "行动名称",
            "优先级",
            "负责人描述",
            "具体人名",
            "配合人员",
            "开始周",
            "结束周",
            "状态",
            "截止日",
            "完成日",
            "具体行动",
            "交付标准",
            "前置条件",
            "下一步",
            "凭据",
            "家族验收",
          ];
    const rows = [
      header,
      ...dataProject.tasks.map((t) => [
        t.id,
        value(t, "title"),
        t.priority,
        value(t, "owner"),
        t.assignee || "",
        value(t, "collaborators"),
        t.weekStart,
        t.weekEnd,
        statusLabel(t.status),
        targetDate(t, dataProject.startDate),
        t.completed,
        value(t, "action"),
        value(t, "deliverable"),
        value(t, "dependency"),
        t.next,
        t.evidence,
        t.accepted ? s("是", "Yes") : s("否", "No"),
      ]),
    ];
    data = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    mime = "text/csv;charset=utf-8";
  }
  const url = URL.createObjectURL(new Blob([data], { type: mime })),
    a = document.createElement("a");
  a.href = url;
  a.download = `DeepFamily_Plan_${today()}.${type}`;
  a.click();
  toast(
    s(
      "已交给浏览器下载，请在手机“下载”中查看。",
      "Sent to your browser. Check your Downloads folder.",
    ),
  );
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openStart() {
  startBaseline = project.startDate;
  const d = $("#start-dialog");
  d.innerHTML = `<form id="start-form"><div class="dialog-head"><h2 id="start-title">${s("为传承定一个起点", "Set a starting point")}</h2><button type="button" class="icon-button" data-close="start-dialog" aria-label="${s("关闭", "Close")}">${icon("close")}</button></div><div class="form-body"><p>${s("建议周次从这一天起算。手动设置的截止日保持不变。", "Suggested weeks run from this date. Manual due dates remain unchanged.")}</p><label>${s("项目启动日", "Project start date")}<input type="date" name="startDate" value="${esc(project.startDate)}"></label></div><div class="dialog-footer"><button type="button" class="secondary" data-close="start-dialog">${s("取消", "Cancel")}</button><button class="primary">${s("保存日期", "Save date")}</button></div></form>`;
  d.showModal();
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (
    btn.dataset.dashboardFocus ||
    btn.dataset.dashboardStatus ||
    btn.dataset.dashboardStage ||
    btn.dataset.dashboardPerson
  ) {
    const selected = {};
    if (btn.dataset.dashboardFocus) selected.focus = btn.dataset.dashboardFocus;
    if (btn.dataset.dashboardStatus)
      selected.focus = "status:" + btn.dataset.dashboardStatus;
    if (btn.dataset.dashboardStage)
      selected.priority = btn.dataset.dashboardStage;
    if (btn.dataset.dashboardPerson)
      selected.person = btn.dataset.dashboardPerson;
    if (view === "people") selected.priority = "all";
    openDashboardTasks(selected);
    return;
  }
  if (btn.dataset.personId) {
    if (!canManagePeople() || peopleBusy) return;
    peopleBusy = true;
    btn.disabled = true;
    try {
      await cloud.setPersonActive(
        btn.dataset.personId,
        btn.dataset.personActive === "true",
      );
      await refreshPeople();
      toast(
        btn.dataset.personActive === "true"
          ? s("已恢复人员。", "Person restored.")
          : s(
              "已移出名单，既有任务与历史保留。",
              "Removed from the directory. Existing actions and history are retained.",
            ),
      );
    } catch (error) {
      toast(cloudError(error, lang));
    } finally {
      peopleBusy = false;
      render();
    }
    return;
  }
  if (btn.dataset.adminEmail) {
    if (cloudSaving) return;
    btn.disabled = true;
    try {
      await cloud.setAdminActive(
        btn.dataset.adminEmail,
        btn.dataset.adminEnable === "true",
      );
      await showAdmins();
    } catch (error) {
      $("#account-error").textContent = cloudError(error, lang);
      btn.disabled = false;
    }
    return;
  }
  if (btn.dataset.action?.startsWith("cloud-")) {
    const action = btn.dataset.action;
    try {
      if (action === "cloud-login") {
        cloudMessage = "";
        btn.disabled = true;
        await cloud?.login();
      } else if (action === "cloud-link-login") {
        cloudMessage = "";
        btn.disabled = true;
        await cloud?.loginWithLink();
      } else if (action === "cloud-create-link") {
        btn.disabled = true;
        const link = await cloud.createPatrickLink();
        await showAdmins();
        const output = $("#patrick-link-output");
        if (output && cloudReady() && cloudSession.admin?.role === "owner") {
          output.value = link;
          $("#patrick-link-result").hidden = false;
          output.focus();
          output.select();
        }
      } else if (action === "cloud-copy-link") {
        const output = $("#patrick-link-output");
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(output.value);
          toast(
            s(
              "邀请链接已复制，请只发给 Patrick。",
              "Invitation copied. Send it only to Patrick.",
            ),
          );
        } else {
          output.focus();
          output.select();
          toast(
            s(
              "请长按选中的链接并复制。",
              "Press and hold the selected link to copy it.",
            ),
          );
        }
      } else if (action === "cloud-revoke-link") {
        btn.disabled = true;
        await cloud.revokeInvite(btn.dataset.inviteId);
        await showAdmins();
        toast(
          s(
            "已撤销，这个入口无法继续访问家族资料。",
            "Revoked. This access can no longer open family records.",
          ),
        );
      } else if (action === "cloud-initialize") {
        btn.disabled = true;
        await cloud.initialize();
      } else if (action === "cloud-logout") {
        if (cloudSaving) return;
        await cloud?.logout();
      } else if (action === "cloud-account") await showAdmins();
      else if (action === "cloud-refresh") {
        if (cloud) await cloud.reload();
        else window.location.reload();
      } else if (action === "cloud-legacy-export")
        exportFile("json", legacyProject);
      else if (action === "cloud-migrate" && legacyProject) {
        $("#account-dialog").close();
        confirmImport(legacyProject, s("本机旧记录", "Earlier device records"));
      }
    } catch (error) {
      cloudMessage = cloudError(error, lang);
      toast(cloudMessage);
      if (!cloudReady()) render();
    } finally {
      btn.disabled = false;
    }
    return;
  }
  if (btn.dataset.close) {
    $("#" + btn.dataset.close).close();
    return;
  }
  if (btn.dataset.lang) {
    lang = btn.dataset.lang;
    try {
      localStorage.setItem(LANG, lang);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    historyReplace(url);
    render();
    return;
  }
  if (btn.dataset.category) {
    category = btn.dataset.category;
    filter = "all";
    query = "";
    owner = "";
    changeView("list", false);
    return;
  }
  if (btn.dataset.stage) {
    category = "all";
    filter = btn.dataset.stage;
    query = "";
    owner = "";
    changeView("list", false);
    return;
  }
  if (btn.dataset.filter) {
    filter = btn.dataset.filter;
    render();
    return;
  }
  if (btn.dataset.view) {
    changeView(btn.dataset.view);
    return;
  }
  const action = btn.dataset.action;
  if (action === "text-size") {
    largeText = !largeText;
    try {
      localStorage.setItem("deepfamily.dfplan.largeText", String(largeText));
    } catch {}
    render();
    return;
  }
  if (action === "edit")
    openEditor(project.tasks.find((t) => t.id === btn.dataset.id));
  else if (action === "add") openEditor();
  else if (action === "start") openStart();
  else if (action === "menu") {
    mobile = !mobile;
    render();
  } else if (action === "clear") {
    category = "all";
    query = "";
    filter = "all";
    owner = "";
    dashboardDrilldown = null;
    render();
  } else if (action === "export-json") exportFile("json");
  else if (action === "export-csv") exportFile("csv");
  else if (action === "import") {
    $("#import-file").value = "";
    $("#import-file").click();
  } else if (action === "confirm-import" && pendingImport) {
    if (cloudEnabled && pendingImportRevision !== cloudRevision) {
      toast(
        s(
          "确认期间云端已有更新，请重新打开导入并核对。",
          "The backend changed during confirmation. Reopen and review the import.",
        ),
      );
      return;
    }
    const next = pendingImport;
    const old = project;
    if (!cloudEnabled) project = next;
    if (await persist(next, "导入项目备份", "Imported project backup", true)) {
      pendingImport = null;
      $("#import-dialog").close();
    } else if (!cloudEnabled) project = old;
  }
});
function historyReplace(url) {
  window.history.replaceState(null, "", url);
}
document.addEventListener("input", (e) => {
  if (
    e.target.closest("#person-form") &&
    ["displayName", "responsibility"].includes(e.target.name)
  )
    peopleDraft[e.target.name] = e.target.value;
  if (e.target.id === "search") {
    query = e.target.value;
    render();
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (
    el.id === "dashboard-person-filter" ||
    el.id === "dashboard-priority-filter"
  ) {
    dashboardSelection[
      el.id === "dashboard-person-filter" ? "person" : "priority"
    ] = el.value;
    render();
    return;
  }
  if (el.id === "owner-filter") {
    owner = el.value;
    render();
  } else if (el.id === "status-filter") {
    filter = el.value;
    render();
  } else if (el.dataset.status) changeStatus(el.dataset.status, el.value);
  if (el.name === "status" && el.closest("#task-form")) {
    const completion = $('#task-form [name="completed"]');
    if (el.value === "已完成" && !completion.value) completion.value = today();
    else if (el.value !== "已完成") completion.value = "";
    if (el.value === "已完成" && $("#acceptance-details"))
      $("#acceptance-details").open = true;
  }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id === "person-form") {
    e.preventDefault();
    if (!canManagePeople() || !peopleReady || peopleBusy) return;
    const data = new FormData(e.target);
    peopleBusy = true;
    peopleFormError = "";
    e.target.querySelector('[type="submit"]').disabled = true;
    try {
      await cloud.addPerson(
        data.get("displayName"),
        data.get("responsibility"),
      );
      peopleDraft = { displayName: "", responsibility: "" };
      await refreshPeople();
      toast(
        s(
          "人员已加入，可以分配任务。",
          "Person added and available for assignments.",
        ),
      );
    } catch (error) {
      peopleFormError = cloudError(error, lang);
      toast(peopleFormError);
    } finally {
      peopleBusy = false;
      render();
    }
    return;
  }
  if (e.target.id === "add-admin-form") {
    e.preventDefault();
    const data = new FormData(e.target),
      button = e.target.querySelector('[type="submit"]');
    button.disabled = true;
    $("#account-error").textContent = "";
    try {
      await cloud.addAdmin(data.get("email"), data.get("displayName"));
      await showAdmins();
      toast(
        s(
          "已加入管理员名单，对方可用 Google 账号登录。",
          "Added to the administrator list. They can now sign in with Google.",
        ),
      );
    } catch (error) {
      $("#account-error").textContent = cloudError(error, lang);
      button.disabled = false;
    }
    return;
  }
  if (e.target.id === "task-form") {
    e.preventDefault();
    const current = project.tasks.find((t) => t.id === editing.id);
    if (
      (editingWasNew && current) ||
      (!editingWasNew && current && current.updatedAt !== editing.updatedAt)
    ) {
      $("#form-error").textContent = s(
        "此任务已在另一窗口更新，请关闭后重新打开，避免覆盖最新内容。",
        "This action changed in another tab. Close and reopen it to keep the latest changes.",
      );
      return;
    }
    const fields = Object.fromEntries(new FormData(e.target));
    const task = {
      ...editing,
      ...fields,
      weekStart: Number(fields.weekStart),
      weekEnd: Number(fields.weekEnd),
      accepted: new FormData(e.target).has("accepted"),
      updatedAt: new Date().toISOString(),
    };
    task.assignee = (task.assignee || "").trim();
    const person = people.find(
      (p) => p.active && p.displayName === task.assignee,
    );
    if (person) task.assigneeId = person.id;
    else if (!task.assignee) {
      if (editing.assigneeId !== undefined) task.assigneeId = "";
      else delete task.assigneeId;
    } else if (task.assignee !== (editing.assignee || "")) {
      $("#form-error").textContent = s(
        "请从在册人员中选择；新人员需由管理员先加入名单。",
        "Choose an active person. Ask an administrator to add new people first.",
      );
      return;
    }

    if (!task.title.trim()) task.title = task.titleEn || "";
    if (task.status !== "已完成") task.completed = "";
    const next = {
      ...project,
      tasks: project.tasks.some((t) => t.id === task.id)
        ? project.tasks.map((t) => (t.id === task.id ? task : t))
        : [...project.tasks, task],
    };
    try {
      validateProject(next);
    } catch (err) {
      $("#form-error").textContent =
        err.message === "acceptance"
          ? s(
              "请补齐交付凭据、实际完成日，并确认家族验收。",
              "Provide evidence, a completion date and family acceptance.",
            )
          : s(
              "请检查名称、日期和建议周次；结束周不能早于开始周。",
              "Check the title, dates and week range; the end week cannot precede the start week.",
            );
      const error = $("#form-error");
      error.setAttribute("tabindex", "-1");
      error.focus();
      $("#acceptance-details") && ($("#acceptance-details").open = true);
      $("#task-form .phone-plan-settings") &&
        err.message !== "acceptance" &&
        ($("#task-form .phone-plan-settings").open = true);
      return;
    }
    if (
      await persist(
        next,
        `${task.id} 更新「${task.title}」`,
        `${task.id} updated “${task.titleEn || task.title}”`,
      )
    )
      $("#editor").close();
  } else if (e.target.id === "start-form") {
    e.preventDefault();
    if (cloudEnabled && project.startDate !== startBaseline) {
      toast(
        s(
          "其他管理员已调整启动日期，请关闭后重新设置。",
          "Another administrator changed the start date. Close and reopen this form.",
        ),
      );
      return;
    }
    const date = new FormData(e.target).get("startDate");
    if (
      await persist(
        { ...project, startDate: date },
        `启动日调整为 ${date || "待定"}`,
        `Start date changed to ${date || "to be agreed"}`,
      )
    )
      $("#start-dialog").close();
  }
});
function confirmImport(data, label) {
  pendingImportRevision = cloudRevision;
  pendingImport = validateProject(data);
  $("#import-dialog").innerHTML =
    `<div class="dialog-head"><h2 id="import-title">${s("导入项目备份", "Import a project backup")}</h2><button class="icon-button" data-close="import-dialog" aria-label="${s("关闭", "Close")}">${icon("close")}</button></div><div class="form-body"><p>${cloudEnabled ? s("将导入 " + pendingImport.tasks.length + " 项行动及启动日期。云端更新记录会保留；已有任务不能删除。建议先导出云端备份。", "Import " + pendingImport.tasks.length + " actions and the start date. Cloud history is retained; existing actions cannot be deleted. Export a cloud backup first.") : s("将用备份中的 " + pendingImport.tasks.length + " 项行动替换当前浏览器的计划。建议先备份现有内容。", "This will replace this browser’s plan with " + pendingImport.tasks.length + " actions from the backup. Back up the current plan first.")}</p><small>${esc(label)}</small></div><div class="dialog-footer"><button class="secondary" data-action="export-json">${s("先导出现有备份", "Export current backup")}</button><button class="primary" data-action="confirm-import">${s("确认导入", "Replace and import")}</button></div>`;
  $("#import-dialog").showModal();
}
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error();
    confirmImport(JSON.parse(await file.text()), file.name);
  } catch {
    pendingImport = null;
    toast(
      s(
        "无法导入：请使用有效的项目 JSON 备份（最大 5 MB），已完成任务需具备验收凭据。",
        "Import failed. Use a valid project JSON backup (up to 5 MB); completed tasks must have acceptance evidence.",
      ),
    );
  }
});
document.addEventListener("dragstart", (e) => {
  const card = e.target.closest("[data-task]");
  if (card) {
    e.dataTransfer.setData("text/plain", card.dataset.task);
    e.dataTransfer.effectAllowed = "move";
  }
});
document.addEventListener("dragover", (e) => {
  if (e.target.closest("[data-lane]")) e.preventDefault();
});
document.addEventListener("drop", (e) => {
  const lane = e.target.closest("[data-lane]");
  if (lane) {
    e.preventDefault();
    changeStatus(e.dataTransfer.getData("text/plain"), lane.dataset.lane);
  }
});
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1);
  if (views.includes(next) && next !== view) {
    view = next;
    render();
  }
});
window.addEventListener("storage", (e) => {
  if (!cloudEnabled && e.key === KEY) {
    try {
      const next = e.newValue ? validateProject(JSON.parse(e.newValue)) : null;
      if (next) {
        project = next;
        render();
        toast(
          s("已读取另一窗口保存的更新", "Loaded updates saved in another tab"),
        );
      }
    } catch {
      toast(
        s(
          "其他窗口数据无效，请刷新前备份。",
          "Invalid data from another tab. Back up before refreshing.",
        ),
      );
    }
  }
});

function decorateCloud() {
  if (!cloudEnabled || !cloudReady()) return;
  const host = $(".phone-content") || $(".content");
  host?.insertAdjacentHTML(
    "afterbegin",
    cloudBar(cloudSession, cloudUpdatedAt, cloudSaving, { s, esc, icon, fmt }),
  );
  if (cloudMessage)
    host?.insertAdjacentHTML(
      "afterbegin",
      `<p class="cloud-alert cloud-inline-error" role="alert">${esc(cloudMessage)}</p>`,
    );
  const note = $(".storage-note p");
  if (note)
    note.textContent = s(
      "共享资料保存在云端，只有已授权的家族成员可读写。请保管好导出的备份。",
      "Shared records are stored in the cloud. Only authorized family members can read or change them. Keep exported backups safe.",
    );
  const status = $(".local-status");
  if (status) status.textContent = s("云端共享", "Shared backend");
}
async function showAdmins() {
  const uid = cloudSession.user?.uid,
    dialog = $("#account-dialog"),
    h = { s, esc, icon };
  if (cloudSession.admin?.role === "editor") {
    dialog.innerHTML = guestDialog(cloudSession, h);
    if (!dialog.open) dialog.showModal();
    return;
  }
  const [members, invites] = await Promise.all([
    cloud.listAdmins(),
    cloudSession.admin?.role === "owner"
      ? cloud.listInvites().catch(() => null)
      : Promise.resolve([]),
  ]);
  if (!cloudReady() || uid !== cloudSession.user?.uid) return;
  dialog.innerHTML = adminDialog(members, cloudSession, hasLegacy, h, invites);
  if (!dialog.open) dialog.showModal();
}
async function startCloud() {
  try {
    cloud = await connectBackend(
      (session) => {
        cloudSession = session;
        if (session.phase !== "ready") {
          people = [];
          peopleReady = false;
          peopleMessage = "";
          peopleFormError = "";
          peopleDraft = { displayName: "", responsibility: "" };
          dashboardSelection = { person: "all", priority: "all" };
          dashboardDrilldown = null;
          cloudLoaded = false;
          cloudRevision = -1;
          project = {
            startDate: "",
            tasks: structuredClone(seedTasks),
            history: [],
          };
          document
            .querySelectorAll("dialog[open]")
            .forEach((dialog) => dialog.close());
        } else if (!cloudLoaded) {
          cloudSession = { ...session, phase: "reading" };
        }
        render();
      },
      (data) => {
        project = data.project;
        cloudRevision = data.revision;
        cloudUpdatedAt = data.updatedAt;
        cloudLoaded = true;
        cloudMessage = "";
        if (
          cloudSession.admin &&
          ["reading", "not-initialized", "error"].includes(cloudSession.phase)
        )
          cloudSession = { ...cloudSession, phase: "ready" };
        render();
      },
      (error) => {
        cloudMessage = cloudError(error, lang);
        if (!cloudLoaded)
          cloudSession = {
            ...cloudSession,
            phase:
              error.code === "dfplan/not-initialized"
                ? "not-initialized"
                : "error",
          };
        render();
      },
      (rows) => {
        people = rows;
        peopleReady = true;
        peopleMessage = "";
        render();
      },
      (error) => {
        peopleReady = false;
        peopleMessage =
          error.code === "permission-denied"
            ? s(
                "人员管理尚未开通，请管理员运行后台更新命令后刷新页面。",
                "People management is not enabled yet. Ask an administrator to run the backend update and refresh.",
              )
            : cloudError(error, lang);
        render();
      },
    );
    render();
  } catch (error) {
    cloudMessage = cloudError(error, lang);
    cloudSession = { phase: "error" };
    render();
  }
}

phoneQuery.addEventListener?.("change", render);
render();
if (cloudEnabled) startCloud();
