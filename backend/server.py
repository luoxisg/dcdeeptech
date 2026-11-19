"""Local-only voice interview gateway. Run: python -m uvicorn backend.server:app --port 8765."""
import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import uuid

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(__file__).parent / "data" / "sessions"
ORIGINS = [item.strip() for item in os.getenv(
    "VOICE_ALLOWED_ORIGINS", "http://localhost:8086,http://127.0.0.1:8086,http://localhost:8080,http://127.0.0.1:8080"
).split(",") if item.strip()]
MAX_PCM_BYTES = 16000 * 2 * 180


class VoiceEngine:
    def __init__(self):
        from faster_whisper import WhisperModel
        from openai import AsyncOpenAI
        self.whisper = WhisperModel(os.getenv("WHISPER_MODEL_SIZE", "small"),
                                    device=os.getenv("WHISPER_DEVICE", "auto"),
                                    compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"))
        key = os.getenv("OPENAI_API_KEY")
        self.client = AsyncOpenAI(api_key=key, base_url=os.getenv("OPENAI_BASE_URL") or None) if key else None
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")
        # CTranslate2 model is a singleton; serialize inference while keeping the event loop free.
        self.asr_lock = asyncio.Lock()

    async def transcribe(self, pcm, lang):
        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0

        def infer():
            segments, _ = self.whisper.transcribe(samples, language=lang, vad_filter=True,
                initial_prompt="这是一段简体中文家族口述史访谈。保留原始姓名、日期与地点，不编造事实。" if lang == "zh" else "A family oral history interview. Preserve names, dates and places without inventing facts.")
            return "".join(segment.text for segment in segments).strip()

        # Shield prevents cancellation from releasing the singleton lock before its thread exits.
        async with self.asr_lock:
            task = asyncio.create_task(asyncio.to_thread(infer))
            try:
                return await asyncio.shield(task)
            except asyncio.CancelledError:
                await task
                raise

    async def complete(self, turns, lang, final=False):
        if self.client is None:
            raise RuntimeError("Configure OPENAI_API_KEY on the local backend first")
        prompt = ("You are a careful oral-history interviewer. Use only narrator statements, never treat your own questions as facts. "
                  "Do not infer missing names, dates or claims. Respond in English. " if lang == "en" else
                  "你是一名谨慎的家族口述史访谈员。仅把讲述者的话作为来源，不把助手问题当事实，不补写缺失事实，保留姓名原文，使用简体中文。")
        prompt += ("Return JSON {title,markdown}. Organize a chronological draft. Mark all uncertain/unverified claims with [待核实]. "
                   "Include a source/review note. Do not invent a timeline if dates are missing." if final else
                   "Return JSON {reply,entities:[{kind,value}]}. reply: empathic 30–60 Chinese characters (or 15–50 English words), "
                   "exactly one concrete follow-up question. entities: only explicitly mentioned time/person/place, preserve original spelling.")
        for attempt in range(2):
            result = await self.client.chat.completions.create(model=self.model,
                messages=[{"role": "system", "content": prompt}, *turns], response_format={"type": "json_object"},
                max_tokens=1800 if final else 400)
            value = json.loads(result.choices[0].message.content)
            if final:
                if not isinstance(value.get("title"), str) or not isinstance(value.get("markdown"), str):
                    raise RuntimeError("Invalid draft response")
                if "[待核实]" not in value["markdown"]:
                    value["markdown"] += "\n\n[待核实] 口述初稿，须由讲述者核实后归档。"
                return value
            reply = value.get("reply", "")
            size = len(reply) if lang == "zh" else len(reply.split())
            if isinstance(reply, str) and (30 <= size <= 60 if lang == "zh" else 15 <= size <= 50) and reply.count("?") + reply.count("？") == 1:
                return value
            prompt += " Your last reply did not satisfy length/question requirements. Follow them exactly."
        raise RuntimeError("The model did not return the required interview format")

    async def speech(self, text, lang):
        import edge_tts
        voice = os.getenv("TTS_VOICE") or ("zh-CN-XiaoxiaoNeural" if lang == "zh" else "en-US-JennyNeural")
        async for chunk in edge_tts.Communicate(text, voice, rate="-5%").stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    async def close(self):
        if self.client:
            await self.client.close()


class Connection:
    def __init__(self, socket, engine, directory):
        self.ws, self.engine, self.directory = socket, engine, directory
        self.id = str(uuid.uuid4())
        self.lang, self.state, self.started = "zh", "IDLE", False
        self.pcm, self.turns, self.entities, self.draft = bytearray(), [], [], None
        self.task, self.epoch = None, 0
        self.send_lock = asyncio.Lock()
        self.archive_lock = asyncio.Lock()

    async def event(self, event_type, **fields):
        async with self.send_lock:
            await self.ws.send_json({"type": event_type, **fields})

    async def state_change(self, value):
        self.state = value
        await self.event("state.change", state=value)

    async def archive(self):
        # Immutable snapshot before yielding; serialized writes cannot regress a later snapshot.
        async with self.archive_lock:
            data = json.dumps({"sessionId": self.id, "lang": self.lang, "turns": self.turns,
                "entities": self.entities, "draft": self.draft}, ensure_ascii=False, indent=2)
            markdown = self.draft["markdown"] if self.draft else "# 访谈记录 [待核实]\n\n" + "\n\n".join(
                f"**{turn['role']}**: {turn['content']}" for turn in self.turns)

            def write():
                folder = self.directory / self.id
                folder.mkdir(parents=True, exist_ok=True)
                for name, value in [("transcript.json", data), ("draft.md", markdown)]:
                    temporary = folder / (name + ".tmp")
                    temporary.write_text(value, encoding="utf-8")
                    temporary.replace(folder / name)

            await asyncio.to_thread(write)

    def cancel(self):
        self.epoch += 1
        self.pcm.clear()
        if self.task:
            self.task.cancel()
        self.task = None

    async def run_turn(self, pcm, epoch):
        try:
            text = await self.engine.transcribe(pcm, self.lang)
            if epoch != self.epoch:
                return
            if not text:
                await self.event("notice", message="未识别到语音 / No speech detected")
                await self.state_change("LISTENING")
                return
            self.turns.append({"role": "user", "content": text})
            await self.archive()
            await self.event("transcript.delta", role="user", text=text)
            result = await self.engine.complete(self.turns, self.lang)
            if epoch != self.epoch:
                return
            reply = result["reply"]
            self.turns.append({"role": "assistant", "content": reply})
            for entity in result.get("entities", []):
                if not isinstance(entity, dict):
                    continue
                kind, value = entity.get("kind"), entity.get("value")
                if kind in ("time", "person", "place") and isinstance(value, str) and value.strip():
                    entity = {"kind": kind, "value": value.strip()}
                    if entity not in self.entities:
                        self.entities.append(entity)
                        await self.event("entity.extracted", **entity)
            await self.archive()
            await self.event("transcript.delta", role="assistant", text=reply)
            await self.state_change("SPEAKING")
            await self.event("audio.start")
            async for data in self.engine.speech(reply, self.lang):
                if epoch != self.epoch:
                    return
                async with self.send_lock:
                    await self.ws.send_bytes(data)
            await self.event("audio.end")
            await self.state_change("LISTENING")
        except asyncio.CancelledError:
            raise
        except Exception:
            # Never reflect provider exceptions: they may contain credentials or private text.
            if epoch == self.epoch:
                await self.event("error", message="访谈服务失败，请检查本机模型配置；已识别文字保留在本机。 / Voice service failed; check local model configuration. Recognized text is archived locally.")

    async def finalize(self, epoch):
        try:
            if not self.turns:
                self.draft = {"title": "访谈初稿", "markdown": "# 访谈初稿\n\n[待核实] 尚无可整理的讲述内容。"}
            else:
                result = await self.engine.complete(self.turns, self.lang, final=True)
                if epoch != self.epoch:
                    return
                self.draft = result
            await self.archive()
            await self.event("draft.ready", **self.draft)
            await self.state_change("REVIEWING")
        except asyncio.CancelledError:
            raise
        except Exception:
            if epoch == self.epoch:
                await self.event("error", message="初稿生成失败，原始对话仍保留在本机。 / Draft failed; transcript remains archived locally.")

    async def serve(self):
        retired = set()
        try:
            while True:
                message = await self.ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                if message.get("bytes") is not None:
                    data = message["bytes"]
                    if self.started and self.state == "LISTENING":
                        if len(data) % 2 or len(self.pcm) + len(data) > MAX_PCM_BYTES:
                            await self.ws.close(code=1009)
                            break
                        self.pcm.extend(data)
                    continue
                raw = message.get("text", "")
                if len(raw) > 8192:
                    await self.ws.close(code=1009)
                    break
                try:
                    event = json.loads(raw)
                except (ValueError, TypeError):
                    await self.ws.close(code=1003)
                    break
                if not isinstance(event, dict):
                    await self.ws.close(code=1003)
                    break
                kind = event.get("type")
                if kind == "session.start" and not self.started:
                    self.started = True
                    self.lang = "en" if event.get("lang") == "en" else "zh"
                    await self.state_change("LISTENING")
                elif not self.started:
                    continue
                elif kind in ("output.interrupt", "session.finalize"):
                    if self.task and not self.task.done():
                        retired.add(self.task)
                        self.task.add_done_callback(retired.discard)
                    self.cancel()
                    if kind == "output.interrupt":
                        await self.state_change("LISTENING")
                    else:
                        # Remain non-listening while generating the draft so microphone frames are ignored.
                        await self.state_change("REVIEWING")
                        self.task = asyncio.create_task(self.finalize(self.epoch))
                elif kind == "input.commit" and self.state == "LISTENING":
                    if not self.pcm:
                        await self.event("notice", message="请先说一段话 / Please speak first")
                        continue
                    pcm = bytes(self.pcm)
                    self.pcm.clear()
                    await self.state_change("THINKING")
                    self.task = asyncio.create_task(self.run_turn(pcm, self.epoch))
        except WebSocketDisconnect:
            pass
        finally:
            active = self.task
            self.cancel()
            tasks = retired | ({active} if active else set())
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            if self.turns or self.draft:
                await self.archive()


def create_app(engine_factory=VoiceEngine, directory=DATA_DIR):
    @asynccontextmanager
    async def lifespan(application):
        application.state.engine = await asyncio.to_thread(engine_factory)
        try:
            yield
        finally:
            await application.state.engine.close()

    application = FastAPI(lifespan=lifespan)
    application.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET"], allow_headers=[])

    @application.get("/health")
    async def health():
        return {"status": "ok", "asr": "local-whisper", "llmConfigured": bool(os.getenv("OPENAI_API_KEY"))}

    @application.websocket("/ws/voice")
    async def voice(socket: WebSocket):
        if socket.headers.get("origin") not in ORIGINS:
            await socket.close(code=1008)
            return
        await socket.accept()
        await Connection(socket, application.state.engine, directory).serve()

    return application


app = create_app()
