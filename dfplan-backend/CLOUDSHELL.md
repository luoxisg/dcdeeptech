# 免费部署 DFplan 后端

本流程使用你自己的 Google Cloud Shell，部署到现有免费 Spark 项目 `deepfamily-dfplan`。会发布私密访问规则，初始化 luoxi 管理员、10 项基础行动及初始化记录。

## 1. 打开终端

确认右上角 Google 账号是预先约定的管理员账号。打开页面底部的 **Terminal / 终端**。

如出现 **Authorize Cloud Shell / 授权 Cloud Shell**，在 Google 页面完成授权。无需把密码、令牌或授权码发到聊天。

## 2. 运行一条命令

仓库会通过链接自动打开。将以下命令复制到终端；`--owner-email` 填写已确认的初始管理员 Google 邮箱：

```bash
bash dfplan-backend/scripts/deploy-cloudshell.sh --project deepfamily-dfplan --owner-email YOUR_GOOGLE_EMAIL --display-name luoxi
```

脚本会核对当前 Google 账号、Firebase 项目和新加坡数据库。首次运行需要安装依赖，可能等待几分钟。

Cloud Shell 的临时授权可能不会出现在 `gcloud auth list` 中；脚本会直接通过 Google 核对部署凭据对应的已验证邮箱。如果提示无法核对账号，请在终端运行 `gcloud auth login`，使用管理员账号完成 Google 授权，再运行部署命令。

脚本会将 `deepfamily-dfplan` 明确设为 Google API 的配额归属项目。这只是请求使用哪个项目的配额，不会开通计费或升级 Spark 方案，也不需要另外配置 Application Default Credentials。

它会：

1. 以指定初始管理员邮箱生成权限规则，调用 Google 官方 API 编译及发布，并核对发布结果。
2. 以事务创建受保护的初始管理员、家族项目、10 项基础行动和初始化记录。
3. 再次读取后台确认管理员和任务已存在。

重复运行会保留已有资料；发现不同的初始管理员、停用记录或孤立资料时会停止。

## 3. 确认完成

看到以下状态表示后台已创建并验证：

```text
"status": "DFPLAN_BACKEND_READY"
```

回到聊天回复 **后端已部署**，再接入网站的云端开关。

网页仍使用 <https://dcdeeptech.com/dfplan/>。Google 登录后，由管理员维护共享资料；Patrick 后续可从管理员界面添加。

## 开通 Patrick 无账号密码访问

保留现有计划，运行：

```bash
git pull --ff-only origin main
bash dfplan-backend/scripts/deploy-cloudshell.sh --project deepfamily-dfplan --owner-email YOUR_GOOGLE_EMAIL --display-name luoxi --enable-patrick
```

完成后终端显示 `PATRICK_LINK_READY` 和专属链接。把链接只发给 Patrick，无需发到聊天。Patrick 打开链接，点击“进入家族计划”，同一浏览器以后自动进入。换手机或清除浏览器数据后需新邀请。luoxi 可以在网页“管理员 → Patrick 的专属入口”生成新链接或撤销访问。继续使用免费 Spark，无需绑卡。

## 同步手工表格中的具体人名

使用 `--assignees-json` 参数传入私密的“任务编号 → 具体人名”映射；不要把真实名单提交到公开仓库。该模式更新规则后，仅合并指定任务的人名，保留线上进度与历史；出现 `DFPLAN_ASSIGNEES_UPDATED` 表示完成。姓名留空的任务在网页显示“待确认”。
