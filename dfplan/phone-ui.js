import { stewardshipEditor } from "./stewardship.mjs";
import { statuses } from "./model.mjs";

export const phoneCategories = [
  {
    id: "care",
    icon: "shield",
    zh: "保护资料",
    en: "Keep records safe",
    ids: ["WU-01", "WU-03", "WU-04"],
  },
  {
    id: "photos",
    icon: "photo",
    zh: "照片与家谱",
    en: "Photos & family tree",
    ids: ["WU-02", "WU-06", "WU-07"],
  },
  {
    id: "stories",
    icon: "mic",
    zh: "长辈的故事",
    en: "Elders’ stories",
    ids: ["WU-05"],
  },
  {
    id: "family",
    icon: "people",
    zh: "家人一起看",
    en: "Review together",
    ids: ["WU-08", "WU-09", "WU-10"],
  },
];
export const matchesCategory = (task, category) =>
  category === "all" ||
  !!phoneCategories.find((c) => c.id === category)?.ids.includes(task.id);
export const nextAction = (tasks, complete) =>
  tasks.find((t) => t.status === "进行中") ||
  tasks.find((t) => t.priority === "P0" && !complete(t)) ||
  tasks.find((t) => !complete(t));
const taskPictures = {
  "WU-01": "people",
  "WU-02": "photo",
  "WU-03": "backup",
  "WU-04": "shield",
  "WU-05": "mic",
  "WU-06": "archive",
  "WU-07": "tree",
  "WU-08": "app",
  "WU-09": "review",
  "WU-10": "handover",
};
export const taskPicture = (task) => taskPictures[task.id] || "leaf";
export const statusPictures = [
  "question",
  "clock",
  "play",
  "people",
  "pause",
  "check",
];
export const friendlyStatus = (status, lang) =>
  (lang === "en"
    ? [
        "Check first",
        "Not started",
        "Doing",
        "Family review",
        "Need help",
        "Done",
      ]
    : ["先确认", "还没开始", "正在做", "请家人看", "需要帮助", "已完成"])[
    statuses.indexOf(status)
  ] || status;

export function renderPhone(state, h) {
  const {
    project,
    view,
    query,
    filter,
    owner,
    category,
    largeText,
    storageIssue,
    cloudEnabled = false,
    lang,
    dashboardContent = "",
    peopleContent = "",
    securityContent = "",
    drilldown = false,
  } = state;
  const { s, esc, icon, art, value, complete, due, dateLabel, fmt, filtered } =
    h;
  const done = project.tasks.filter(complete).length,
    total = project.tasks.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const categoryInfo = phoneCategories.find((c) => c.id === category);
  const badge = (t) =>
    `<span class="phone-badge status-${statuses.indexOf(t.status)}">${icon(statusPictures[statuses.indexOf(t.status)])}${esc(friendlyStatus(t.status, lang))}</span>`;
  const taskButton = (t) =>
    `<button class="phone-task" data-action="edit" data-id="${esc(t.id)}">${art(taskPicture(t))}<span class="phone-task-body"><strong>${esc(value(t, "title"))}</strong>${badge(t)}<span>${s("负责人：", "Assigned to: ")}<b>${esc(t.assignee || s("待确认", "To confirm"))}</b><small class="phone-owner-role">${esc(value(t, "owner"))}</small></span></span>${icon("chevron")}</button>`;
  const pageHeading = (title, note) =>
    `<div class="phone-heading"><h1 id="page-title" tabindex="-1">${title}</h1>${note ? `<p>${note}</p>` : ""}</div>`;
  const moduleLinks = () =>
    `<div class="phone-module-links"><button data-view="dashboard">${icon("board")}<strong>${s("进度仪表盘", "Dashboard")}</strong></button><button data-view="people">${icon("people")}<strong>${s("人员与分工", "People & roles")}</strong></button><button data-view="security">${icon("shield")}<strong>${s("资料与安全", "Materials & safety")}</strong></button></div>`;
  function home() {
    const next = nextAction(project.tasks, complete);
    return `${pageHeading(s("一家人的记忆，<br>一起守护。", "Our family memories.<br>In caring hands."), s("慢慢来，一次做好一件事。", "One small step at a time."))}${moduleLinks()}<section class="phone-progress"><div class="progress-ring" role="progressbar" aria-label="${s("已验收完成的任务比例", "Accepted actions")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-track" cx="50" cy="50" r="40"/><circle class="ring-fill" cx="50" cy="50" r="40" pathLength="100" stroke-dasharray="${percent} 100"/></svg><strong>${percent}<small>%</small></strong></div><div><h2>${s("我们的传承进度", "Our progress")}</h2><p>${s(`已完成 ${done} 项，共 ${total} 项`, `${done} of ${total} actions done`)}</p><button class="phone-inline" data-view="timeline">${s("看看走到哪一步", "See our journey")}${icon("arrow")}</button></div></section><section class="phone-next"><div class="phone-section-label">${icon("leaf")}<h2>${next ? s("下一步，做这件事", "One thing to do next") : s("每一步，都已用心完成", "Every step has been completed")}</h2></div>${next ? `<div class="next-preview">${art(taskPicture(next))}<div><strong>${esc(value(next, "title"))}</strong>${badge(next)}</div></div><button class="phone-primary" data-action="edit" data-id="${esc(next.id)}">${icon("play")}${s("打开这件事", "Open this action")}${icon("arrow")}</button>` : `<p>${s("谢谢每一位家人的参与。", "Thank you to everyone who helped.")}</p><button class="phone-primary" data-view="list">${icon("check")}${s("看看全部成果", "See all our actions")}</button>`}</section><section class="phone-topics"><h2>${s("想从哪里开始？", "What would you like to do?")}</h2><div class="topic-grid">${phoneCategories.map((c) => `<button class="topic-tile" data-category="${c.id}">${art(c.icon)}<strong>${lang === "en" ? c.en : c.zh}</strong><span>${project.tasks.filter((t) => c.ids.includes(t.id) && complete(t)).length} / ${project.tasks.filter((t) => c.ids.includes(t.id)).length} ${s("项完成", "done")}</span></button>`).join("")}</div><button class="phone-secondary phone-wide" data-view="list">${icon("list")}${s("查看全部任务", "See all actions")}</button></section>`;
  }
  function tasks() {
    return `${pageHeading(categoryInfo ? (lang === "en" ? categoryInfo.en : categoryInfo.zh) : s("一起做任务", "Our actions"), s("点一张卡片，就能查看和记录。", "Tap a card to read it and save your progress."))}<label class="phone-search">${icon("search")}<input id="search" type="search" value="${esc(query)}" aria-label="${s("查找任务", "Find an action")}" placeholder="${s("输入名称，查找任务", "Search by name")}"></label><div class="phone-filter-grid" role="group" aria-label="${s("按进度查找", "Find by progress")}">${[
      ["all", "list", s("全部", "All")],
      ["进行中", "play", s("正在做", "Doing")],
      ["待家族确认", "people", s("家人审阅", "Family review")],
      ["已完成", "check", s("已完成", "Done")],
    ]
      .map(
        ([f, i, label]) =>
          `<button data-filter="${f}" aria-pressed="${filter === f}">${icon(i)}${label}</button>`,
      )
      .join(
        "",
      )}</div>${category !== "all" || filter !== "all" || query || owner ? `<div class="phone-filter-summary"><span>${s("找到", "Found")} ${filtered().length} ${s("件事", "actions")}</span><button class="phone-inline" data-action="clear">${icon("close")}${s("显示全部", "Show all")}</button></div>` : ""}<div class="phone-task-list">${drilldown ? `<div class="dashboard-drilldown-note"><span>${s("仪表盘选中的任务", "Actions selected in the dashboard")}</span><button class="module-button" data-action="clear">${s("显示全部", "Show all")}</button></div>` : ""}${filtered().map(taskButton).join("") || `<div class="phone-empty">${art("search")}<h2>${s("这里暂时没有任务", "No actions here yet")}</h2><button class="phone-secondary" data-action="clear">${s("看看全部任务", "See all actions")}</button></div>`}</div><button class="phone-secondary phone-wide" data-action="add">${icon("plus")}${s("增加一件事", "Add an action")}</button>`;
  }
  function journey() {
    return `${pageHeading(s("一步一步，传下去", "Our legacy journey"), s("每一步都算数，完成后会亮起对勾。", "Every step counts. Accepted actions show a tick."))}<section class="phone-journey">${[
      [
        "P0",
        "shield",
        s("先保护好资料", "Keep records safe"),
        s(
          "确认联系人、盘点、备份和授权",
          "Contacts, inventory, backup and consent",
        ),
      ],
      [
        "P1",
        "tree",
        s("记录故事与家谱", "Record stories & roots"),
        s(
          "访谈长辈、整理资料、完善系统",
          "Interviews, archives and the family app",
        ),
      ],
      [
        "P2",
        "people",
        s("家人审阅与交接", "Review & pass it on"),
        s("一起确认，安排好今后的维护", "Review together and plan future care"),
      ],
    ]
      .map(([p, i, title, note], n) => {
        const all = project.tasks.filter((t) => t.priority === p),
          count = all.filter(complete).length;
        return `<article class="journey-step ${all.length && count === all.length ? "step-done" : ""}"><div class="journey-marker">${all.length && count === all.length ? icon("check") : n + 1}</div><button class="journey-card" data-stage="${p}">${art(i)}<span><strong>${title}</strong><span>${note}</span><b>${count} / ${all.length} ${s("项完成", "done")}</b></span>${icon("chevron")}</button></article>`;
      })
      .join(
        "",
      )}</section><button class="phone-secondary phone-wide" data-action="start">${icon("calendar")}${s("设置项目开始日期", "Set the start date")}</button><p class="phone-caption">${s("开始日期：", "Start date: ")}${esc(dateLabel(project.startDate))}</p>`;
  }
  function more() {
    return `${pageHeading(s("放心保存，慢慢传承", "Keep it safe. Pass it on."), cloudEnabled ? s("资料保存在云端，家人可以共同维护。", "Records are stored in the cloud for authorized family members to maintain together.") : s("资料只保存在这台设备，请定期备份。", "Edits stay on this device. Back up regularly."))}${moduleLinks()}<div class="phone-tools"><button data-action="export-json">${art("backup")}<span><strong>${s("保存一份备份", "Save a backup")}</strong><span>${s("保存完整计划，方便以后恢复", "Keep a full copy to restore later")}</span></span>${icon("download")}</button><button data-action="import">${art("folder")}<span><strong>${s("恢复以前的备份", "Restore a backup")}</strong><span>${s("选择之前保存的文件", "Choose a previously saved file")}</span></span>${icon("upload")}</button><button data-action="export-csv">${art("list")}<span><strong>${s("导出任务清单", "Export the action list")}</strong><span>${s("可用表格软件查看", "Open it in a spreadsheet app")}</span></span>${icon("download")}</button></div><details class="phone-details"><summary>${icon("history")}${s("看看最近的记录", "See recent activity")}</summary><div class="phone-activity">${
      project.history.length
        ? project.history
            .slice(0, 30)
            .map(
              (entry) =>
                `<article>${icon("check")}<div><p>${esc(lang === "en" && entry.textEn ? entry.textEn : entry.text)}</p><small>${esc(fmt(entry.at))} · UTC+8</small></div></article>`,
            )
            .join("")
        : `<p>${s("保存后，就会在这里留下记录。", "Updates appear here after saving.")}</p>`
    }</div></details><details class="phone-details"><summary>${icon("shield")}${s("资料保存说明", "About your records")}</summary><p>${cloudEnabled ? s("共享记录保存在云端，只有获授权的家族成员能读取和修改。请勿在此记录密码。", "Shared records are stored in the cloud and accessible only to authorized family members. Do not enter passwords.") : s("这是公开的计划模板。你的修改只留在当前浏览器，不会自动同步到其他设备。请勿在此填写密码或敏感资料。", "This is a public planning template. Edits stay in this browser and do not sync to other devices. Keep passwords and sensitive records elsewhere.")}</p><a class="phone-secondary phone-wide" href="https://wu-family-project-hub.luoxi.chatgpt.site/">${icon("shield")}${s("打开原私密云端工作台", "Open the private cloud workspace")}</a></details>`;
  }
  const titles = {
    overview: home,
    board: tasks,
    list: tasks,
    timeline: journey,
    history: more,
    dashboard: () => dashboardContent,
    people: () => peopleContent,
    security: () => securityContent,
  };
  return `<main id="main" class="phone-main"><header class="phone-topbar"><a class="phone-brand" href="./" aria-label="${s("家族传承首页", "Family legacy home")}"><img src="./assets/seal.svg" width="38" height="38" alt=""><span>${s("家族传承", "Family legacy")}</span></a><div class="phone-language" role="group" aria-label="Language / 语言"><button data-lang="zh" aria-pressed="${lang === "zh"}">中文</button><button data-lang="en" aria-pressed="${lang === "en"}">EN</button></div></header><div class="phone-reading"><span>${icon("text")}${s("看得清，慢慢做", "Easy to read. Easy to use.")}</span><button data-action="text-size" aria-pressed="${largeText}">${largeText ? s("恢复大字", "Standard text") : s("更大字", "Larger text")}${icon("plus")}</button></div><div class="phone-content">${storageIssue ? `<p class="phone-warning" role="alert">${s("本机记录无法读取，请先到“更多”导入有效备份。", "Cannot read saved records. Restore a valid backup under More.")}</p>` : ""}${titles[view]()}<p class="phone-local-note">${icon("shield")}${cloudEnabled ? s("后端共享保存 · 已授权家人可访问", "Shared backend · Authorized family members") : s("只保存在本机 · 请定期备份", "Saved on this device · Back up regularly")}</p></div><nav class="phone-bottom-nav" aria-label="${s("主要操作", "Main navigation")}">${[
    ["overview", "home", s("首页", "Home")],
    ["list", "list", s("做任务", "Actions")],
    ["dashboard", "board", s("看全局", "Dashboard")],
    ["history", "settings", s("更多", "More")],
  ]
    .map(
      ([v, i, title]) =>
        `<button data-view="${v}" ${view === v || (view === "board" && v === "list") || (view === "timeline" && v === "dashboard") || (view === "people" && v === "history") ? 'aria-current="page"' : ""}>${icon(i)}<span>${title}</span></button>`,
    )
    .join("")}</nav></main>`;
}

export function phoneEditor(task, isNew, lang, h) {
  const { s, esc, icon, art, value } = h,
    key = (k) => (lang === "en" ? k + "En" : k);
  const input = (name, label, type = "text", extra = "") =>
    `<label>${label}<input name="${name}" type="${type}" value="${esc(task[name] ?? (name.endsWith("En") ? task[name.slice(0, -2)] || "" : ""))}" ${extra}></label>`;
  const bilingual = (name, label) =>
    `<label>${label}<textarea name="${key(name)}" rows="3" maxlength="12000">${esc(value(task, name))}</textarea></label>`;
  return `<form id="task-form"><div class="dialog-head phone-editor-head"><h2 id="dialog-title">${s("一起做好这件事", "One action at a time")}</h2><button type="button" class="phone-close" data-close="editor">${icon("close")}${s("关闭", "Close")}</button></div><div class="form-body phone-form"><section class="phone-action-intro">${art(taskPicture(task))}<div><strong>${esc(value(task, "title") || s("新的一件事", "A new action"))}</strong><p>${esc(task.assignee || s("人名待确认", "Person to confirm"))} · ${esc(value(task, "owner") || s("可以和家人一起完成", "A step to take together"))}</p></div></section>${h.assigneeField ? h.assigneeField(task) : input("assignee", s("具体人名", "Assignee"), "text", 'maxlength="120"')}${!isNew && value(task, "action") ? `<section class="phone-instruction"><h3>${icon("leaf")}${s("这一步做什么？", "What is this step?")}</h3><p>${esc(value(task, "action"))}</p></section>` : ""}<fieldset class="phone-status-picker"><legend>${s("① 现在到哪一步？", "1. How is it going?")}</legend><div>${statuses.map((st, i) => `<label><input type="radio" name="status" value="${st}" ${task.status === st ? "checked" : ""}><span>${icon(statusPictures[i])}${esc(friendlyStatus(st, lang))}</span></label>`).join("")}</div></fieldset><label class="phone-progress-label">${s("② 记下进展（可以稍后填写）", "2. Add a note (optional)")}<textarea name="next" rows="3" maxlength="12000" placeholder="${s("例如：和家人约好周日一起认照片。", "For example: We will identify the photos together on Sunday.")}">${esc(task.next)}</textarea></label>${stewardshipEditor(task, { s, esc })}<details id="acceptance-details" class="phone-details" ${task.status === "已完成" ? "open" : ""}><summary>${icon("check")}${s("准备完成？填写交付与验收", "Ready to finish? Confirm delivery")}</summary><div class="phone-delivery-fields"><p>${s("完成前，请留下凭据，并请家人确认。", "Before finishing, add evidence and ask the family to confirm.")}</p><label>${s("交付凭据 / 文件编号", "Evidence / file reference")}<textarea name="evidence" rows="3" maxlength="12000">${esc(task.evidence)}</textarea></label>${input("completed", s("完成日期", "Completion date"), "date")}<label class="checkbox"><input type="checkbox" name="accepted" ${task.accepted ? "checked" : ""}>${s("家人已看过，并确认完成", "The family has reviewed and accepted it")}</label></div></details><details class="phone-details phone-plan-settings" ${isNew ? "open" : ""}><summary>${icon("settings")}${s("修改任务内容与日期", "Edit the action and dates")}</summary><div class="phone-plan-fields">${input(key("title"), s("这件事叫什么？", "What is this action called?"), "text", 'required maxlength="160"')}${input(key("owner"), s("负责人描述", "Responsibility"))}${input(key("collaborators"), s("其他参与家人", "Other collaborators"))}${bilingual("action", s("具体行动", "Action steps"))}${bilingual("deliverable", s("交付物与完成标准", "What should be delivered?"))}${bilingual("dependency", s("前置条件", "What needs to happen first?"))}<label>${s("优先级", "Priority")}<select name="priority">${["P0", "P1", "P2"].map((p) => `<option ${task.priority === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>${input("weekStart", s("建议开始周", "Suggested start week"), "number", 'min="1" max="104" required')}${input("weekEnd", s("建议结束周", "Suggested end week"), "number", 'min="1" max="104" required')}${input("due", s("手动截止日", "Manual due date"), "date")}<details class="phone-details"><summary>${icon("globe")}${s("补充英文内容", "Add Chinese content")}</summary><div class="phone-plan-fields">${[
    "title",
    "owner",
    "collaborators",
    "action",
    "deliverable",
    "dependency",
  ]
    .map((k, i) => {
      const opposite = lang === "en" ? k : k + "En";
      return `<label>${s(["英文名称", "英文负责人", "英文参与人", "英文行动", "英文交付标准", "英文前置条件"][i], ["Chinese title", "Chinese owner", "Chinese collaborators", "Chinese action", "Chinese deliverables", "Chinese dependencies"][i])}<textarea name="${opposite}" rows="2" maxlength="${k === "title" ? 160 : 12000}">${esc(task[opposite])}</textarea></label>`;
    })
    .join(
      "",
    )}</div></details></div></details><p id="form-error" class="form-error" tabindex="-1" role="alert"></p></div><div class="dialog-footer phone-save-footer"><button type="button" class="phone-secondary" data-close="editor">${s("暂不保存", "Cancel")}</button><button type="submit" class="phone-primary">${icon("check")}${s("保存进展", "Save progress")}</button></div></form>`;
}
