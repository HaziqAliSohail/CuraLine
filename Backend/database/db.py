from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from settings import settings

# Build engine with SQLite support for local dev
_db_uri = settings.db_uri
_is_sqlite = _db_uri.startswith("sqlite")

_engine_kwargs = {
    "url": _db_uri,
    "pool_size": 1 if _is_sqlite else 20,
    "echo": False,
}

# SQLite doesn't support pool_size/max_overflow in the same way
if _is_sqlite:
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        _db_uri,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
else:
    engine = create_engine(url=_db_uri, pool_size=20, echo=False)

# Enable FK enforcement for SQLite
if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

connection = sessionmaker(
    bind=engine,
    class_=Session
)

Base = declarative_base()


def get_db_session():
    session = connection()
    try:
        yield session
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise
    finally:
        session.close()
