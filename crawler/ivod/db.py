
# 1. Configure DB URL from environment
import os

DB_BACKEND = os.getenv("DB_BACKEND", "sqlite").lower()
if DB_BACKEND == "sqlite":
    # Use in-memory DB by default, override with SQLITE_PATH for file-based DB
    sqlite_path = os.getenv("SQLITE_PATH")
    if sqlite_path:
        DB_URL = f"sqlite:///{sqlite_path}"
    else:
        DB_URL = "sqlite:///:memory:"
elif DB_BACKEND == "postgresql":
    PG = {
        "host": os.getenv("PG_HOST"),
        "port": os.getenv("PG_PORT", "5432"),
        "db":   os.getenv("PG_DB"),
        "user": os.getenv("PG_USER"),
        "pass": os.getenv("PG_PASS"),
    }
    DB_URL = (
        f"postgresql://{PG['user']}:{PG['pass']}@"
        f"{PG['host']}:{PG['port']}/{PG['db']}"
    )
elif DB_BACKEND == "mysql":
    MYSQL = {
        "host": os.getenv("MYSQL_HOST"),
        "port": os.getenv("MYSQL_PORT", "3306"),
        "db":   os.getenv("MYSQL_DB"),
        "user": os.getenv("MYSQL_USER"),
        "pass": os.getenv("MYSQL_PASS"),
    }
    DB_URL = (
        f"mysql+pymysql://{MYSQL['user']}:{MYSQL['pass']}@"
        f"{MYSQL['host']}:{MYSQL['port']}/{MYSQL['db']}?charset=utf8mb4"
    )
else:
    raise ValueError(f"Unsupported DB_BACKEND: {DB_BACKEND}")

# 2. SQLAlchemy setup
from sqlalchemy import (
    create_engine, Column, Integer, Text, Date, ARRAY, TIMESTAMP, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine(DB_URL, echo=False)
Session = sessionmaker(bind=engine)
Base = declarative_base()

# 3. ORM Model
class IVODTranscript(Base):
    __tablename__ = "ivod_transcripts"
    ivod_id          = Column(Integer, primary_key=True)
    ivod_url         = Column(Text, nullable=False)
    date             = Column(Date,  nullable=False)
    meeting_code     = Column(Text)
    meeting_code_str = Column(Text)
    category         = Column(Text)
    video_type       = Column(Text)
    video_start      = Column(Text)
    video_end        = Column(Text)
    video_length     = Column(Text)
    video_url        = Column(Text)
    title            = Column(Text)
    speaker_name     = Column(Text)
    meeting_time     = Column(TIMESTAMP(timezone=True)) if DB_BACKEND!="sqlite" else Column(Text)
    meeting_name     = Column(Text)
    ai_transcript    = Column(Text)
    ly_transcript    = Column(Text)
    ai_status  = Column(Text,   nullable=False, default="pending")
    ai_retries = Column(Integer, nullable=False, default=0)
    ly_status  = Column(Text,   nullable=False, default="pending")
    ly_retries = Column(Integer, nullable=False, default=0)
    last_updated     = Column(TIMESTAMP(timezone=True), nullable=False) if DB_BACKEND!="sqlite" else Column(Text, nullable=False)
    if DB_BACKEND == "postgresql":
        committee_names = Column(ARRAY(Text))
    elif DB_BACKEND == "mysql":
        committee_names = Column(JSON)
    else:  # sqlite
        # SQLite does not support ARRAY
        committee_names = Column(Text)

# Ensure tables are created
Base.metadata.create_all(engine)