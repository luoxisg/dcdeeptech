import { html } from "../html.mjs";
import { t, s } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
export function render() {
  return html`${pageTitle(t("security"), s("硬盘保存原件数字资产，PM 管理责任与检查。", "Drives hold original digital materials; PM tracks responsibilities and checks."))}
    <div class="card-grid">
      ${[
        [
          "硬盘加密",
          "Drive encryption",
          "使用 BitLocker To Go 或 VeraCrypt，密码与恢复密钥分别保管，不填写在 PM 网页。",
          "Use BitLocker To Go or VeraCrypt. Keep passwords and recovery keys separately, outside PM.",
        ],
        [
          "三份副本，一份异地",
          "Three copies, one off-site",
          "一份工作资料、两份独立备份；其中一份异地保存，备份结束后断开连接。",
          "Keep a working copy and two independent backups, including one off-site. Disconnect backup drives after use.",
        ],
        [
          "验证实际恢复",
          "Test actual recovery",
          "抽样恢复照片、录音和文档，记录日期、范围、结果和复核人。计划 JSON 不包含原始资料。",
          "Restore sample photos, audio and files, recording date, scope, results and reviewer. Plan JSON does not contain the original media.",
        ],
        [
          "授权与交接",
          "Permissions and handover",
          "分别确认家族分享、公开和 AI 使用；指定主备保管人，定期检查并记录接班安排。",
          "Confirm family-sharing, publication and AI uses separately; name primary and backup custodians and review handover plans.",
        ],
      ].map(
        ([zh, en, desc, descEn]) =>
          html`<article class="panel">
            <h2>${s(zh, en)}</h2>
            <p>${s(desc, descEn)}</p>
          </article>`,
      )}
    </div>
    <section class="panel">
      <h2>${s("受控登记字段", "Controlled register fields")}</h2>
      <p>
        ${s("资料批次编号、类型、相对目录；硬盘编号、保管人、存放区域、加密状态；备份日期、恢复验证、授权依据、风险和交接记录。不要记录密码、密钥或精确住址。", "Record batch/type/relative path, drive ID, custodian, storage area and encryption status, backup dates, recovery results, permission references, risks and handover. Exclude passwords, keys and exact home addresses.")}
      </p>
      <button class="btn btn-primary" data-cmd="editor" data-id="WU-03">
        ${s("打开数字资料保全任务", "Open the safeguarding action")}
      </button>
    </section>`;
}
