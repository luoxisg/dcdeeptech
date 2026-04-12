import os
from pathlib import Path

TEST_DB = Path("tests/.lead_intel_test.db").resolve()
os.environ["LEAD_INTEL_DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"

if TEST_DB.exists():
    TEST_DB.unlink()

from apps.api.app.db.bootstrap import seed_demo_data
from apps.api.app.db.session import SessionLocal, engine
from packages.db.models import Base

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_demo_data(db)
