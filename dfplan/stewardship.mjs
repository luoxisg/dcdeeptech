// Optional planning records, never account permissions or material-level consent.
export const stewardshipFields = [
  [
    "reviewer",
    "验收人（待本人确认）",
    "Reviewer (subject to confirmation)",
    "text",
    120,
  ],
  [
    "backup",
    "执行替补（待本人确认）",
    "Backup person (subject to confirmation)",
    "text",
    120,
  ],
  ["claimedOn", "认领日期", "Claimed on", "date"],
  [
    "effort",
    "预计投入 / 每周可用时间",
    "Estimated effort / weekly availability",
    "text",
    500,
  ],
  [
    "blockers",
    "阻碍 / 需谁决定 / 升级路径",
    "Blockers / decision needed / escalation",
    "textarea",
    12000,
  ],
  [
    "outcomes",
    "已保全 / 已核对成果及受控记录编号",
    "Preserved / verified outcomes and controlled references",
    "textarea",
    12000,
  ],
  [
    "recovery",
    "原始资料恢复记录（日期、范围、结果、复核人）",
    "Original-material recovery record (date, scope, result, reviewer)",
    "textarea",
    12000,
  ],
];

const proposals = [
  [
    "确认执行、验收、替补和实际投入；区分内部留存与公开展示。",
    "Confirm execution, review, backup and available time; separate internal archives from public display.",
  ],
  [
    "分批登记原件位置、来源、用途和备份；可与已获同意的访谈并行。",
    "Inventory originals, sources, uses and backups in batches, alongside interviews with agreed consent.",
  ],
  [
    "W1先保全，让授权替补从独立副本恢复实际照片或录音；计划JSON不等于原始资料备份。",
    "Safeguard in W1; have an authorized backup person restore real photos or audio from an independent copy. Plan JSON does not back up original materials.",
  ],
  [
    "按资料分别确认录制、家族分享、AI处理、公开及供应商用途；版权另核对。",
    "Record recording, family sharing, AI, public and vendor uses separately for each material; check copyright separately.",
  ],
  [
    "首周先联络、确认具体访谈者、语言和陪同；明确同意后按本人舒适度做小试点，不必等技术完善。",
    "Contact elders and confirm an interviewer, language and companion in week one. With clear consent, run a small, comfortable pilot without waiting for technical upgrades.",
  ],
  [
    "首两周以小批资料测试工时与质量，保留母版、来源、编号和原件交接。",
    "Pilot a small batch in the first two weeks to measure effort and quality; retain masters, sources, IDs and original handover records.",
  ],
  [
    "保留原始叙述与不同说法，注明异写、日期体系、来源及核实状态。",
    "Keep original accounts and differing views, with spelling variants, calendar systems, sources and verification status.",
  ],
  [
    "先支持试点所需操作；分别记录源码检查、测试、后端读回和真实用户验收。",
    "Support pilot needs first; record source review, tests, backend readback and actual user acceptance separately.",
  ],
  [
    "随资料分批审阅，记录意见来源、修改理由、限制范围和验收日。",
    "Review in batches, recording feedback sources, reasons for changes, access restrictions and acceptance dates.",
  ],
  [
    "W1先确认SGD预算上限、付款/批准角色与主备保管；W10–12交接，交接后30/90天复查。",
    "Agree SGD budget limits, payer, approver and primary/backup custodians in W1; hand over in W10–12 and review 30/90 days later.",
  ],
];

export function stewardshipEditor(task, { s, esc }) {
  const proposal = /^WU-0[1-9]$|^WU-10$/.test(task.id)
    ? proposals[Number(task.id.slice(3)) - 1]
    : null;
  return `<details class="phone-details stewardship"><summary>${s("分工、成果与接班", "Responsibilities, outcomes and continuity")}</summary><div class="phone-plan-fields"><p>${s("以下为计划记录，不授予账号权限，也不代替材料使用许可。空白表示待确认。成果与恢复记录请写受控文件编号，不存放原件或密码。", "These planning records grant no account permissions or material-use consent. Blank means unconfirmed. Use controlled references for outcomes and recovery; keep originals and passwords elsewhere.")}</p>${proposal ? `<p class="module-notice">${s("Skill建议（待家族确认）：", "Skill proposal (subject to family agreement): ")}${esc(s(...proposal))}</p>` : ""}${stewardshipFields.map(([name, zh, en, type, limit]) => `<label>${s(zh, en)}${type === "textarea" ? `<textarea name="${name}" rows="2" maxlength="${limit}">${esc(task[name] || "")}</textarea>` : `<input name="${name}" type="${type}" ${limit ? `maxlength="${limit}"` : ""} value="${esc(task[name] || "")}">`}</label>`).join("")}</div></details>`;
}

export function stewardshipSummary(tasks) {
  const has = (t, key) => !!t[key]?.trim();
  return {
    reviewer: tasks.filter((t) => has(t, "reviewer")).length,
    backup: tasks.filter((t) => has(t, "backup")).length,
    claimed: tasks.filter((t) => has(t, "claimedOn")).length,
    outcomes: tasks.filter((t) => has(t, "outcomes")).length,
    recovery: tasks.filter((t) => has(t, "recovery")).length,
  };
}

export function stewardshipDashboard(tasks, { s }) {
  const counts = stewardshipSummary(tasks);
  const labels = [
    ["reviewer", "填写验收人", "Reviewer recorded"],
    ["backup", "填写执行替补", "Backup person recorded"],
    ["claimed", "填写认领日期", "Claim date recorded"],
    ["outcomes", "填写保全 / 核对成果", "Outcome record provided"],
    [
      "recovery",
      "填写原始资料恢复记录",
      "Original-material recovery record provided",
    ],
  ];
  return `<section class="dashboard-panel"><h2>${s("家族成果与接班记录", "Family outcomes and continuity records")}</h2><p>${s("按当前筛选的任务统计填写覆盖，不代表材料数量、独立核验或权限已生效。", "Coverage counts tasks in the current selection with records, not material quantities, independent verification or effective permissions.")}</p><dl class="stewardship-stats">${labels.map(([key, zh, en]) => `<div><dt>${s(zh, en)}</dt><dd>${counts[key]} / ${tasks.length}</dd></div>`).join("")}</dl><p>${s("在任务详情的“分工、成果与接班”中填写。计划JSON/CSV备份只包含计划记录，不包含照片、录音或数据库备份。", "Fill these in under Responsibilities, outcomes and continuity in each action. Plan JSON/CSV backups contain planning records, not photos, audio or database backups.")}</p></section>`;
}

export function securityGuide({ s, icon }, hasBackupTask = true) {
  const cards = [
    [
      "shield",
      "硬盘加密",
      "Encrypt the drives",
      "使用 BitLocker To Go 或 VeraCrypt 加密；密码与恢复密钥分别交由指定人员保管，不填写在 PM 网页。",
      "Encrypt drives with BitLocker To Go or VeraCrypt. Keep passwords and recovery keys with designated custodians through separate arrangements, outside this PM workspace.",
    ],
    [
      "backup",
      "三份副本，一份异地",
      "Three copies, one off-site",
      "保留一份工作资料和两份独立备份，其中一份放在另一地点。备份完成后断开连接，避免误删或恶意软件同时影响全部副本。",
      "Keep a working copy and two independent backups, with one at another location. Disconnect backups after use to reduce the risk of deletion or malware affecting every copy.",
    ],
    [
      "people",
      "保管责任与接管",
      "Custody and handover",
      "指定资料保管人、备份负责人和备用接管人。原始资料、整理副本和可公开资料分别授权；人员变更时及时交接。",
      "Name a materials custodian, backup lead and alternate custodian. Authorize originals, working copies and public materials separately, and document handovers when roles change.",
    ],
    [
      "check",
      "备份后验证恢复",
      "Verify actual recovery",
      "备份后检查文件完整性，定期从独立副本抽样恢复照片、录音和文档，记录日期、范围、结果与复核人。",
      "Check file integrity after backup. Periodically restore sample photos, recordings and documents from an independent copy, recording the date, scope, result and reviewer.",
    ],
    [
      "review",
      "按资料确认使用授权",
      "Confirm permissions per material",
      "采访、照片和录音分别记录谁可使用、是否允许家族分享、公开或 AI 处理。保留授权依据，范围变化时重新确认。",
      "For interviews, photos and recordings, record who may use them and whether family sharing, public display or AI processing is allowed. Retain permission evidence and reconfirm changes in scope.",
    ],
    [
      "handover",
      "定期检查与交接",
      "Review and transfer safely",
      "检查备份是否及时、恢复测试是否逾期、授权是否完整。硬盘丢失、损坏或保管人变更时，登记风险、处理人和后续复核。",
      "Review backup freshness, overdue restore tests and missing permissions. Record risks, an action owner and follow-up review after loss, damage or a change of custodian.",
    ],
  ];
  const rows = [
    [
      "资料批次",
      "Material batches",
      "编号、类别、采集日期、数量、相对目录",
      "Reference ID, type, collection date, count and relative folder",
    ],
    [
      "硬盘登记",
      "Drive register",
      "硬盘编号、保管人、存放区域、加密状态",
      "Drive ID, custodian, storage area and encryption status",
    ],
    [
      "备份检查",
      "Backup checks",
      "副本位置编号、最近备份日期、负责人",
      "Copy-location reference, last backup date and owner",
    ],
    [
      "恢复验证",
      "Recovery checks",
      "抽查日期、方法、范围、结果、下次检查日期",
      "Test date, method, scope, result and next review date",
    ],
    [
      "使用授权",
      "Usage permissions",
      "授权依据编号、使用范围、公开限制、AI 使用许可",
      "Permission reference, allowed uses, publication limits and AI permission",
    ],
    [
      "风险与交接",
      "Risks and handover",
      "缺少备份、检查逾期、保管人变更及处理记录",
      "Missing backups, overdue checks, custodian changes and actions taken",
    ],
  ];
  return `<section class="df-security" aria-labelledby="page-title"><div class="module-head"><div><span class="module-kicker">CARE FOR THE FAMILY ARCHIVE</span><h1 id="page-title" tabindex="-1">${s("资料与安全", "Materials & safety")}</h1><p>${s("硬盘保存资料，PM 网页管理责任与安全检查。", "Keep materials on controlled drives; manage responsibilities and safety checks in PM.")}</p></div></div><div class="module-notice">${icon("shield")}<p>${s("硬盘离线可以降低网络泄露风险，仍需防范丢失、损坏、误删和未经授权复制。以下为操作指引，实际状态须由保管人检查并记录。", "Offline drives reduce online exposure but still need protection against loss, damage, deletion and unauthorized copying. This guide is not a verification of your actual safeguards.")}</p></div><div class="security-cards">${cards.map(([symbol, zh, en, desc, descEn], i) => `<article><div class="security-card-title">${icon(symbol)}<span>${String(i + 1).padStart(2, "0")}</span></div><h2>${s(zh, en)}</h2><p>${s(desc, descEn)}</p></article>`).join("")}</div><section class="security-register"><h2>${s("安全检查应登记什么？", "What should the safety register record?")}</h2><p>${s("在受控登记表中保存以下记录，并在 PM 任务中引用记录编号。仅填写管理信息；密码、恢复密钥、精确住址及原始敏感资料留在受控保管渠道。", "Maintain these records in a controlled register and reference their IDs in PM tasks. Keep passwords, recovery keys, exact home addresses and sensitive source materials in controlled custody channels.")}</p><dl>${rows.map(([zh, en, desc, descEn]) => `<div><dt>${s(zh, en)}</dt><dd>${s(desc, descEn)}</dd></div>`).join("")}</dl><p class="security-separation">${icon("shield")}${s("人员分工权限、网页访问权限和硬盘解密权限分别管理。计划 JSON 备份不能代替照片、录音等原始资料备份。", "Manage task responsibilities, website access and drive-decryption rights separately. A plan JSON export does not back up original photos, recordings or other source materials.")}</p></section><section class="security-acceptance"><h2>${s("从 WU-03「数字资料保全」开始", "Start with WU-03: safeguarding digital materials")}</h2><p>${s("建议验收依据：完成加密、独立备份和实际恢复验证，并由指定人员复核确认。不要仅凭“已复制文件”就标记验收完成。", "Suggested acceptance evidence: encryption, independent backups and an actual recovery test, reviewed by the designated person. Copying files alone is not sufficient evidence.")}</p><p>${s("可在任务的“已保全成果及受控记录编号”和“原始资料恢复记录”中填写批次编号、核验结果及复核人。凭据字段填写受控记录引用，勿粘贴解密凭据。", "Use the task’s preserved-outcomes and recovery-record fields for batch IDs, test results and the reviewer. Reference controlled records in evidence fields; never paste decryption credentials.")}</p><div class="security-actions">${hasBackupTask ? `<button class="module-primary" data-action="edit" data-id="WU-03">${icon("backup")}${s("打开数字资料保全任务", "Open the digital-safeguarding action")}</button>` : ""}<button class="module-button" data-action="export-json">${icon("download")}${s("导出实施计划备份", "Export the implementation plan")}</button></div><p class="security-reminder">${s("定期复查：哪些资料待备份？哪些恢复检查已到期？哪些使用授权尚待确认？请将未完成事项写入任务的“下一步 / 阻碍”。", "Review regularly: which materials need backup, which recovery checks are due, and which permissions need confirmation? Record open items under next steps / blockers.")}</p></section></section>`;
}
