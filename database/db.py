from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from settings import settings

engine = create_engine(
    url=settings.db_uri,
    pool_size=4500,
    echo=True
)

connection = sessionmaker(
    bind=engine,
    class_=Session
)

Base = declarative_base()


def get_db_session():
    try:
        with connection.begin():
            yield Session

    except SQLAlchemyError:
        Session.rollback()


