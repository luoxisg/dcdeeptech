# DFplan · Google 管理员与 Firebase 后端

当前前端 `dfplan/backend-config.js` 已设为 `enabled: true`，配置项目为 `deepfamily-dfplan`、共享计划为 `wu-family`。部署脚本核对新加坡 `asia-southeast1` 原生数据库，发布后读回规则，并在提供私密名单时读回人员、分工、任务关联及指定邀请权限。成功以 `DFPLAN_DIRECTORY_VERIFIED` 和核验数量为准；前端开关不代表后端部署完成，域名授权和网页实际登录读写仍需独立验证。本流程不升级计费或启用付费产品。

## 人员管理与仪表盘

本次家族负责人审查字段升级可用独立入口部署，仅更新规则，不执行初始化、人员同步、管理员变更、邀请签发或认证配置变更：

```sh
node dfplan-backend/scripts/deploy-rules-only.mjs
```

本机先通过 Firebase CLI 登录原 owner；已授权 Cloud Shell 会沿用 gcloud 身份。部署前核对现有受保护 owner 和线上规则基线；部署前后读取管理员、邀请、设备授权、项目、任务、人员和历史，比较逐组内容摘要。仅在完整一致时返回 `DFPLAN_RULES_ONLY_VERIFIED`，不输出姓名、邮箱、邀请ID或令牌。若同时有人编辑而摘要变化，会明确报告无法断言数据完全一致，不覆盖这些编辑。规则升级完成后再发布网页。新规则亦拒绝旧页面静默删除已经填写的新增字段，允许新版显式清空。

网站新增独立的 **人员管理 / People** 与 **仪表盘 / Dashboard** 页面。三星手机首页有两个大按钮，底部“看全局”进入仪表盘；电脑端使用侧栏入口。

- 已启用的 Google `owner` / `admin` 和获授人员管理权限的 Patrick 可以增加、移出和恢复人员，网页控件、客户端和 Firestore 规则同时限制。普通邀请成员只能查看人员名单。Patrick 仍通过专属链接及匿名设备身份访问，不需账号密码。
- Patrick 的人员管理权限取决于受保护邀请记录中的 `canManagePeople: true`，并同时校验邀请有效、设备已绑定、成员启用及项目匹配。显示姓名不会授予权限；缺少此标志的旧邀请默认只读。此能力不允许维护登录账号、管理员名单、签发或撤销邀请。
- 移出人员使用 `active: false`，保留人员记录、既有任务与历史。旧任务可继续保留移出人员；新的负责人选择必须引用有效人员。恢复后可再次分配任务。
- 人员记录位于 `dfplanProjects/wu-family/people/{id}`。姓名按 NFKC、空白和大小写归一后取 SHA-256，作为稳定编号，避免同名重复；姓名和分工说明保持私密。名单记录不提供登录权限。
- 任务保留 `assignee` 显示名，并可记录 `assigneeId` 关联人员。新分配必须同时匹配有效人员编号与姓名；既有文本人名向后兼容。姓名及人员编号在 JSON 备份中保留，CSV 导出显示人名。
- 仪表盘读取已有任务和人员，显示已验收完成率、尚未完成、逾期、待家族确认、受阻、未指定人员、状态分布、阶段进度及人员工作量。按人员、阶段筛选；点击统计卡片、状态、阶段或人员，可进入严格对应的任务子集并清除筛选。
- 逾期判断优先使用手动截止日，否则按启动日与结束周计算。没有可用截止日的任务单独提示，不计为逾期；当天到期的任务不算逾期。完成率仅计满足验收条件的任务。

在已有授权的 Google Cloud Shell 运行，部署规则并从**当前后端任务**中补充缺少的人员，不会重新启用曾移出的人员：

```sh
git pull --ff-only origin main
bash dfplan-backend/scripts/deploy-cloudshell.sh --project deepfamily-dfplan --owner-email YOUR_GOOGLE_EMAIL --display-name luoxi --sync-people
```

出现 `DFPLAN_PEOPLE_READY` 后刷新网页即可。已有规则尚未更新时，仪表盘仍可从现有任务生成统计；人员模块显示后台待开通并禁用写入。也可与 `--assignees-json` 一起运行，一次完成私密名单合并和人员初始化。仍使用 Spark 免费额度，不引入服务器、付费图表或新计费产品。

验证命令：

```sh
npm run test:modules --prefix dfplan-backend
npm run test:links --prefix dfplan-backend
npm run test:deploy --prefix dfplan-backend
npm test --prefix dfplan-backend
```

## 从手工表格更新具体人名

推荐使用仓库外的私密 UTF-8 JSON 文件（任务编号到姓名的映射），不把真实人名放入命令参数、网页源码、测试文件或公开 Git。将文件单独上传至自己的 Cloud Shell 私密目录，然后从已同步本次代码的仓库根目录运行：

```sh
bash dfplan-backend/scripts/deploy-cloudshell.sh --project deepfamily-dfplan --owner-email YOUR_GOOGLE_EMAIL --display-name luoxi --assignees-file "$HOME/private/dfplan-assignees.json"
```

`--assignees-file` 与 `--assignees-json` 二选一。合并会在同一事务中建立去重人员及任务的 `assignee` / `assigneeId` 关联，仅更新人员字段与提交元数据；保留任务原有进度、日期、凭据和旧历史，并追加一条合并记录。空姓名保持待确认，不建立占位人员。姓名显示原文与大小写不变，标准化只用于去重编号。重复运行不会重复建人或产生相同任务更新，也不会重新启用已移出的人员。

需要同时初始化分工时，附加 `--people-file "$HOME/private/dfplan-people.json"`。文件是 `displayName`、`responsibility` 对象组成的 JSON 数组（仅私密保存）；重复运行会同步这两项人员资料，保留人员的启用/移出状态。明确名单必须包含所有非空任务人名，格式或引用错误不会进入人员合并事务。

带 `--people-file` 的部署会在写入后从 Firestore 重新读取人员、分工、任务关联及指定邀请权限；首次空目录还会核对人数等于输入名单人数。只有读回匹配才打印 `DFPLAN_DIRECTORY_VERIFIED` 和人数/任务数统计，不打印真实名单。这个标志只证明后端读回通过；网页中实际登录、名单显示和按钮权限仍须另行检查。读取报错会使部署命令失败，不能据此报告空名单或初始化成功。网页同样区分读取中、读取失败和成功读取的空名单，读取失败不显示空名单提示、人数或写入表单。

为**现有** Patrick 链接开通人员权限时，另准备仓库外的 `patrick-invite-id.txt`，只写入 owner 明确选定的邀请 ID（原链接 `#invite=` 后的值），不写完整链接。将以下参数附加到同一部署命令即可；也可单独运行部署命令并带此参数：

```sh
--people-invite-file "$HOME/private/patrick-invite-id.txt"
```

该操作核验受保护的启用 owner 及指定项目的有效 editor 邀请，不按显示姓名查找或批量授权，不改变设备绑定或重发链接；可重复运行。新生成的 Patrick 专属链接默认包含人员管理能力。读取文件和校验格式会在任何部署写入前完成。上述命令会部署线上规则并合并私密数据，应在本地检查完成后由 owner 自行执行；本次本地测试不代表线上已经更新。

任务新增可选字段 `assignee`（最多 120 字符），与 `owner` / `ownerEn` 的负责人描述分开。手机卡片、任务编辑、电脑列表、搜索筛选、JSON 备份及 CSV 导出均支持该字段；任务编辑通过人员名单选择具体人名；人名在中英文界面使用相同原文。旧记录和旧备份没有此字段时显示待确认，不改变原有任务状态。

实际人名仅保存在私密 Firestore 文档中。不要将填写过的表格或人名清单提交到公开仓库。

在已有 Google 授权的 Cloud Shell 中，先拉取最新代码，然后执行（下方只是虚构示例）：

```sh
git pull --ff-only origin main
bash dfplan-backend/scripts/deploy-cloudshell.sh --project deepfamily-dfplan --owner-email YOUR_GOOGLE_EMAIL --display-name luoxi --assignees-json '{"WU-01":"Alex Example","WU-05":""}'
```

此命令先发布兼容新字段的规则，再以事务按任务编号合并人名及人员编号，并建立缺少的人员记录。保留当前任务说明、负责人描述、状态、日期、下一步、凭据、启动日期及既有历史；更改统一增加一个版本和一条修改记录。相同名单重复运行不再产生修改；遇到缺失任务或初始管理员停用会整批停止。新规则还会拒绝旧页面静默丢弃已导入的人名；有意清空需由新版显式提交空字符串。仅在带 `--enable-patrick` 时才会另外创建 Patrick 邀请。

终端出现 `DFPLAN_ASSIGNEES_UPDATED` 后，刷新网页即可查看。若同时带其他选项，应同时检查相应完成标记。

## Patrick 无账号密码入口

Patrick 使用一次性专属邀请进入，后台以 Firebase Anonymous Authentication 为手机浏览器建立身份；无需提供邮箱或密码。被邀请者可读取和编辑固定的 `wu-family` 计划，修改记录显示 Patrick。管理员和邀请名单由 Google 管理员维护；仅受保护的初始管理员可以签发、查看和撤销邀请。

已登录的 Google Cloud Shell 在仓库根目录运行：

```sh
git pull --ff-only origin main
bash dfplan-backend/scripts/deploy-cloudshell.sh --project deepfamily-dfplan --owner-email YOUR_GOOGLE_EMAIL --display-name luoxi --enable-patrick
```

此命令保留现有资料及 Google 登录，仅在配置中开启匿名认证、更新 Firestore 规则，并生成 Patrick 的第一条专属链接。看到 `PATRICK_LINK_READY` 后，把其下方的完整链接私下发给 Patrick，链接无需发到聊天。后续在 **管理员 → Patrick 的专属入口** 中生成新链接或撤销已有访问。

- 256 位随机邀请仅放在 URL 片段中，不进入请求查询参数；页面读取后会从地址栏移除，仅暂存内存。
- 须在 6 天内首次点击“进入家族计划”，以事务同时绑定匿名用户与邀请。已使用、过期或撤销的邀请不能被其他设备重用。
- 首次启用后，同一浏览器使用 Firebase 持久化登录；启用期限不会使已绑定设备自动退出。
- 换手机、清除浏览器数据或主动退出后，需要新的邀请。每台设备单独一条邀请。
- 撤销邀请立即使对应身份无法读取或修改后台资料，网页监听撤销状态并清除私密界面。曾查看或导出的资料无法远程收回。
- 后端验证 Patrick 的实际身份为受邀请的匿名设备；持有未使用邀请的人可领取访问，因此仅私下发给 Patrick。
- 不使用短信、Cloud Functions 或付费身份服务，继续使用 Spark 免费额度。

验证：`npm run test:links --prefix dfplan-backend` 检查真实网页客户端的邀请启用、再次打开、保存及撤销流程（模拟 SDK 网络边界）；`npm test --prefix dfplan-backend` 使用官方 Firestore 模拟器验证权限与重用、越权、过期、撤销等情况。

## 免费部署入口（推荐）

[在 Google Cloud Shell 打开部署教程](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https%3A%2F%2Fgithub.com%2Fluoxisg%2Fdcdeeptech.git&cloudshell_git_branch=main&cloudshell_tutorial=dfplan-backend%2FCLOUDSHELL.md&cloudshell_print=dfplan-backend%2FCLOUDSHELL-START.txt&project=deepfamily-dfplan)

在自己的 Google 页面授权 Cloud Shell，在仓库根目录运行一条命令：

```sh
bash dfplan-backend/scripts/deploy-cloudshell.sh --project deepfamily-dfplan --owner-email YOUR_GOOGLE_EMAIL --display-name luoxi
```

此流程使用现有 Spark 项目，不绑定账单、不启用付费产品，也不依赖远程浏览器工具。脚本只安装生产依赖，通过 Google Cloud Shell 的原生 Google 授权调用 Rules API 和 Firestore；不会保存或打印访问令牌，不要求在聊天中发送授权码。

脚本会编译、发布并读取核对规则；事务初始化管理员、任务和历史；保留已有记录。看到 `DFPLAN_BACKEND_READY` 后，才将前端 `enabled` 改为 `true`。Cloud Shell 和 Spark 均受各自免费配额限制。

本地检查部署逻辑：

```sh
node --test dfplan-backend/tests/cloud-deploy.test.mjs
```

## 提供的功能

- 使用现有 Google 账号登录，无需为本网站另设密码。
- 初始管理员由一次性初始化脚本设为 `owner`，其记录不能通过网页停用或改写。
- 已启用的管理员可以增加其他管理员、启用或停用普通管理员。Patrick 可使用专属邀请入口；如以后改用 Google 管理员登录，填写其 Google 邮箱即可。
- 一个共享家族计划保存在 Cloud Firestore，手机及电脑读取同一份数据。
- 任务、启动日期和只追加的修改记录存放在后端；修改使用事务和版本号，避免覆盖并发修改。
- 完成条件由后端规则校验：交付凭据、实际完成日及家族验收必须齐全。
- 开启云端后，项目数据不再写入 localStorage，Firestore 使用内存缓存；大字和语言等设备偏好仍留在本机。Firebase 登录凭据由其 SDK 管理。

## 1. 建立专用 Firebase 项目

用初始管理员的 Google 账号打开 <https://console.firebase.google.com/>，建立一个专用于 DFplan 的项目。此实现使用 Authentication 与 Firestore，不依赖 Cloud Functions。

1. **Authentication → Sign-in method**：启用 Google，选择支持邮箱。
2. **Authentication → Settings → Authorized domains**：加入 `dcdeeptech.com`。若要本机测试，也加入 `localhost`。
3. **Firestore Database**：创建默认数据库，选择适合的区域，例如 Singapore / `asia-southeast1`。从受保护的生产规则开始，随后部署本目录的规则。
4. **Project settings → Your apps**：注册 Web 应用，复制 `firebaseConfig`。

Web 配置是公开的项目标识；访问权限由登录身份与 Firestore 规则控制。**服务账号私钥不属于 Web 配置，不放入网页、GitHub 或聊天。**

## 2. 安装及测试

在仓库根目录执行，需 Node.js 22 或更新版本；模拟器需 Java 21：

```sh
npm ci --prefix dfplan-backend
npm test --prefix dfplan-backend
```

测试仅连接 `demo-dfplan` 本机模拟器。涵盖匿名访问、Google 身份及邮箱验证、管理员新增/停用、受保护的初始管理员、验收条件、日期与数据格式、版本冲突，以及不可改写的修改记录。

## 3. 部署权限规则

用有该项目权限的账号在你自己的电脑完成 Firebase CLI 登录，然后部署规则：

```sh
cd dfplan-backend
npx firebase login
npx firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

规则默认拒绝其他集合访问。规则模板中的 `__DFPLAN_INITIAL_OWNER_EMAIL__` 需在部署前替换为预先确认的初始管理员邮箱。只有这个已验证的 Google 账号可首次领取 `owner`，其他账号不能自行授权。初始管理员记录创建后，网页不能停用或改写它。生产规则中的该邮箱由部署时设置，不需要放在公开网页配置中。

## 4. 初始化 luoxi 与家族项目

推荐流程：部署已设置初始管理员邮箱的权限规则后，在网站用该 Google 账号登录。后端验证身份后，首次自动建立受保护的 `owner` 成员记录；点击 **建立家族计划**，以事务一次性创建 10 项基础行动和初始化记录。只有初始管理员可以执行，已有项目不能重置，普通管理员不能初始化。手机旧资料不会自动上传。

如需使用管理员 SDK 初始化，也可采用以下命令行方式：

初始化脚本使用 Google Application Default Credentials，需具备该项目 Firestore 的管理权限。在自己的电脑上通过 Google Cloud CLI 登录，无需把凭据交给网页：

```sh
gcloud auth application-default login
npm run bootstrap -- --project YOUR_FIREBASE_PROJECT_ID
```

按提示输入已确认的 **luoxi 的 Google 邮箱**、显示名 `luoxi`，最后输入 `INITIALIZE`。脚本会创建：

- `/dfplanAdmins/{规范化邮箱}`：受保护的初始管理员。
- `/dfplanProjects/wu-family`：共享项目和版本号。
- `/dfplanProjects/wu-family/tasks/{任务编号}`：10 项基础行动。

脚本不会覆盖已有项目数据；若已经存在其他初始管理员则停止。Google 首次领取或管理员 SDK 初始化成功后，后台才有真实管理员记录。

## 5. 配置网页并切换云端

编辑 `dfplan/backend-config.js`，填入控制台提供的四项 Web 配置，保留 `projectKey: 'wu-family'`：

```js
export const backendConfig = Object.freeze({
  enabled: true,
  projectKey: "wu-family",
  firebase: {
    apiKey: "COPY_FROM_FIREBASE",
    authDomain: "COPY_FROM_FIREBASE",
    projectId: "COPY_FROM_FIREBASE",
    appId: "COPY_FROM_FIREBASE",
  },
});
```

`authDomain` 使用 Firebase 提供的值；GitHub Pages 没有 Firebase Hosting 的认证代理，不能仅把这个字段改成网站域名。

将配置提交到 `main`，现有 Pages 流程会发布到 **https://dcdeeptech.com/dfplan/**。使用 luoxi 的 Google 账号登录，确认能读取计划、修改并保存；再在另一台设备登录确认同步。

之后点击 **管理员 → 增加一位管理员**，填入 Patrick 或其他人的姓名及 Google 邮箱。名单中不会保存密码，也不会自动发送邀请邮件。

## 本机旧记录迁移

云端启用后不会自动上传旧记录。登录后在 **管理员 → 迁移本机旧记录** 中，先导出旧记录备份，再查看并确认导入。

- 导入任务及启动日期；必须保留云端已有任务。
- 旧本机历史保留在导出的备份中，不作为可信的云端修改记录写入。
- 云端已有历史不被覆盖，导入本身会生成新的修改记录。
- 发生并发更新时，重新核对后再操作，不自动覆盖其他管理员的更改。

## 数据结构与运维

- `dfplanAdmins/{email}`：角色、启用状态、创建与修改信息；仅管理员可列出名单。
- `dfplanProjects/wu-family`：启动日期和全局版本。
- `.../tasks/{id}`：任务及最后修改人/时间。
- `.../history/{revision}`：操作人、服务器时间与修改说明；客户端不能修改或删除历史。

网页可导出完整项目 JSON 作为可携带备份。项目达到较多记录或管理员规模时，按 Firebase 实际配额与预算配置数据库备份及保留策略；本实现读取最多 5,000 条最近历史。

生产 Google 登录、首次初始化和云端保存须在完成部署后逐项验证；模拟器测试已通过 14 项权限与事务场景。
