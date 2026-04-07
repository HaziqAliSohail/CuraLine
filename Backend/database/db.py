from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from settings import settings

engine = create_engine(
    url=settings.db_uri,
    pool_size=20,
    echo=False
)

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

