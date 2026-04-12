from apps.api.app.db.bootstrap import seed_demo_data
from apps.api.app.db.session import SessionLocal, engine
from packages.db.models import Base


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    print("Lead intelligence demo data seeded.")


if __name__ == "__main__":
    main()
