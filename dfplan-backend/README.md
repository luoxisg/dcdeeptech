# DFplan · Google 管理员与 Firebase 后端

准备状态：代码与模拟器测试已完成，**尚未创建生产 Firebase 项目、启用 Google 登录或写入真实管理员记录**。网页配置默认 `enabled: false`，现有本机版继续工作。完成下面的设置后再启用。

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

规则默认拒绝其他集合访问。网页不能自行建立第一位管理员，也不能绕过后端给自己授权。

## 4. 初始化 luoxi 与家族项目

初始化脚本使用 Google Application Default Credentials，需具备该项目 Firestore 的管理权限。在自己的电脑上通过 Google Cloud CLI 登录，无需把凭据交给网页：

```sh
gcloud auth application-default login
npm run bootstrap -- --project YOUR_FIREBASE_PROJECT_ID
```

按提示输入已确认的 **luoxi 的 Google 邮箱**、显示名 `luoxi`，最后输入 `INITIALIZE`。脚本会创建：

- `/dfplanAdmins/{规范化邮箱}`：受保护的初始管理员。
- `/dfplanProjects/wu-family`：共享项目和版本号。
- `/dfplanProjects/wu-family/tasks/{任务编号}`：10 项基础行动。

脚本不会覆盖已有项目数据；若已经存在其他初始管理员则停止。只有成功执行这一步，真实后台才有管理员记录。

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

生产 Google 登录和跨设备同步尚未验证，须待项目配置完成后验证。模拟器验证不代表真实 Google 登录已启用。
