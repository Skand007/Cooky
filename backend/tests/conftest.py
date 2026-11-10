import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cooky.db")
os.environ.setdefault("OWNER_USERNAME", "skand")
os.environ.setdefault("OWNER_PASSWORD", "test-password")
os.environ.setdefault("SECRET_KEY", "test-secret")

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def _fresh_db():
    Base.metadata.drop_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
