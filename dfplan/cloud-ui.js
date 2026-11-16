export function cloudError(error, lang) {
  const messages = {
    "dfplan/person-format": [
      "请填写有效姓名（最多120字）与分工说明（最多240字）。",
      "Enter a valid name (up to 120 characters) and responsibility (up to 240 characters).",
    ],
    "dfplan/person-exists": [
      "这位人员已在名单中。",
      "This person is already in the directory.",
    ],
    "dfplan/person-removed": [
      "这位人员曾被移出，请在“已移出人员”中恢复。",
      "This person was removed. Restore them under Removed people.",
    ],
    "dfplan/link-invalid": [
      "这个邀请已失效、已使用或已撤销。请联系 luoxi 获取新的专属链接。",
      "This invitation has expired, been used or been revoked. Ask luoxi for a new link.",
    ],
    "auth/operation-not-allowed": [
      "Patrick 的入口尚未开通，请联系 luoxi 完成后端更新。",
      "Patrick’s access is not enabled yet. Ask luoxi to finish the backend update.",
    ],
    "dfplan/config": [
      "Firebase 配置尚未完成。",
      "Firebase configuration is incomplete.",
    ],
    "dfplan/not-initialized": [
      "后台尚未初始化，请先完成管理员和项目初始化。",
      "Initialize the owner and project in the backend first.",
    ],
    "dfplan/not-admin": [
      "当前身份没有执行此操作的权限。",
      "Your current identity is not authorized for this operation.",
    ],
    "permission-denied": [
      "没有执行此操作的权限，或授权已停用。",
      "Permission for this operation is missing or has been revoked.",
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
  const { s, esc, icon, readingControl = "" } = h;
  const busy = ["connecting", "checking", "reading"].includes(session.phase),
    invited = !!session.invite,
    denied = session.phase === "denied",
    canInitialize =
      session.phase === "not-initialized" && session.admin?.role === "owner";
  return `<main id="main" class="cloud-gate"><header><img src="./assets/seal.svg" width="54" height="54" alt=""><strong>DeepFamily</strong><div class="cloud-lang">${readingControl}<button data-lang="zh" aria-pressed="${document.documentElement.lang !== "en"}">中文</button><button data-lang="en" aria-pressed="${document.documentElement.lang === "en"}">EN</button></div></header><section>
  ${icon(invited ? "people" : "shield")}
  <h1>${busy ? s("正在打开家族计划", "Opening the family plan") : invited ? s("Patrick，欢迎回家", "Welcome home, Patrick") : canInitialize ? s("建立家族传承计划", "Create the family legacy plan") : denied ? s("请使用有效的家族访问方式", "Use an authorized family sign-in") : s("登录家族工作台", "Sign in to the family workspace")}</h1>
  <p>${busy ? s("请稍候，正在读取家族记录。", "Please wait while we load the family records.") : invited ? s("点一下，即可一起整理家族记忆。无需填写账号或密码。", "One tap to preserve our family memories. No account or password to enter.") : s("登录后，可以查看和修改共享计划。", "Sign in to view and update the shared plan.")}</p>
  ${session.user?.email ? `<p class="cloud-email">${esc(session.user.email)}</p>` : ""}
  ${message ? `<p class="cloud-alert" role="alert">${esc(message)}</p>` : ""}
  ${canInitialize ? `<button class="cloud-primary" data-action="cloud-initialize">${icon("leaf")}${s("建立家族计划", "Create the family plan")}</button>` : ""}
  ${!busy && !canInitialize && invited ? `<button class="cloud-primary patrick-enter" data-action="cloud-link-login" ${!available ? "disabled" : ""}>${icon("home")}${s("进入家族计划", "Enter the family plan")}</button><p class="cloud-small">${s("首次进入后，这台手机会记住你。", "This browser will remember your access after the first visit.")}</p>` : ""}
  ${!busy && !canInitialize ? `<button class="${invited ? "cloud-secondary" : "cloud-primary"}" data-action="cloud-login" ${!available ? "disabled" : ""}>${icon("globe")}${invited ? s("管理员 Google 登录", "Administrator Google sign-in") : s("使用 Google 账号登录", "Sign in with Google")}</button>` : ""}
  ${session.user ? `<button class="cloud-secondary" data-action="cloud-logout">${s("退出当前访问", "Sign out")}</button>` : ""}
  ${message ? `<button class="cloud-secondary" data-action="cloud-refresh">${s("重新连接", "Reconnect")}</button>` : ""}
  <p class="cloud-small">${s("家族资料仅向已获授权的成员开放。", "Family records are available only to authorized members.")}</p></section></main>`;
}
export function cloudBar(session, updatedAt, saving, h) {
  const { s, esc, icon, fmt } = h;
  return `<section class="cloud-bar" aria-label="${s("云端账号与同步", "Cloud account and sync")}"><div>${icon("shield")}<span><strong>${esc(session.admin.displayName)}</strong><span>${saving ? s("正在保存到云端…", "Saving to the backend…") : updatedAt ? s("云端已同步 · ", "Cloud synced · ") + esc(fmt(updatedAt)) : s("正在读取云端记录", "Loading cloud records")}</span></span></div><button data-action="cloud-account">${icon("people")}${session.admin.role === "editor" ? s("我的访问", "My access") : s("管理员", "Admins")}</button></section>`;
}
export function adminDialog(members, session, hasLegacy, h, invites = []) {
  const { s, esc, icon } = h;
  return `<div class="dialog-head"><h2 id="account-title">${s("管理员与账号", "Administrators & account")}</h2><button class="cloud-secondary" data-close="account-dialog">${icon("close")}${s("关闭", "Close")}</button></div><div class="form-body cloud-admin-body"><p>${esc(session.user.email)}</p><div class="cloud-member-list">${members.map((m) => `<article><div><strong>${esc(m.displayName)}</strong><span>${esc(m.email)}</span><b>${m.role === "owner" ? s("初始管理员 · 受保护", "Initial administrator · protected") : m.active ? s("已启用", "Active") : s("已停用", "Disabled")}</b></div>${m.role === "owner" || m.email === session.user.email.toLowerCase() ? "" : `<button class="cloud-secondary" data-admin-email="${esc(m.email)}" data-admin-enable="${!m.active}">${m.active ? s("停用", "Disable") : s("启用", "Enable")}</button>`}</article>`).join("")}</div><form id="add-admin-form"><h3>${s("增加一位管理员", "Add an administrator")}</h3><label>${s("姓名", "Name")}<input name="displayName" required maxlength="120" autocomplete="name"></label><label>${s("Google 邮箱", "Google account email")}<input name="email" type="email" required maxlength="254" autocomplete="email" autocapitalize="none" spellcheck="false"></label><p>${s("填写对方现有的 Google 邮箱。加入后，对方可用该账号登录，不需要另设密码。", "Use their existing Google account email. They can then sign in with Google; no separate password is created.")}</p><button class="cloud-primary" type="submit">${icon("plus")}${s("加入管理员名单", "Add to the administrator list")}</button></form>${hasLegacy ? `<section class="cloud-legacy"><h3>${s("迁移本机旧记录", "Migrate earlier device records")}</h3><p>${s("旧记录不会自动上传。确认后可导入云端；现有云端修改记录会保留。", "Earlier device records are not uploaded automatically. You can review and import them. Existing cloud history is retained.")}</p><button class="cloud-secondary" data-action="cloud-legacy-export">${s("先导出旧记录备份", "Back up device records first")}</button><button class="cloud-secondary" data-action="cloud-migrate">${s("查看并确认导入", "Review and import")}</button></section>` : ""}${session.admin.role === "owner" ? invitationManager(invites, h) : ""}<p id="account-error" class="cloud-alert" role="alert"></p><button class="cloud-secondary" data-action="cloud-refresh">${s("刷新云端数据", "Refresh cloud records")}</button><button class="cloud-secondary" data-action="cloud-logout">${s("退出 Google 账号", "Sign out of Google")}</button></div>`;
}

function invitationManager(invites, h) {
  const { s, esc, icon } = h;
  return `<section class="cloud-invitations"><h3>${s("Patrick 的专属入口", "Patrick’s personal access")}</h3><p>${s("生成链接后，只发给 Patrick。他点击即可进入，不用账号密码。链接须在 6 天内首次启用，之后这台手机会记住访问。", "Send the generated link only to Patrick. He can enter without an account or password. Activate within six days; this browser then remembers his access.")}</p>
  ${invites === null ? `<p class="cloud-alert">${s("请先运行 Patrick 后端更新命令，开通后即可生成链接。", "Run the Patrick backend update first to enable invitations.")}</p>` : `<button class="cloud-primary" data-action="cloud-create-link">${icon("handover")}${s("生成 Patrick 邀请链接", "Create Patrick’s invitation")}</button>`}
  <div id="patrick-link-result" hidden><label>${s("只发给 Patrick 的链接", "Link for Patrick only")}<input id="patrick-link-output" readonly spellcheck="false" autocomplete="off"></label><button class="cloud-primary" data-action="cloud-copy-link">${s("复制邀请链接", "Copy invitation link")}</button><p>${s("首次启用后不能在另一台设备重复使用。换手机时，可再生成一条新链接。", "An activated link cannot be reused on another device. Create a new invitation when changing phones.")}</p></div>
  <div class="cloud-member-list">${(invites || []).map((link, i) => `<article><div><strong>${esc(link.displayName)} · ${s("入口 ", "Access ")}${i + 1}</strong><span>${!link.active ? s("已撤销", "Revoked") : link.claimed ? s("已启用 · 手机已绑定", "Activated · browser linked") : link.expired ? s("未启用 · 邀请已过期", "Unused · invitation expired") : s("等待 Patrick 首次进入", "Waiting for Patrick’s first visit")}</span></div>${link.active ? `<button class="cloud-secondary" data-action="cloud-revoke-link" data-invite-id="${esc(link.id)}">${s("撤销访问", "Revoke access")}</button>` : ""}</article>`).join("")}</div></section>`;
}
export function guestDialog(session, h) {
  const { s, esc, icon } = h;
  return `<div class="dialog-head"><h2 id="account-title">${esc(session.admin.displayName)} · ${s("我的访问", "My access")}</h2><button class="cloud-secondary" data-close="account-dialog">${icon("close")}${s("关闭", "Close")}</button></div><div class="form-body cloud-admin-body"><p>${s("这台手机已记住你的访问。你可以查看和修改家族计划，保存的内容会与家人同步。", "This browser remembers your access. You can view and update the family plan; saved changes are shared with your family.")}</p><p>${s("清除浏览器数据、退出或更换手机后，请让 luoxi 发送新的专属链接。", "After clearing browser data, signing out or changing devices, ask luoxi for a new invitation.")}</p><button class="cloud-secondary" data-action="cloud-refresh">${s("刷新家族记录", "Refresh family records")}</button><button class="cloud-secondary" data-action="cloud-logout">${s("退出本机（再次进入需新邀请）", "Sign out (a new invitation will be needed)")}</button></div>`;
}
