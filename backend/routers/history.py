from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import History
from schemas import HistoryResponse


router = APIRouter(
    prefix="/api/history",
    tags=["History"]
)


@router.get("", response_model=list[HistoryResponse])
def get_history(
    db: Session = Depends(get_db)
):
    history = (
        db.query(History)
        .order_by(History.id.desc())
        .all()
    )

    return history