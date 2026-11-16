export function cloudError(error, lang) {
  const messages = {
    "dfplan/config": [
      "Firebase 配置尚未完成。",
      "Firebase configuration is incomplete.",
    ],
    "dfplan/not-initialized": [
      "后台尚未初始化，请先完成管理员和项目初始化。",
      "Initialize the owner and project in the backend first.",
    ],
    "dfplan/not-admin": [
      "这个 Google 账号尚未获得管理员权限。",
      "This Google account has not been granted administrator access.",
    ],
    "permission-denied": [
      "没有管理员权限，或权限已停用。",
      "Administrator access is missing or has been disabled.",
    ],
    "dfplan/conflict": [
      "其他管理员已更新数据。请先刷新云端，再重新打开任务修改；当前填写的内容尚未保存。",
      "Another administrator changed the project. Refresh and reopen the action. Your current edits have not been saved.",
    ],
    "dfplan/no-delete": [
      "导入文件缺少云端已有任务，请先合并，不能直接删除已有任务。",
      "The import omits existing cloud actions. Merge them first; existing actions cannot be deleted.",
    ],
    "dfplan/task-id": [
      "任务编号只能使用字母、数字、横线和下划线。",
      "Action IDs may contain only letters, numbers, hyphens and underscores.",
    ],
    "dfplan/admin-format": [
      "请填写姓名和有效的 Google 邮箱。",
      "Enter a name and a valid Google account email.",
    ],
    "dfplan/admin-exists": [
      "这个邮箱已有管理员记录，可在名单中启用。",
      "This email already has a membership. Enable it in the list.",
    ],
    "dfplan/self-disable": [
      "不能在此停用自己的账号。",
      "You cannot disable your own account here.",
    ],
    "auth/popup-blocked": [
      "浏览器阻止了登录窗口。请允许本站打开登录窗口后，再点击 Google 登录。",
      "Allow pop-ups for this site, then tap Sign in with Google again.",
    ],
    "auth/popup-closed-by-user": [
      "登录窗口已关闭，可以重新登录。",
      "The sign-in window was closed. You can try again.",
    ],
    "auth/unauthorized-domain": [
      "请在 Firebase Authentication 中授权 dcdeeptech.com 域名。",
      "Authorize dcdeeptech.com in Firebase Authentication.",
    ],
    "auth/network-request-failed": [
      "暂时无法连接 Google 登录，请检查网络后重试。",
      "Cannot connect to Google sign-in. Check the connection and try again.",
    ],
    unavailable: [
      "无法连接云端，尚未保存。请检查网络后重试。",
      "The backend is unavailable. Changes have not been saved. Check your connection.",
    ],
  };
  return (messages[error?.code] || [
    "云端操作未完成，请检查网络或后台配置后重试。",
    "The cloud operation could not complete. Check the connection or backend configuration.",
  ])[lang === "en" ? 1 : 0];
}
export function cloudGate(session, available, message, h) {
  const { s, esc, icon } = h;
  const busy = ["connecting", "checking", "reading"].includes(session.phase),
    denied = session.phase === "denied",
    canInitialize =
      session.phase === "not-initialized" && session.admin?.role === "owner";
  return `<main id="main" class="cloud-gate"><header><img src="./assets/seal.svg" width="54" height="54" alt=""><strong>DeepFamily</strong><div class="cloud-lang"><button data-lang="zh" aria-pressed="${document.documentElement.lang !== "en"}">中文</button><button data-lang="en" aria-pressed="${document.documentElement.lang === "en"}">EN</button></div></header><section>${icon("shield")}<h1>${canInitialize ? s("建立家族传承计划", "Create the family legacy plan") : busy ? s("正在连接家族工作台", "Connecting to the family workspace") : denied ? s("请使用已获授权的 Google 账号", "Use an authorized Google account") : s("登录家族工作台", "Sign in to the family workspace")}</h1><p>${busy ? s("请稍候，正在确认账号和读取云端记录。", "Please wait while we check your account and load the cloud records.") : s("管理员登录后，可以查看和修改共享计划。", "Administrators can view and update the shared plan after signing in.")}</p>${session.user?.email ? `<p class="cloud-email">${esc(session.user.email)}</p>` : ""}${message ? `<p class="cloud-alert" role="alert">${esc(message)}</p>` : ""}${canInitialize ? `<p>${s("将建立10项基础行动。本机旧记录不会自动上传，可在登录后确认导入。", "Create ten initial actions. Earlier device records will not be uploaded automatically; you can review and import them afterwards.")}</p><button class="cloud-primary" data-action="cloud-initialize">${icon("leaf")}${s("建立家族计划", "Create the family plan")}</button>` : ""}${!busy && !canInitialize ? `<button class="cloud-primary" data-action="cloud-login" ${!available ? "disabled" : ""}>${icon("globe")}${s("使用 Google 账号登录", "Sign in with Google")}</button>` : ""}${session.user?.email ? `<button class="cloud-secondary" data-action="cloud-logout">${s("退出并更换账号", "Sign out to change account")}</button>` : ""}${message ? `<button class="cloud-secondary" data-action="cloud-refresh">${s("重新连接", "Reconnect")}</button>` : ""}<p class="cloud-small">${s("只有已启用的管理员能读取或修改云端资料。", "Only active administrators can access or change cloud records.")}</p></section></main>`;
}
export function cloudBar(session, updatedAt, saving, h) {
  const { s, esc, icon, fmt } = h;
  return `<section class="cloud-bar" aria-label="${s("云端账号与同步", "Cloud account and sync")}"><div>${icon("shield")}<span><strong>${esc(session.admin.displayName)}</strong><span>${saving ? s("正在保存到云端…", "Saving to the backend…") : updatedAt ? s("云端已同步 · ", "Cloud synced · ") + esc(fmt(updatedAt)) : s("正在读取云端记录", "Loading cloud records")}</span></span></div><button data-action="cloud-account">${icon("people")}${s("管理员", "Admins")}</button></section>`;
}
export function adminDialog(members, session, hasLegacy, h) {
  const { s, esc, icon } = h;
  return `<div class="dialog-head"><h2 id="account-title">${s("管理员与账号", "Administrators & account")}</h2><button class="cloud-secondary" data-close="account-dialog">${icon("close")}${s("关闭", "Close")}</button></div><div class="form-body cloud-admin-body"><p>${esc(session.user.email)}</p><div class="cloud-member-list">${members.map((m) => `<article><div><strong>${esc(m.displayName)}</strong><span>${esc(m.email)}</span><b>${m.role === "owner" ? s("初始管理员 · 受保护", "Initial administrator · protected") : m.active ? s("已启用", "Active") : s("已停用", "Disabled")}</b></div>${m.role === "owner" || m.email === session.user.email.toLowerCase() ? "" : `<button class="cloud-secondary" data-admin-email="${esc(m.email)}" data-admin-enable="${!m.active}">${m.active ? s("停用", "Disable") : s("启用", "Enable")}</button>`}</article>`).join("")}</div><form id="add-admin-form"><h3>${s("增加一位管理员", "Add an administrator")}</h3><label>${s("姓名", "Name")}<input name="displayName" required maxlength="120" autocomplete="name"></label><label>${s("Google 邮箱", "Google account email")}<input name="email" type="email" required maxlength="254" autocomplete="email" autocapitalize="none" spellcheck="false"></label><p>${s("填写对方现有的 Google 邮箱。加入后，对方可用该账号登录，不需要另设密码。", "Use their existing Google account email. They can then sign in with Google; no separate password is created.")}</p><button class="cloud-primary" type="submit">${icon("plus")}${s("加入管理员名单", "Add to the administrator list")}</button></form>${hasLegacy ? `<section class="cloud-legacy"><h3>${s("迁移本机旧记录", "Migrate earlier device records")}</h3><p>${s("旧记录不会自动上传。确认后可导入云端；现有云端修改记录会保留。", "Earlier device records are not uploaded automatically. You can review and import them. Existing cloud history is retained.")}</p><button class="cloud-secondary" data-action="cloud-legacy-export">${s("先导出旧记录备份", "Back up device records first")}</button><button class="cloud-secondary" data-action="cloud-migrate">${s("查看并确认导入", "Review and import")}</button></section>` : ""}<p id="account-error" class="cloud-alert" role="alert"></p><button class="cloud-secondary" data-action="cloud-refresh">${s("刷新云端数据", "Refresh cloud records")}</button><button class="cloud-secondary" data-action="cloud-logout">${s("退出 Google 账号", "Sign out of Google")}</button></div>`;
}
