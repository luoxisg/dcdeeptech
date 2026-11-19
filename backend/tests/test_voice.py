import asyncio
import json
from pathlib import Path
import tempfile
import unittest

from fastapi.testclient import TestClient
from backend.server import create_app


class FakeEngine:
    async def transcribe(self, pcm, lang):
        return "一九八五年搬到南桥。"

    async def complete(self, turns, lang, final=False):
        if final:
            return {"title": "示范", "markdown": "# 示例\n\n1985年 [待核实]"}
        return {"reply": "这段回忆很珍贵。那时候搬家带了什么？", "entities": [{"kind": "time", "value": "一九八五年"}]}

    async def speech(self, text, lang):
        yield b"fake-mp3-part-1"
        yield b"fake-mp3-part-2"

    async def close(self):
        pass


class ProtocolTests(unittest.TestCase):
    def test_interrupt_discards_late_recognition(self):
        class LateEngine(FakeEngine):
            async def transcribe(self, pcm, lang):
                try:
                    await asyncio.sleep(30)
                except asyncio.CancelledError:
                    return "Obsolete recognition must be discarded"

        with tempfile.TemporaryDirectory() as folder, TestClient(create_app(LateEngine, Path(folder))) as client:
            with client.websocket_connect("/ws/voice", headers={"origin": "http://localhost:8086"}) as ws:
                ws.send_json({"type": "session.start"})
                ws.receive_json()
                ws.send_bytes(b"\x00\x00" * 100)
                ws.send_json({"type": "input.commit"})
                self.assertEqual(ws.receive_json()["state"], "THINKING")
                ws.send_json({"type": "output.interrupt"})
                self.assertEqual(ws.receive_json()["state"], "LISTENING")
                ws.send_json({"type": "session.finalize"})
                self.assertEqual(ws.receive_json()["state"], "REVIEWING")
                self.assertEqual(ws.receive_json()["type"], "draft.ready")
                self.assertEqual(ws.receive_json()["state"], "REVIEWING")
            archive = json.loads(next(Path(folder).glob("*/transcript.json")).read_text(encoding="utf-8"))
            self.assertEqual(archive["turns"], [])

    def test_turn_binary_boundary_finalize_archive(self):
        with tempfile.TemporaryDirectory() as folder, TestClient(create_app(FakeEngine, Path(folder))) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            with client.websocket_connect("/ws/voice", headers={"origin": "http://localhost:8086"}) as ws:
                ws.send_json({"type": "session.start", "lang": "zh", "vadSilenceMs": 3500})
                self.assertEqual(ws.receive_json()["state"], "LISTENING")
                ws.send_bytes(b"\x00\x00" * 16000)
                ws.send_json({"type": "input.commit"})
                self.assertEqual(ws.receive_json()["state"], "THINKING")
                self.assertEqual(ws.receive_json()["role"], "user")
                self.assertEqual(ws.receive_json()["kind"], "time")
                self.assertEqual(ws.receive_json()["role"], "assistant")
                self.assertEqual(ws.receive_json()["state"], "SPEAKING")
                self.assertEqual(ws.receive_json()["type"], "audio.start")
                self.assertEqual(ws.receive_bytes(), b"fake-mp3-part-1")
                self.assertEqual(ws.receive_bytes(), b"fake-mp3-part-2")
                self.assertEqual(ws.receive_json()["type"], "audio.end")
                self.assertEqual(ws.receive_json()["state"], "LISTENING")
                ws.send_json({"type": "session.finalize"})
                self.assertEqual(ws.receive_json()["state"], "REVIEWING")
                self.assertIn("[待核实]", ws.receive_json()["markdown"])
                self.assertEqual(ws.receive_json()["state"], "REVIEWING")
            files = list(Path(folder).glob("*/transcript.json"))
            self.assertEqual(len(files), 1)
            archive = json.loads(files[0].read_text(encoding="utf-8"))
            self.assertEqual(len(archive["turns"]), 2)
            self.assertTrue((files[0].parent / "draft.md").is_file())

    def test_origin_required_and_odd_pcm_rejected(self):
        with tempfile.TemporaryDirectory() as folder, TestClient(create_app(FakeEngine, Path(folder))) as client:
            from starlette.websockets import WebSocketDisconnect
            with self.assertRaises(WebSocketDisconnect):
                with client.websocket_connect("/ws/voice", headers={"origin": "https://evil.example"}):
                    pass
            with client.websocket_connect("/ws/voice", headers={"origin": "http://localhost:8086"}) as ws:
                ws.send_json({"type": "session.start"})
                ws.receive_json()
                ws.send_bytes(b"odd")
                with self.assertRaises(WebSocketDisconnect):
                    ws.receive_json()


if __name__ == "__main__":
    unittest.main()
