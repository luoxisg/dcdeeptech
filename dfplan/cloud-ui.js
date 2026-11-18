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
const googleMark = `<svg class="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;
export function cloudGate(session, available, message, h) {
  const { s, esc, icon, readingControl = "" } = h;
  const busy = ["connecting", "checking", "reading"].includes(session.phase),
    invited = !!session.invite,
    denied = session.phase === "denied",
    canInitialize =
      session.phase === "not-initialized" && session.admin?.role === "owner";
  const wechat = /micromessenger/i.test(globalThis.navigator?.userAgent || "");
  const helpButton = (type, zh, en) =>
    `<button type="button" class="gate-link" data-action="gate-${type}">${s(zh, en)}</button>`;
  return `<main id="main" class="cloud-gate"><header class="gate-header"><a class="gate-brand" href="/dfplan/" aria-label="DeepFamily"><span class="gate-seal">${icon("tree")}</span><span><strong>DeepFamily</strong><small>${s("家族共享与协作空间", "A shared family workspace")}</small></span></a><nav class="cloud-lang" aria-label="${s("显示与语言设置", "Display and language settings")}">${readingControl}<div role="group" aria-label="${s("语言切换", "Language")}"><button data-lang="zh" aria-pressed="${document.documentElement.lang !== "en"}">中文</button><button data-lang="en" aria-pressed="${document.documentElement.lang === "en"}">EN</button></div></nav></header>
  <div class="gate-center"><section class="gate-card" aria-labelledby="login-heading" aria-busy="${busy}"><div class="gate-shield">${icon(invited ? "people" : "shield")}</div>
  <h1 id="login-heading">${busy ? s("正在打开家族计划", "Opening the family plan") : invited ? s("Patrick，欢迎回家", "Welcome home, Patrick") : canInitialize ? s("建立家族传承计划", "Create the family legacy plan") : s("登录家族工作台", "Sign in to the family workspace")}</h1>
  <p class="gate-subtitle">${busy ? s("请稍候，正在验证权限并读取家族记录。", "Please wait while we verify access and load family records.") : invited ? s("点一下，一起整理家族记忆。无需填写账号或密码。", "One tap to preserve family memories. No account or password to enter.") : s("登录后，按授权查看和更新共享计划。", "Sign in to view and update the shared plan with your permissions.")}</p>
  <div class="gate-pills"><span>${icon("tree")}${s("家族计划", "Family plan")}</span><span>${icon("review")}${s("任务协作", "Shared actions")}</span><span>${icon("shield")}${s("授权访问", "Authorized access")}</span></div>
  ${session.user?.email ? `<p class="cloud-email">${esc(session.user.email)}</p>` : ""}
  ${denied ? `<div class="gate-denied" role="alert"><strong>${s("当前账号尚未获得家族访问权限", "This account is not authorized")}</strong><p>${s("请切换为已授权的 Google 账号，或复制申请消息发送给家族管理员。人员分工名单不等于登录授权名单。", "Use an authorized Google account or send an access request to the family administrator. The people directory does not grant sign-in access.")}</p>${helpButton("request", "复制权限申请消息", "Copy access request")}</div>` : ""}
  ${message ? `<p class="cloud-alert" role="alert">${esc(message)}</p>` : ""}
  ${wechat ? `<p class="gate-browser-note">${s("微信内可能无法完成 Google 登录。", "Google sign-in may not work inside WeChat.")}${helpButton("browser", "查看浏览器打开图解", "Open in a browser")}</p>` : ""}
  ${canInitialize ? `<button class="cloud-primary" data-action="cloud-initialize">${icon("leaf")}${s("建立家族计划", "Create the family plan")}</button>` : ""}
  ${!busy && !canInitialize && invited ? `<button class="cloud-primary patrick-enter" data-action="cloud-link-login" ${!available ? "disabled" : ""}>${icon("home")}${s("进入家族计划", "Enter the family plan")}</button><p class="cloud-small">${s("首次进入后，这台手机的浏览器会记住你。请保管好专属链接。", "This browser will remember your access. Keep your personal link private.")}</p>` : ""}
  ${!busy && !canInitialize ? `<p class="account-hint">${invited ? s("管理员也可使用 Google 账号登录", "Administrators can also sign in with Google") : s("请使用已获家族管理员授权的 Google 邮箱", "Use a Google email authorized by your family administrator")}</p><button class="${invited ? "cloud-secondary" : "cloud-primary"} gate-google" data-action="cloud-login" ${!available ? "disabled" : ""}>${googleMark}${s("使用 Google 账号登录", "Sign in with Google")}</button>` : ""}
  ${!busy ? `<a class="cloud-secondary gate-demo" href="${document.documentElement.lang === "en" ? "?demo=1&lang=en" : "?demo=1"}">${icon("play")}${s("免登录体验测试版", "Try the public test without signing in")}</a>` : ""}
  ${session.user && !busy ? `<button class="cloud-secondary" data-action="cloud-logout">${denied ? s("退出并重新选择账号", "Sign out to choose another account") : s("退出当前访问", "Sign out")}</button>` : ""}
  ${message && !busy ? `<button class="cloud-secondary" data-action="cloud-refresh">${s("重新连接", "Reconnect")}</button>` : ""}
  <div class="gate-help"><p class="cloud-small">${s("家族资料仅向已获授权的成员开放。", "Family records are available only to authorized members.")}</p><details><summary>${s("遇到登录问题或需要授权？", "Trouble signing in or need access?")}</summary><ol><li>${s("核对 Google 邮箱，请管理员确认访问授权；加入人员分工名单不会自动开通访问。", "Check your Google email and ask an administrator to authorize access. Joining the people directory does not grant access.")}</li><li>${s("如从微信群打开，请改用 Samsung Internet、Chrome 或 Safari。允许本站弹出登录窗口。", "From WeChat, open in Samsung Internet, Chrome or Safari. Allow this site to open the sign-in window.")}</li><li>${s("Patrick 请使用管理员发来的有效专属链接，勿转发给其他人。", "Patrick: use your valid personal invitation link and do not forward it.")}</li></ol><div class="gate-help-actions">${helpButton("request", "复制权限申请消息", "Copy access request")}${helpButton("browser", "查看浏览器打开图解", "Browser instructions")}</div></details></div>
  </section></div><footer class="gate-footer">${helpButton("privacy", "隐私与访问说明", "Privacy and access")}${helpButton("home", "添加到手机主屏幕", "Add to home screen")}<p>DeepFamily · ${s("珍藏过去，连接未来", "Preserve the past. Connect the future.")}</p></footer><dialog id="gate-info" aria-labelledby="gate-info-title"><div class="gate-info-body"></div><button class="cloud-primary" data-close="gate-info">${s("关闭", "Close")}</button></dialog></main>`;
}

export async function loginHelp(action, { s, esc, toast, session = {} }) {
  const dialog = document.getElementById("gate-info");
  if (!dialog) return;
  let title, body;
  if (action === "gate-request" || action === "gate-copy-url") {
    const email = session.phase === "denied" ? session.user?.email || "" : "";
    const text =
      action === "gate-copy-url"
        ? document.documentElement.lang === "en"
          ? "https://dcdeeptech.com/dfplan/?lang=en"
          : "https://dcdeeptech.com/dfplan/"
        : s(
            "【DeepFamily 权限申请】您好，请帮我为本人的 Google 邮箱开通家族工作台访问权限：https://dcdeeptech.com/dfplan/ 。我的 Google 邮箱是：",
            "[DeepFamily access request] Please authorize my Google email for https://dcdeeptech.com/dfplan/ . My Google email is: ",
          ) + email;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(text);
      toast(
        s(
          action === "gate-copy-url"
            ? "网址已复制，请在手机浏览器中粘贴打开。"
            : email
              ? "申请消息已复制，请发送给家族管理员。"
              : "申请消息已复制，请补充邮箱后发送给管理员。",
          action === "gate-copy-url"
            ? "Link copied. Paste it into your phone browser."
            : email
              ? "Request copied. Send it to your family administrator."
              : "Request copied. Add your email and send it to your administrator.",
        ),
      );
      return;
    } catch {
      title = s("请手动复制", "Copy manually");
      body = `<p>${s("浏览器未允许自动复制。长按或选中下方文字，复制后按提示使用。", "Automatic copying was unavailable. Select the text below, copy it and use it as indicated.")}</p><textarea readonly aria-label="${s("权限申请消息", "Access request")}">${esc(text)}</textarea>`;
    }
  } else if (action === "gate-privacy") {
    title = s("隐私与访问说明", "Privacy and access");
    body = `<p>${s("账号通过 Google 官方登录验证；工作台不收集或保存 Google 密码。Patrick 的邀请链接用于建立获授权的设备访问，请勿转发。", "Google handles account sign-in; this workspace does not collect or store your Google password. Patrick’s invitation establishes authorized browser access. Keep it private.")}</p><p>${s("家族记录的读取和修改受 Firebase 后端权限规则控制。访问授权与人员分工分别管理。", "Firebase backend rules control reading and updating family records. Access permissions and the people directory are managed separately.")}</p><p>${s("页面请求搜索引擎不收录，但 noindex 不是访问保护，也不保证链接不被发现。请勿在计划中保存密码或不必要的敏感资料。", "The page asks search engines not to index it. This is not access protection and does not guarantee links stay undiscovered. Keep passwords and unnecessary sensitive information out of the plan.")}</p>`;
  } else if (action === "gate-home") {
    title = s("添加到手机主屏幕", "Add to home screen");
    body = `<p>${s("三星手机 · Samsung Internet：点击右下角菜单 ☰，选择「将页面添加到」→「主屏幕」。不同版本名称可能略有不同。", "Samsung Internet: open the bottom-right menu ☰, then Add page to → Home screen. Wording may vary by version.")}</p><p>${s("Android · Chrome：点击右上角 ⋮，选择「添加到主屏幕」。", "Android Chrome: tap ⋮ at the top right and choose Add to home screen.")}</p><p>${s("iPhone · Safari：点击分享按钮 ↑，选择「添加到主屏幕」。这会保存网站快捷入口；访问仍需授权。", "iPhone Safari: tap Share ↑, then Add to Home Screen. This saves a website shortcut; access still requires authorization.")}</p>`;
  } else if (action === "gate-denied") {
    if (session.phase !== "denied" || !session.user?.email) return;
    title = s(
      "该 Google 账号尚未开通访问权限",
      "This Google account is not authorized yet",
    );
    body = `<p>${s("为保护家庭隐私，工作台仅向获授权的成员开放。当前登录邮箱：", "To protect family privacy, this workspace is open only to authorized members. Current account:")}</p><p class="gate-denied-email">${esc(session.user.email)}</p><p>${s("如已有其他授权账号，请切换账号；如需申请访问，复制含当前邮箱的申请消息，发送给家族管理员。", "Switch to another authorized account, or copy a request containing your current email and send it to your family administrator.")}</p><div class="gate-modal-actions"><button class="cloud-primary" data-action="gate-request">${s("复制权限申请消息", "Copy access request")}</button><button class="cloud-secondary" data-action="cloud-login">${s("切换其他 Google 账号", "Switch Google account")}</button></div>`;
  } else {
    const ios =
      action === "gate-browser-ios" ||
      (action !== "gate-browser-android" &&
        /iPad|iPhone|iPod/i.test(globalThis.navigator?.userAgent || ""));
    title = s("请在系统浏览器中打开", "Open in your system browser");
    body = `<p class="gate-menu-hint" aria-hidden="true">${s("右上角「···」 ↗", "Top-right ··· ↗")}</p><p>${s("微信内可能无法完成 Google 登录。请按以下步骤在浏览器中继续。", "Google sign-in may not work inside WeChat. Continue in your phone browser using these steps.")}</p><div class="gate-os-switch" role="group" aria-label="${s("手机系统", "Phone system")}"><button data-action="gate-browser-android" aria-pressed="${!ios}">Android / Samsung</button><button data-action="gate-browser-ios" aria-pressed="${ios}">iPhone / iPad</button></div><ol class="gate-browser-steps"><li><b>···</b><span>${s("点击微信右上角「···」菜单。", "Tap the ··· menu at the top right of WeChat.")}</span></li><li><b>↗</b><span>${ios ? s("选择「在浏览器中打开」，使用 Safari。", "Choose Open in browser and use Safari.") : s("选择「在浏览器中打开」，使用 Samsung Internet 或 Chrome。", "Choose Open in browser and use Samsung Internet or Chrome.")}${s("菜单名称因版本而异。", " Menu wording varies by version.")}</span></li></ol><p>${s("找不到菜单？复制登录网址，在手机浏览器中粘贴打开。", "Cannot find the menu? Copy the sign-in URL and paste it into your phone browser.")}</p><button class="cloud-secondary" data-action="gate-copy-url">${s("复制登录页网址", "Copy sign-in URL")}</button>${session.invite ? `<p class="cloud-small">${s("Patrick：普通登录网址不含专属邀请。请在系统浏览器中打开管理员发来的原专属链接。", "Patrick: the general URL does not contain your invitation. Open the original personal link from your administrator in your system browser.")}</p>` : ""}`;
  }
  if (!dialog.isConnected) return;
  dialog.querySelector(".gate-info-body").innerHTML =
    `<h2 id="gate-info-title">${title}</h2>${body}`;
  if (!dialog.open) dialog.showModal();
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

// Prompt once per session; authorization always comes from backend state.
let guidedBrowser = false;
let deniedIdentity = "";
export function syncLoginGuidance(session, h) {
  const identity =
    session.phase === "denied" ? session.user?.uid || session.user?.email : "";
  if (identity && session.user?.email && identity !== deniedIdentity) {
    deniedIdentity = identity;
    void loginHelp("gate-denied", { ...h, session });
  } else if (
    !guidedBrowser &&
    !session.invite &&
    session.phase === "signed-out" &&
    /MicroMessenger/i.test(globalThis.navigator?.userAgent || "")
  ) {
    guidedBrowser = true;
    void loginHelp("gate-browser", { ...h, session });
  }
  if (session.phase === "signed-out" || session.phase === "ready")
    deniedIdentity = "";
}
