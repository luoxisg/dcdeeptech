import { store } from "../../application/store.mjs";
import { html, disabled } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
export function render() {
  const state = store.getState(),
    session = state.session,
    busy = ["connecting", "checking", "reading"].includes(session.phase);
  return html`${pageTitle(session.invite ? s("Patrick，欢迎回家", "Welcome home, Patrick") : s("登录家族工作台", "Sign in to the family workspace"))}
    <section class="panel login-card">
      <p>
        ${busy ? t("loading") : s("资料仅向获授权的家族成员开放。", "Family records are available only to authorized members.")}
      </p>
      ${session.user?.email ? html`<p>${session.user.email}</p>` : ""}${session.invite ? html`<button class="btn btn-primary full" data-cmd="invite-enter" ${disabled(busy)}>${s("进入家族计划（无需账号密码）", "Enter the family plan without a password")}</button>` : ""}${session.phase === "not-initialized" && session.admin?.role === "owner" ? html`<button class="btn btn-primary full" data-cmd="initialize">${s("建立家族计划", "Initialize family plan")}</button>` : html`<button class="btn btn-primary full" data-cmd="login" ${disabled(busy)}>${t("login")}</button>`}${session.user ? html`<button class="btn full" data-cmd="logout">${t("logout")}</button>` : ""}<a
        class="btn full"
        href="?demo=1"
        >${s("免登录体验演示版", "Try the public demo without sign-in")}</a
      ><button class="btn full" data-cmd="refresh">
        ${s("重新连接", "Reconnect")}
      </button>
      <details>
        <summary>${s("遇到登录问题？", "Trouble signing in?")}</summary>
        <p>
          ${s("微信内请从右上角菜单改用 Samsung Internet、Chrome 或 Safari。核对获授权的 Google 邮箱；人员分工不等于访问授权。Patrick 请使用原专属链接并保管好链接。", "From WeChat, use its menu to open Samsung Internet, Chrome or Safari. Check your authorized Google email; a directory entry is not an access grant. Patrick should use and protect his original personal link.")}
        </p>
        <button class="btn" data-cmd="copy-login-url">
          ${s("复制普通登录网址", "Copy the general sign-in URL")}</button
        ><button class="btn" data-cmd="copy-access-request">
          ${s("复制权限申请消息", "Copy access request")}
        </button>
      </details>
    </section>`;
}
