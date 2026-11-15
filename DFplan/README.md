# DeepFamily · 家族传承计划 / Family Legacy Plan

部署地址：**https://dcdeeptech.com/DFplan/**

纯静态中英文工作台，无需构建或安装依赖。宣纸暖白、墨绿、印章红与原创谱系树插画组成家族传承视觉风格。基础计划改编自原 Wu 家族项目的 10 项行动，负责人改为通用角色，初始状态均为「待核实」；不包含原站的私密云端记录。

## 使用

- 右上角 `中 / EN` 切换语言。界面和 10 项基础行动有完整中英文；自定义内容可在行动编辑器中补充另一语言，不会自动翻译。
- 使用总览、看板、清单、时间线和更新记录管理计划。看板支持拖动及状态菜单，手机可用菜单操作。
- 设置启动日后，按建议结束周计算截止日；手动截止日优先。
- 标记「已完成」须同时具备交付凭据、实际完成日及家族验收。
- `备份` 导出完整 JSON；上传按钮可恢复备份，也兼容原站导出的项目 JSON。导入会先展示替换确认。
- `导出清单` 生成当前语言的 UTF-8 CSV，包含全部任务。

**修改仅保存在当前浏览器的 localStorage。** 不会上传到 GitHub，不提供跨设备、多人或云端同步。清除浏览器数据会移除本机修改，请定期导出 JSON。此页面及模板源码公开；实际私密资料继续保留在原站或受控档案系统。左侧提供原私密云端工作台入口。

## 本地运行与验证

从仓库根目录运行：

```sh
python3 -m http.server 8080
# 打开 http://localhost:8080/DFplan/
node scripts/dfplan/check-model.mjs
```

依赖现代浏览器的 ES Modules、dialog、structuredClone 和 localStorage；无第三方网络字体、分析脚本或 CDN 依赖。节点检查使用 Node.js 22 或更新版本。

## 文件与部署

- `index.html`：入口与无障碍跳转。
- `app.js`：双语界面、编辑、筛选、看板、时间线及导入导出。
- `data.js`：基础行动的中英文内容。
- `model.mjs`：数据验证、截止日期与 CSV 转义。
- `styles.css`：响应式视觉、手机导航及打印样式。
- `assets/`：原创 SVG 印章与谱系树插画。

生产使用仓库现有的 GitHub Pages 发布流程。资源逐一列入 `scripts/pages/public-files.json`；README、测试和其他源目录不加入公开发布产物。提交到 `main` 后由现有 workflow 发布，保持现有域名及其他页面配置。

## English

A buildless, bilingual family legacy workspace with ten editable planning actions, overview, board, list, timeline, activity log, completion acceptance, JSON backup/restore and CSV export. English UI and seed content are included; custom text can be entered in both languages in the editor.

Edits are stored only in this browser. This static edition does not provide cloud synchronization or shared accounts. JSON exports from the original private workspace can be imported after a replacement confirmation. The original private workspace remains available through the sidebar link.
