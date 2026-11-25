from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import cv2
import numpy as np
from uniface import RetinaFace

app = FastAPI(title="SEMEC Capivari - UniFace Biometria API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carrega detector facial leve e preciso do repositório yakhyo/uniface (ONNX)
detector = RetinaFace()


class VerifyFaceRequest(BaseModel):
    image_base64: str
    cpf: str
    nome: str


@app.get("/health")
def health():
    return {"status": "ok", "engine": "yakhyo/uniface"}


@app.post("/verify-face")
def verify_face(req: VerifyFaceRequest):
    try:
        raw = req.image_base64.split(",")[-1]
        img_bytes = base64.b64decode(raw)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Imagem inválida")

        faces = detector.detect(frame)
        if not faces or len(faces) == 0:
            return {"face_detected": False, "confidence": 0.0, "faces_count": 0}

        # Pega maior confiança entre rostos detectados
        melhor = max(faces, key=lambda f: float(f.confidence if hasattr(f, "confidence") else f[4]))
        conf = float(melhor.confidence if hasattr(melhor, "confidence") else melhor[4])

        return {
            "face_detected": True,
            "confidence": round(conf, 4),
            "faces_count": len(faces),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
