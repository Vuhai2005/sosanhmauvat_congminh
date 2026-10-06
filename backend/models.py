from datetime import datetime

from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import DateTime
from sqlalchemy import Text

from database import Base


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)

    case_code = Column(
        String(50),
        unique=True,
        index=True,
        nullable=False
    )

    forensic_type = Column(
        String(50),
        nullable=False
    )

    object1_name = Column(
        String(255),
        nullable=True
    )

    object1_type = Column(
        String(100),
        nullable=True
    )

    object1_size = Column(
        Integer,
        nullable=True
    )

    object1_url = Column(
        String(500),
        nullable=True
    )

    object2_name = Column(
        String(255),
        nullable=True
    )

    object2_type = Column(
        String(100),
        nullable=True
    )

    object2_size = Column(
        Integer,
        nullable=True
    )

    object2_url = Column(
        String(500),
        nullable=True
    )

    score = Column(
        Float,
        nullable=True
    )

    result_class = Column(
        String(100),
        nullable=True
    )

    conclusion = Column(
        Text,
        nullable=True
    )

    status = Column(
        String(50),
        default="Hoàn tất"
    )

    officer = Column(
        String(255),
        default="Cán bộ giám định"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    analyzed_at = Column(
        DateTime,
        nullable=True
    )


class History(Base):
    __tablename__ = "history"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    case_id = Column(
        Integer,
        nullable=True
    )

    case_code = Column(
        String(50),
        nullable=False
    )

    forensic_type = Column(
        String(50),
        nullable=False
    )

    score = Column(
        Float,
        nullable=True
    )

    result_class = Column(
        String(100),
        nullable=True
    )

    conclusion = Column(
        Text,
        nullable=True
    )

    officer = Column(
        String(255),
        default="Cán bộ giám định"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )