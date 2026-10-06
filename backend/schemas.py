from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CaseCreate(BaseModel):
    case_code: str
    forensic_type: str

    object1_name: Optional[str] = None
    object1_type: Optional[str] = None
    object1_size: Optional[int] = None
    object1_url: Optional[str] = None

    object2_name: Optional[str] = None
    object2_type: Optional[str] = None
    object2_size: Optional[int] = None
    object2_url: Optional[str] = None

    score: Optional[float] = None
    result_class: Optional[str] = None
    conclusion: Optional[str] = None

    status: str = "Hoàn tất"
    officer: str = "Cán bộ giám định"


class CaseResponse(BaseModel):
    id: int
    case_code: str
    forensic_type: str

    object1_name: Optional[str] = None
    object1_type: Optional[str] = None
    object1_size: Optional[int] = None
    object1_url: Optional[str] = None

    object2_name: Optional[str] = None
    object2_type: Optional[str] = None
    object2_size: Optional[int] = None
    object2_url: Optional[str] = None

    score: Optional[float] = None
    result_class: Optional[str] = None
    conclusion: Optional[str] = None

    status: Optional[str] = None
    officer: Optional[str] = None

    created_at: datetime
    analyzed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HistoryResponse(BaseModel):
    id: int
    case_id: Optional[int] = None

    case_code: str
    forensic_type: str

    score: Optional[float] = None
    result_class: Optional[str] = None
    conclusion: Optional[str] = None

    officer: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True