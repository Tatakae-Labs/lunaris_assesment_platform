import asyncio
import time
import base64
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket

class LiveStreamHub:
    """
    High-performance real-time video streaming hub for CCTV proctoring.
    Supports:
    - Real-time MJPEG live stream over HTTP StreamingResponse
    - WebSocket low-latency video frame broadcasting (<100ms)
    - WebRTC P2P signaling relay (Offer/Answer/ICE)
    """

    def __init__(self):
        # attempt_id -> latest JPEG bytes
        self._latest_frames: Dict[str, bytes] = {}
        # attempt_id -> timestamp (float)
        self._last_frame_time: Dict[str, float] = {}
        # attempt_id -> timestamp of last database fallback check
        self._last_db_fallback_time: Dict[str, float] = {}
        # attempt_id -> Set[WebSocket] for proctors watching live
        self._proctor_subscribers: Dict[str, Set[WebSocket]] = {}
        # attempt_id -> WebSocket for candidate
        self._candidate_websockets: Dict[str, WebSocket] = {}
        # Standby placeholder frame
        self._standby_frame: bytes = self._generate_standby_frame()

    def _generate_standby_frame(self) -> bytes:
        try:
            import io
            from PIL import Image, ImageDraw
            img = Image.new("RGB", (1280, 720), color=(15, 23, 42))
            draw = ImageDraw.Draw(img)
            # Subtle gridlines
            for y in range(0, 720, 60):
                draw.line([(0, y), (1280, y)], fill=(30, 41, 59), width=1)
            for x in range(0, 1280, 80):
                draw.line([(x, 0), (x, 720)], fill=(30, 41, 59), width=1)
            # Center banner
            draw.rectangle([(340, 310), (940, 410)], fill=(2, 6, 23), outline=(56, 189, 248), width=2)
            draw.text((370, 335), "● LUNARIS CCTV SURVEILLANCE", fill=(34, 197, 94))
            draw.text((370, 365), "720p @ 30 FPS · Awaiting Candidate Live Feed...", fill=(148, 163, 184))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return buf.getvalue()
        except Exception:
            pass

        return base64.b64decode(
            "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        )

    def get_last_frame_time(self, attempt_id: str) -> float:
        return self._last_frame_time.get(attempt_id, 0.0)

    def update_frame(self, attempt_id: str, frame_bytes: bytes):
        """Store the latest live video frame and push to all subscribed proctor WebSockets."""
        self._latest_frames[attempt_id] = frame_bytes
        self._last_frame_time[attempt_id] = time.time()

        # Asynchronously dispatch to WebSocket subscribers if any
        subscribers = self._proctor_subscribers.get(attempt_id)
        if subscribers:
            asyncio.create_task(self._broadcast_frame(attempt_id, frame_bytes))

    async def _broadcast_frame(self, attempt_id: str, frame_bytes: bytes):
        subscribers = list(self._proctor_subscribers.get(attempt_id, []))
        if not subscribers:
            return

        dead_sockets = []
        for ws in subscribers:
            try:
                await ws.send_bytes(frame_bytes)
            except Exception:
                dead_sockets.append(ws)

        for ws in dead_sockets:
            self.remove_proctor_subscriber(attempt_id, ws)

    def get_latest_frame(self, attempt_id: str) -> Optional[bytes]:
        """Return latest frame if received within last 30 seconds, or fallback to database snapshot."""
        frame = self._latest_frames.get(attempt_id)
        if frame:
            age = time.time() - self._last_frame_time.get(attempt_id, 0)
            if age < 30.0:
                return frame

        # Throttle DB fallback: query at most once every 10 seconds per attempt to protect SQLite from lock storms
        now = time.time()
        last_check = self._last_db_fallback_time.get(attempt_id, 0.0)
        if (now - last_check) < 10.0:
            return self._latest_frames.get(attempt_id)
        self._last_db_fallback_time[attempt_id] = now

        # Fallback to database EvidenceAsset for this candidate attempt
        db = None
        try:
            from app.core.database import SessionLocal
            from app.models import ProctorEvent, EvidenceAsset
            from app.evidence.storage import StorageService

            db = SessionLocal()
            latest_asset = (
                db.query(EvidenceAsset)
                .join(ProctorEvent, EvidenceAsset.event_id == ProctorEvent.id)
                .filter(ProctorEvent.attempt_id == attempt_id)
                .order_by(ProctorEvent.occurred_at.desc())
                .first()
            )
            if latest_asset:
                img_bytes = StorageService.get_snapshot_bytes(latest_asset.storage_key)
                if img_bytes:
                    self._latest_frames[attempt_id] = img_bytes
                    return img_bytes
        except Exception:
            pass
        finally:
            if db:
                try:
                    db.close()
                except Exception:
                    pass

        return None

    def is_stream_live(self, attempt_id: str) -> bool:
        """True if a camera frame arrived in the past 6 seconds."""
        last_t = self._last_frame_time.get(attempt_id, 0)
        return (time.time() - last_t) < 6.0

    def add_proctor_subscriber(self, attempt_id: str, ws: WebSocket):
        if attempt_id not in self._proctor_subscribers:
            self._proctor_subscribers[attempt_id] = set()
        self._proctor_subscribers[attempt_id].add(ws)

    def remove_proctor_subscriber(self, attempt_id: str, ws: WebSocket):
        if attempt_id in self._proctor_subscribers:
            self._proctor_subscribers[attempt_id].discard(ws)
            if not self._proctor_subscribers[attempt_id]:
                del self._proctor_subscribers[attempt_id]

    def register_candidate_ws(self, attempt_id: str, ws: WebSocket):
        self._candidate_websockets[attempt_id] = ws

    def remove_candidate_ws(self, attempt_id: str):
        if attempt_id in self._candidate_websockets:
            del self._candidate_websockets[attempt_id]

    async def relay_webrtc_signal(self, attempt_id: str, from_role: str, payload: dict):
        """Relay WebRTC Offer/Answer/ICE between candidate and proctor."""
        if from_role == "candidate":
            # Send to all proctors watching this attempt
            subscribers = list(self._proctor_subscribers.get(attempt_id, []))
            for ws in subscribers:
                try:
                    await ws.send_json({"type": "webrtc_signal", "from": "candidate", "payload": payload})
                except Exception:
                    pass
        elif from_role == "proctor":
            # Send to candidate
            cand_ws = self._candidate_websockets.get(attempt_id)
            if cand_ws:
                try:
                    await cand_ws.send_json({"type": "webrtc_signal", "from": "proctor", "payload": payload})
                except Exception:
                    pass

    async def generate_mjpeg_stream(self, attempt_id: str):
        """
        Asynchronous generator yielding multipart/x-mixed-replace JPEG frames
        for smooth CCTV video playback in native <img> or <video> elements.
        Delivers new frames immediately with sub-50ms latency without buffer bloat.
        """
        boundary = b"--frame\r\n"
        content_type = b"Content-Type: image/jpeg\r\n\r\n"
        last_delivered_time = 0.0

        try:
            while True:
                curr_time = self._last_frame_time.get(attempt_id, 0.0)
                frame = None

                if curr_time > last_delivered_time:
                    frame = self._latest_frames.get(attempt_id)
                    last_delivered_time = curr_time
                elif not self._latest_frames.get(attempt_id):
                    # No live camera frame yet: attempt DB fallback or yield standby
                    frame = self.get_latest_frame(attempt_id) or self._standby_frame
                    # Idle standby pacing to prevent CPU/network saturation
                    yield boundary + content_type + frame + b"\r\n"
                    await asyncio.sleep(0.5)
                    continue

                if frame:
                    yield boundary + content_type + frame + b"\r\n"

                # Check for new frames every 35-50ms (~20-28 FPS)
                await asyncio.sleep(0.04)
        except (asyncio.CancelledError, GeneratorExit):
            return

# Global singleton instance
stream_hub = LiveStreamHub()
