import { store } from "../../application/store.mjs";
import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { input } from "./shared.mjs";
export function render() {
  const state = store.getState(),
    admin = ["owner", "admin"].includes(state.session.admin?.role || ""),
    data = state.accountData;
  return html`<div class="sheet-form">
    <header class="sheet-heading">
      <div class="sheet-handle" data-sheet-handle aria-hidden="true"></div>
      <h2 id="sheet-title">${t("account")}</h2>
      <button class="btn" data-cmd="close">×</button>
    </header>
    <div class="sheet-body">
      ${
        state.mode === "demo"
          ? html`<p>
                ${s("演示版无需登录。Patrick 体验只管理本机示例人员，不获得管理员或正式报价权限。", "The demo needs no sign-in. Patrick preview manages local sample people, without administrator or live-pricing powers.")}
              </p>
              <a class="btn full" href="./"
                >${s("进入正式工作台", "Open the live workspace")}</a
              >`
          : html`<p>
                ${state.session.user?.email || state.session.admin?.displayName || s("未登录", "Signed out")}
              </p>
              ${state.ready ? html`<button class="btn full" data-cmd="refresh">${s("刷新共享记录", "Refresh shared records")}</button><button class="btn full" data-cmd="logout">${t("logout")}</button><button class="btn full" data-cmd="export-raw">${s("导出旧本机记录以便核对迁移", "Export earlier device records for migration review")}</button>` : html`<button class="btn full" data-cmd="login">${t("login")}</button>`}${
                admin
                  ? html`<section class="stack">
                      <h3>${s("管理员名单", "Administrators")}</h3>
                      ${
                        !data
                          ? html`<p>${t("loading")}</p>`
                          : data.members.map(
                              (member) =>
                                html`<article class="panel">
                                  <strong>${member.displayName}</strong>
                                  <p>${member.email}</p>
                                  <p>
                                    ${member.role} ·
                                    ${member.active ? s("已启用", "Active") : s("已停用", "Disabled")}
                                  </p>
                                  ${member.role !== "owner" && member.email !== state.session.user?.email?.toLowerCase() ? html`<button class="btn" data-cmd="admin-active" data-email="${member.email}" data-active="${!member.active}">${member.active ? s("停用", "Disable") : s("启用", "Enable")}</button>` : ""}
                                </article>`,
                            )
                      }
                      <form data-cmd="add-admin" class="stack">
                        <h3>${s("添加管理员", "Add administrator")}</h3>
                        ${input("displayName", s("姓名", "Name"))}${input("email", s("Google 邮箱", "Google email"), "", "email")}<button
                          class="btn btn-primary"
                          type="submit"
                        >
                          ${t("save")}
                        </button>
                      </form>
                    </section>`
                  : ""
              }${
                state.session.admin?.role === "owner"
                  ? html`<section class="stack">
                      <h3>
                        ${s("Patrick 专属邀请", "Patrick’s personal invitation")}
                      </h3>
                      <p>
                        ${s("链接只发给 Patrick，六天内首次启用；换设备需新邀请。", "Send only to Patrick, activate within six days; a new device needs a new invitation.")}
                      </p>
                      <button class="btn" data-cmd="create-invite">
                        ${s("生成专属链接", "Create personal link")}</button
                      >${data?.link ? html`<label>${s("仅发给本人", "For the intended person only")}<input readonly value="${data.link}" /></label><button class="btn" data-cmd="copy-invite">${s("复制专属链接", "Copy personal link")}</button>` : ""}${(
                        data?.invites || []
                      ).map(
                        (invite) =>
                          html`<article class="panel">
                            <strong>${invite.displayName}</strong>
                            <p>
                              ${invite.active ? s("可用", "Active") : s("已撤销", "Revoked")}
                              ·
                              ${invite.claimed ? s("已启用", "Claimed") : s("待启用", "Unclaimed")}
                            </p>
                            ${invite.active ? html`<button class="btn" data-cmd="revoke-invite" data-id="${invite.id}">${s("撤销", "Revoke")}</button>` : ""}
                          </article>`,
                      )}
                    </section>`
                  : ""
              }`
      }
    </div>
    <footer class="sheet-actions">
      <p class="sheet-error" role="alert"></p>
      <button class="btn btn-primary" data-cmd="close">${t("close")}</button>
    </footer>
  </div>`;
}
