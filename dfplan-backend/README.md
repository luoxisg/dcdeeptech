# DFplan · Google 管理员与 Firebase 后端

生产项目 `deepfamily-dfplan` 已创建，使用 Spark 方案、新加坡 `asia-southeast1` 默认数据库，Google 登录和 `dcdeeptech.com` 已授权。管理员已确认完成 Cloud Shell 后端部署；`backend-config.js` 已设为 `enabled: true`，网页使用 Google 登录和云端共享保存。

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
- 已启用的管理员可以增加其他管理员、启用或停用普通管理员。Patrick 暂不加入；以后填写其 Google 邮箱即可。
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
