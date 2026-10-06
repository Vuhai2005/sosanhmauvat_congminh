import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ai_compare import compare_images


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


app = FastAPI(
    title="Hệ thống so sánh mẫu vật - Học viện Cảnh sát",
    version="3.0.0-local-cv",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "system": "Hệ thống so sánh mẫu vật - Học viện Cảnh sát",
        "status": "ok",
        "ai": "Local Computer Vision",
    }


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "ai_configured": True,
        "ai_provider": "local-cv",
        "model": "OpenCV + NumPy + Pillow",
    }


@app.post("/api/ai/compare")
async def ai_compare(
    forensic_type: str = Form(...),
    object1_file: UploadFile = File(...),
    object2_file: UploadFile = File(...),
):
    allowed = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    if (
        object1_file.content_type not in allowed
        or object2_file.content_type not in allowed
    ):
        raise HTTPException(
            status_code=400,
            detail="Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.",
        )

    suffix1 = (
        Path(object1_file.filename or "object1.jpg").suffix
        or ".jpg"
    )

    suffix2 = (
        Path(object2_file.filename or "object2.jpg").suffix
        or ".jpg"
    )

    p1 = None
    p2 = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix1,
            dir=UPLOAD_DIR,
        ) as f1:
            p1 = Path(f1.name)
            f1.write(await object1_file.read())

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix2,
            dir=UPLOAD_DIR,
        ) as f2:
            p2 = Path(f2.name)
            f2.write(await object2_file.read())

        try:
            result = compare_images(
                forensic_type,
                p1,
                p2,
            )

            return result

        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            ) from exc

        except RuntimeError as exc:
            print("=" * 70)
            print("LOCAL CV ERROR:")
            print(str(exc))
            print("=" * 70)

            raise HTTPException(
                status_code=503,
                detail=str(exc),
            ) from exc

        except Exception as exc:
            print("=" * 70)
            print("COMPARE ERROR:")
            print(repr(exc))
            print("=" * 70)

            raise HTTPException(
                status_code=500,
                detail=f"Phân tích ảnh thất bại: {exc}",
            ) from exc

    finally:
        for path in (p1, p2):
            if path is not None:
                try:
                    path.unlink(missing_ok=True)
                except Exception:
                    pass