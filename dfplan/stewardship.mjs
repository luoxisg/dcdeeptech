// Optional planning records, never account permissions or material-level consent.
export const stewardshipFields = [
  ["reviewer", "验收人（待本人确认）", "Reviewer (subject to confirmation)", "text", 120],
  ["backup", "执行替补（待本人确认）", "Backup person (subject to confirmation)", "text", 120],
  ["claimedOn", "认领日期", "Claimed on", "date"],
  ["effort", "预计投入 / 每周可用时间", "Estimated effort / weekly availability", "text", 500],
  ["blockers", "阻碍 / 需谁决定 / 升级路径", "Blockers / decision needed / escalation", "textarea", 12000],
  ["outcomes", "已保全 / 已核对成果及受控记录编号", "Preserved / verified outcomes and controlled references", "textarea", 12000],
  ["recovery", "原始资料恢复记录（日期、范围、结果、复核人）", "Original-material recovery record (date, scope, result, reviewer)", "textarea", 12000],
];

const proposals = [
  ["确认执行、验收、替补和实际投入；区分内部留存与公开展示。", "Confirm execution, review, backup and available time; separate internal archives from public display."],
  ["分批登记原件位置、来源、用途和备份；可与已获同意的访谈并行。", "Inventory originals, sources, uses and backups in batches, alongside interviews with agreed consent."],
  ["W1先保全，让授权替补从独立副本恢复实际照片或录音；计划JSON不等于原始资料备份。", "Safeguard in W1; have an authorized backup person restore real photos or audio from an independent copy. Plan JSON does not back up original materials."],
  ["按资料分别确认录制、家族分享、AI处理、公开及供应商用途；版权另核对。", "Record recording, family sharing, AI, public and vendor uses separately for each material; check copyright separately."],
  ["首周先联络、确认具体访谈者、语言和陪同；明确同意后按本人舒适度做小试点，不必等技术完善。", "Contact elders and confirm an interviewer, language and companion in week one. With clear consent, run a small, comfortable pilot without waiting for technical upgrades."],
  ["首两周以小批资料测试工时与质量，保留母版、来源、编号和原件交接。", "Pilot a small batch in the first two weeks to measure effort and quality; retain masters, sources, IDs and original handover records."],
  ["保留原始叙述与不同说法，注明异写、日期体系、来源及核实状态。", "Keep original accounts and differing views, with spelling variants, calendar systems, sources and verification status."],
  ["先支持试点所需操作；分别记录源码检查、测试、后端读回和真实用户验收。", "Support pilot needs first; record source review, tests, backend readback and actual user acceptance separately."],
  ["随资料分批审阅，记录意见来源、修改理由、限制范围和验收日。", "Review in batches, recording feedback sources, reasons for changes, access restrictions and acceptance dates."],
  ["W1先确认SGD预算上限、付款/批准角色与主备保管；W10–12交接，交接后30/90天复查。", "Agree SGD budget limits, payer, approver and primary/backup custodians in W1; hand over in W10–12 and review 30/90 days later."],
];

export function stewardshipEditor(task, { s, esc }) {
  const proposal = /^WU-0[1-9]$|^WU-10$/.test(task.id)
    ? proposals[Number(task.id.slice(3)) - 1] : null;
  return `<details class="phone-details stewardship"><summary>${s("分工、成果与接班", "Responsibilities, outcomes and continuity")}</summary><div class="phone-plan-fields"><p>${s("以下为计划记录，不授予账号权限，也不代替材料使用许可。空白表示待确认。成果与恢复记录请写受控文件编号，不存放原件或密码。", "These planning records grant no account permissions or material-use consent. Blank means unconfirmed. Use controlled references for outcomes and recovery; keep originals and passwords elsewhere.")}</p>${proposal ? `<p class="module-notice">${s("Skill建议（待家族确认）：", "Skill proposal (subject to family agreement): ")}${esc(s(...proposal))}</p>` : ""}${stewardshipFields.map(([name, zh, en, type, limit]) => `<label>${s(zh, en)}${type === "textarea" ? `<textarea name="${name}" rows="2" maxlength="${limit}">${esc(task[name] || "")}</textarea>` : `<input name="${name}" type="${type}" ${limit ? `maxlength="${limit}"` : ""} value="${esc(task[name] || "")}">`}</label>`).join("")}</div></details>`;
}

export function stewardshipSummary(tasks) {
  const has = (t, key) => !!t[key]?.trim();
  return {
    reviewer: tasks.filter(t => has(t, "reviewer")).length,
    backup: tasks.filter(t => has(t, "backup")).length,
    claimed: tasks.filter(t => has(t, "claimedOn")).length,
    outcomes: tasks.filter(t => has(t, "outcomes")).length,
    recovery: tasks.filter(t => has(t, "recovery")).length,
  };
}

export function stewardshipDashboard(tasks, { s }) {
  const counts = stewardshipSummary(tasks);
  const labels = [
    ["reviewer", "填写验收人", "Reviewer recorded"],
    ["backup", "填写执行替补", "Backup person recorded"],
    ["claimed", "填写认领日期", "Claim date recorded"],
    ["outcomes", "填写保全 / 核对成果", "Outcome record provided"],
    ["recovery", "填写原始资料恢复记录", "Original-material recovery record provided"],
  ];
  return `<section class="dashboard-panel"><h2>${s("家族成果与接班记录", "Family outcomes and continuity records")}</h2><p>${s("按当前筛选的任务统计填写覆盖，不代表材料数量、独立核验或权限已生效。", "Coverage counts tasks in the current selection with records, not material quantities, independent verification or effective permissions.")}</p><dl class="stewardship-stats">${labels.map(([key, zh, en]) => `<div><dt>${s(zh, en)}</dt><dd>${counts[key]} / ${tasks.length}</dd></div>`).join("")}</dl><p>${s("在任务详情的“分工、成果与接班”中填写。计划JSON/CSV备份只包含计划记录，不包含照片、录音或数据库备份。", "Fill these in under Responsibilities, outcomes and continuity in each action. Plan JSON/CSV backups contain planning records, not photos, audio or database backups.")}</p></section>`;
}
