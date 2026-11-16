# DeepFamily · 家族传承计划 / Family Legacy Plan

部署地址：**https://dcdeeptech.com/dfplan/**

纯静态中英文工作台，无需构建或安装依赖。宣纸暖白、墨绿、印章红与原创谱系树插画组成家族传承视觉风格。基础计划改编自原 Wu 家族项目的 10 项行动，负责人改为通用角色，初始状态均为「待核实」；不包含原站的私密云端记录。

## Google 账号与共享后端

当前 `backend-config.js` 为 `enabled: true`，前端配置连接 Firebase 项目 `deepfamily-dfplan` 的 `wu-family` 共享计划，使用 Google 登录或已授权的邀请身份访问。后端初始化成功须以部署脚本的实际读回结果 `DFPLAN_DIRECTORY_VERIFIED` 及人员、任务核验数量为准；前端开关不能代替后端核验。网页登录、名单显示和操作按钮需在发布后另行检查。

初始管理员须使用预先确认的 Google 邮箱登录。首次领取受保护角色后，点击「建立家族计划」初始化 10 项行动；随后可增加其他管理员。邀请入口是否可用取决于线上配置与授权记录。详见 [Firebase 启用说明](../dfplan-backend/README.md)。

## 使用

- 右上角 `中 / EN` 切换语言。界面和 10 项基础行动有完整中英文；自定义内容可在行动编辑器中补充另一语言，不会自动翻译。
- 电脑使用总览、看板、清单、时间线和更新记录；看板支持拖动及状态菜单。手机使用大图标首页与固定底部导航，点击卡片即可查看和记录，无需拖拽。
- 设置启动日后，按建议结束周计算截止日；手动截止日优先。
- 标记「已完成」须同时具备交付凭据、实际完成日及家族验收。
- `备份` 导出完整 JSON；上传按钮可恢复备份，也兼容原站导出的项目 JSON。导入会先展示替换确认。
- `导出清单` 生成当前语言的 UTF-8 CSV，包含全部任务。

**云端开启后，项目修改保存在 Firestore，不再写入本机 localStorage。** 原本机记录继续保留，管理员登录后可先备份，再确认导入云端；语言与大字偏好仍保存在设备上。若配置关闭云端，则回到本机模板模式。

## 三星手机与长者操作

- 窄屏（900 CSS px 以内）及 1200 CSS px 以内的粗指针触控屏，自动使用图形手机版；不依赖三星型号或浏览器识别。
- 正文默认 18px，可切换为 22px，偏好保存在本机；保留浏览器缩放。标题、图标和文字组合说明操作，状态同时提供图标与文字。
- 图形首页包含真实进度圆环、下一件任务，以及资料保护、照片家谱、长辈故事、家人审阅四个入口。
- 底部固定「首页、做任务、看进度、更多」，支持安全区；主要点击区域不小于 48px。
- 任务进展采用大尺寸单选卡片；交付验收与详细计划按需展开。选「已完成」会展开验收内容，仍执行原有完成条件。
- 任务单与进度页在手机上使用竖向图卡与三阶段路线，无需横向浏览表格。
- 已完成 DOM 交互、CSS 关键点击尺寸、双语、备份往返与桌面回归检查；未进行三星真机或浏览器布局实测。

## 本地运行与验证

从仓库根目录运行：

```sh
python3 -m http.server 8080
# 打开 http://localhost:8080/dfplan/
node scripts/dfplan/check-model.mjs
```

依赖现代浏览器的 ES Modules、dialog、structuredClone 和 localStorage；无第三方网络字体、分析脚本或 CDN 依赖。节点检查使用 Node.js 22 或更新版本。

## 文件与部署

- `index.html`：入口与无障碍跳转。
- `app.js`：双语界面、编辑、筛选、看板、时间线及导入导出。
- `data.js`：基础行动的中英文内容。
- `model.mjs`：数据验证、截止日期与 CSV 转义。
- `styles.css`：桌面响应式视觉及打印样式。
- `phone-ui.js`：图形手机版、任务分类与简化编辑界面。
- `phone.css`：长者大字、触控目标、底部导航与手机对话框。
- `backend-config.js`：公开 Web 配置与云端启用开关。
- `backend-client.js`：Google 登录、Firestore 事务及管理员接口。
- `cloud-ui.js` / `cloud.css`：登录、同步状态和管理员管理界面。
- `assets/`：原创 SVG 印章与谱系树插画。

生产使用仓库现有的 GitHub Pages 发布流程。资源逐一列入 `scripts/pages/public-files.json`；README、测试和其他源目录不加入公开发布产物。提交到 `main` 后由现有 workflow 发布，保持现有域名及其他页面配置。

## English

A buildless, bilingual family legacy workspace with ten editable planning actions, overview, board, list, timeline, activity log, completion acceptance, JSON backup/restore and CSV export. English UI and seed content are included; custom text can be entered in both languages in the editor.

With the Firebase backend enabled, verified Google administrators access a shared Firestore project. Only the pre-authorized initial owner can claim the protected role and initialize the ten-action plan once. Device-only legacy records are kept and can be imported after review; language and reading-size preferences remain local.

人员名单可由 Google 管理员和获授权的 Patrick 新增、移出与恢复。Patrick 的权限来自 owner 控制的邀请记录 `canManagePeople` 标志及有效设备绑定，不能通过显示姓名获得；普通邀请成员只能查看人员。人员管理不授予账号、管理员名单或邀请管理权限。真实初始人名仅通过仓库外的私密文件合并到后端，不写入网页或公开 Git；移出人员保留原任务和历史。

Git 源码仅保留小写 `dfplan/`。旧地址跳转模板位于 `scripts/pages/templates/dfplan-redirect.html`，Pages 发布脚本按 `generated_files` 清单生成 `/DFplan/index.html`，跳转到 `/dfplan/` 并保留查询参数与片段。模板本身不公开发布；两个地址同域，沿用已有的本机存储。

Windows 工作区不需要同时创建两个目录，也不要修改 `core.ignorecase`。生产发布产物必须同时包含大小写不同的两个 URL，因此应在大小写敏感的文件系统中生成（现有 Pages workflow 使用 Ubuntu 的 `RUNNER_TEMP`）；脚本会拒绝在大小写不敏感的目标目录中生成，避免覆盖正式应用。审计报告包含生成路径、模板来源及每个文件的哈希；`dfplan-backend/`、README、脚本和模板源码不在公开产物中。
