from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import Case, History
from schemas import CaseCreate, CaseResponse

router = APIRouter(prefix="/api/cases", tags=["Cases"])

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024


def _save_upload(upload: UploadFile) -> tuple[str, int]:
    if upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ ảnh JPG hoặc PNG.")

    content = upload.file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Ảnh vượt quá giới hạn 10 MB.")

    filename = f"{uuid4().hex}{ALLOWED_TYPES[upload.content_type]}"
    destination = UPLOAD_DIR / filename
    destination.write_bytes(content)
    return f"/uploads/{filename}", len(content)


def _delete_upload(url: str | None):
    if not url or not url.startswith("/uploads/"):
        return
    filename = Path(url).name
    target = UPLOAD_DIR / filename
    if target.exists() and target.is_file():
        target.unlink()


@router.get("", response_model=list[CaseResponse])
def get_cases(db: Session = Depends(get_db)):
    return db.query(Case).order_by(Case.id.desc()).all()


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ")
    return case


@router.post("", response_model=CaseResponse)
def create_case(data: CaseCreate, db: Session = Depends(get_db)):
    existing = db.query(Case).filter(Case.case_code == data.case_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã hồ sơ đã tồn tại")

    now = datetime.utcnow()
    case = Case(
        case_code=data.case_code,
        forensic_type=data.forensic_type,
        object1_name=data.object1_name,
        object1_type=data.object1_type,
        object1_size=data.object1_size,
        object1_url=data.object1_url,
        object2_name=data.object2_name,
        object2_type=data.object2_type,
        object2_size=data.object2_size,
        object2_url=data.object2_url,
        score=data.score,
        result_class=data.result_class,
        conclusion=data.conclusion,
        status=data.status,
        officer=data.officer,
        created_at=now,
        analyzed_at=now
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    history = History(
        case_id=case.id,
        case_code=case.case_code,
        forensic_type=case.forensic_type,
        score=case.score,
        result_class=case.result_class,
        conclusion=case.conclusion,
        officer=case.officer,
        created_at=now
    )
    db.add(history)
    db.commit()
    return case


@router.post("/with-files", response_model=CaseResponse)
def create_case_with_files(
    case_code: str = Form(...),
    forensic_type: str = Form(...),
    score: float = Form(...),
    result_class: str = Form(...),
    conclusion: str = Form(...),
    status: str = Form("Đã hoàn thành"),
    officer: str = Form("Cán bộ giám định"),
    object1_name: str = Form(...),
    object1_type: str = Form("image"),
    object1_size: int = Form(...),
    object2_name: str = Form(...),
    object2_type: str = Form("image"),
    object2_size: int = Form(...),
    object1_file: UploadFile = File(...),
    object2_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    existing = db.query(Case).filter(Case.case_code == case_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã hồ sơ đã tồn tại")

    object1_url = None
    object2_url = None

    try:
        object1_url, actual_size1 = _save_upload(object1_file)
        object2_url, actual_size2 = _save_upload(object2_file)

        now = datetime.utcnow()
        case = Case(
            case_code=case_code,
            forensic_type=forensic_type,
            object1_name=object1_name,
            object1_type=object1_type,
            object1_size=actual_size1,
            object1_url=object1_url,
            object2_name=object2_name,
            object2_type=object2_type,
            object2_size=actual_size2,
            object2_url=object2_url,
            score=score,
            result_class=result_class,
            conclusion=conclusion,
            status=status,
            officer=officer,
            created_at=now,
            analyzed_at=now,
        )
        db.add(case)
        db.commit()
        db.refresh(case)

        history = History(
            case_id=case.id,
            case_code=case.case_code,
            forensic_type=case.forensic_type,
            score=case.score,
            result_class=case.result_class,
            conclusion=case.conclusion,
            officer=case.officer,
            created_at=now,
        )
        db.add(history)
        db.commit()
        return case

    except HTTPException:
        db.rollback()
        _delete_upload(object1_url)
        _delete_upload(object2_url)
        raise
    except Exception as exc:
        db.rollback()
        _delete_upload(object1_url)
        _delete_upload(object2_url)
        raise HTTPException(status_code=500, detail=f"Không thể lưu hồ sơ: {exc}")


@router.delete("/by-code/{case_code}")
def delete_case_by_code(case_code: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.case_code == case_code).first()
    if not case:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ")

    object1_url = case.object1_url
    object2_url = case.object2_url

    db.query(History).filter(History.case_id == case.id).delete()
    db.delete(case)
    db.commit()

    _delete_upload(object1_url)
    _delete_upload(object2_url)

    return {"message": "Đã xóa hồ sơ", "case_code": case_code}


@router.delete("/{case_id}")
def delete_case(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ")

    object1_url = case.object1_url
    object2_url = case.object2_url
    db.query(History).filter(History.case_id == case_id).delete()
    db.delete(case)
    db.commit()
    _delete_upload(object1_url)
    _delete_upload(object2_url)
    return {"message": "Đã xóa hồ sơ", "case_id": case_id}
