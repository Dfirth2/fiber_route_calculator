import os
import shutil
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pypdf

from app.db.database import Base, get_db
from main import app
from app.config import settings


@pytest.fixture()
def temp_upload_dir():
    tmpdir = tempfile.mkdtemp()
    original_upload = settings.UPLOAD_DIR
    settings.UPLOAD_DIR = tmpdir
    yield tmpdir
    settings.UPLOAD_DIR = original_upload
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture()
def test_client(temp_upload_dir):
    # Use a file-based SQLite DB so schema persists across connections
    db_path = os.path.join(temp_upload_dir, "test_api.sqlite")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def make_pdf_file(tmpdir: str, filename: str = "sample.pdf") -> str:
    """Create a simple one-page PDF and return its path."""
    path = os.path.join(tmpdir, filename)
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=612, height=792)
    with open(path, "wb") as f:
        writer.write(f)
    return path


def test_create_project_unique_name(test_client):
    # Arrange: create a temporary PDF file
    pdf_path = make_pdf_file(settings.UPLOAD_DIR)

    # Act: create a project once
    with open(pdf_path, "rb") as f:
        resp1 = test_client.post(
            "/api/projects/",
            files={"pdf_file": ("sample.pdf", f, "application/pdf")},
            data={"name": "Neighborhood A"},
        )

    # Assert first creation succeeds
    assert resp1.status_code == 200, resp1.text
    first_id = resp1.json()["id"]

    # Act: attempt to create another with the same name (case-insensitive)
    with open(pdf_path, "rb") as f:
        resp2 = test_client.post(
            "/api/projects/",
            files={"pdf_file": ("sample.pdf", f, "application/pdf")},
            data={"name": "neighborhood a"},
        )

    # Assert duplicate is rejected
    assert resp2.status_code == 400
    assert resp2.json().get("detail") == "Project name already exists"

    # Verify list contains only the first project
    list_resp = test_client.get("/api/projects/")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert len(data) == 1
    assert data[0]["id"] == first_id
    assert data[0]["name"] == "Neighborhood A"
