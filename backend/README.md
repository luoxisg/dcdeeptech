# 本地访谈语音网关

默认网页入口为一级菜单「访谈测试版」，Mock 是三轮虚构离线示范，不启用麦克风或访问 Firebase。Live WS 需要单独运行本目录服务。后端、录音转写和密钥不会进入 Pages 发布清单。

在仓库根目录打开 PowerShell：

```powershell
# 首次创建独立虚拟环境并安装依赖；隐藏输入 API key，不写入文件
powershell -ExecutionPolicy Bypass -File .\backend\start-local.ps1 -Install -Provider OpenAI
# 或将 Provider 换为 DeepSeek；再次运行可以省去 -Install
```

另开终端启动网页（8086 已被本项目预览占用时，直接使用现有服务）：

```powershell
python -B scripts/dfplan/serve-demo.py --port 8086
```

打开 `http://localhost:8086/dfplan/?demo=1` → 访谈测试版 → 设置 → Live WS，地址 `ws://localhost:8765/ws/voice`。先测试连接，再开始对话并授权麦克风。连接测试只验证 WS 握手，不代表 ASR/LLM/TTS 完整可用。健康检查 `http://localhost:8765/health`。

首次后端启动会自动下载 Whisper small 模型。可通过 `WHISPER_MODEL_SIZE`、`WHISPER_DEVICE`、`WHISPER_COMPUTE_TYPE` 调整。原始 PCM 不落盘，识别在本机运行；LLM 接收转写文字，可能产生供应商费用，edge-tts 将助手回复发送到微软语音服务，需要联网。不能把整个 Live 模式视为离线或完全免费。服务默认仅监听 127.0.0.1，Origin 仅允许本机 8086/8080；不要暴露到公网。修改端口须同步 `VOICE_ALLOWED_ORIGINS`（逗号分隔的完整 Origin），禁止通配。

会话每轮及结束时异步写入 `backend/data/sessions/<uuid>/transcript.json`、`draft.md`；这些含私密资料，已忽略 Git，也被发布审计拒绝。网页编辑初稿后需点击保存或导出，网页修改不会回写后端原始档案。浏览器保存键 `dfplan.voice.sessions`，设置键 `dfplan.voice.config`。最多保留最近20份浏览器初稿，需长期保存时导出。

协议文本为平铺 JSON `{type,...fields}`：上行 `session.start {lang,vadSilenceMs}`、`input.commit`、`output.interrupt`、`session.finalize`；下行 `state.change {state}`、`transcript.delta {role,text}`（每次为完整一条发言）、`entity.extracted {kind,value}`、`draft.ready {title,markdown}`，以及安全错误 `error {message}` 和非致命 `notice {message}`。上行二进制为16kHz单声道小端 Int16 PCM，每轮最长180秒。

MP3 流增加 `audio.start` / `audio.end` 边界：两者之间的下行二进制属于同一段 MP3，客户端组装完整段后排队解码，避免把任意网络分片当成独立 MP3。后端 LISTENING 事件可能先于本机播放完成；前端延迟恢复采集直到播放结束。轻触光球即时停止本机播放并取消服务端任务，ASR 原生线程不能强制终止，但旧结果会丢弃。暂停/静音会清空本轮未提交音频。

验证：

```powershell
node --test tests/voiceSession.test.mjs
python -m py_compile backend/server.py
python -m unittest discover -s backend/tests -v
```

Python 协议测试使用注入的虚构引擎，不下载模型、不调用收费接口；需 `fastapi`、`httpx`、`numpy`。真实麦克风、Whisper 模型与供应商接口仍需在上述 Live 流程中单独验收。
