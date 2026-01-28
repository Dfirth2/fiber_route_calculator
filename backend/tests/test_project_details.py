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
    db_path = os.path.join(temp_upload_dir, "test_project_details.sqlite")
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


def create_test_project(test_client, name: str = "Test Project"):
    """Helper to create a test project and return its ID."""
    pdf_path = make_pdf_file(settings.UPLOAD_DIR)
    with open(pdf_path, "rb") as f:
        resp = test_client.post(
            "/api/projects/",
            files={"pdf_file": ("sample.pdf", f, "application/pdf")},
            data={"name": name},
        )
    assert resp.status_code == 200
    return resp.json()["id"]


def test_update_project_details(test_client):
    """Test updating project details via PATCH endpoint."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Update project details
    update_data = {
        "project_number": "PROJ-001",
        "devlog_number": "DL-123",
        "pon_cable_name": "Cable-A"
    }
    resp = test_client.patch(f"/api/projects/{project_id}/", json=update_data)
    
    # Assert
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_number"] == "PROJ-001"
    assert data["devlog_number"] == "DL-123"
    assert data["pon_cable_name"] == "Cable-A"


def test_get_project_includes_details(test_client):
    """Test that GET project endpoint returns project details."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Update project details
    update_data = {
        "project_number": "PROJ-002",
        "devlog_number": "DL-456",
        "pon_cable_name": "Cable-B"
    }
    test_client.patch(f"/api/projects/{project_id}/", json=update_data)
    
    # Act: Get project
    resp = test_client.get(f"/api/projects/{project_id}/")
    
    # Assert
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_number"] == "PROJ-002"
    assert data["devlog_number"] == "DL-456"
    assert data["pon_cable_name"] == "Cable-B"


def test_list_projects_includes_details(test_client):
    """Test that list projects endpoint returns project details."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Update project details
    update_data = {
        "project_number": "PROJ-003",
        "devlog_number": "DL-789",
        "pon_cable_name": "Cable-C"
    }
    test_client.patch(f"/api/projects/{project_id}/", json=update_data)
    
    # Act: List projects
    resp = test_client.get("/api/projects/")
    
    # Assert
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) > 0
    project = next(p for p in projects if p["id"] == project_id)
    assert project["project_number"] == "PROJ-003"
    assert project["devlog_number"] == "DL-789"
    assert project["pon_cable_name"] == "Cable-C"


def test_update_partial_project_details(test_client):
    """Test updating only some project detail fields."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Update only project_number
    resp1 = test_client.patch(f"/api/projects/{project_id}/", json={"project_number": "PROJ-004"})
    assert resp1.status_code == 200
    
    # Act: Update only devlog_number
    resp2 = test_client.patch(f"/api/projects/{project_id}/", json={"devlog_number": "DL-999"})
    assert resp2.status_code == 200
    
    # Assert both updates applied
    resp_get = test_client.get(f"/api/projects/{project_id}/")
    data = resp_get.json()
    assert data["project_number"] == "PROJ-004"
    assert data["devlog_number"] == "DL-999"
    assert data["pon_cable_name"] is None  # Should still be None


def test_update_nonexistent_project(test_client):
    """Test updating a project that doesn't exist."""
    # Act: Try to update non-existent project
    resp = test_client.patch(
        "/api/projects/99999/",
        json={"project_number": "PROJ-999"}
    )
    
    # Assert
    assert resp.status_code == 404
    assert "Project not found" in resp.json()["detail"]


def test_project_details_empty_by_default(test_client):
    """Test that project details are None/empty by default."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Get project without updating details
    resp = test_client.get(f"/api/projects/{project_id}/")
    
    # Assert
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("project_number") is None
    assert data.get("devlog_number") is None
    assert data.get("pon_cable_name") is None


def test_update_multiple_projects_independently(test_client):
    """Test that updating one project doesn't affect others."""
    # Arrange
    project1_id = create_test_project(test_client, "Project 1")
    project2_id = create_test_project(test_client, "Project 2")
    
    # Act: Update project 1
    test_client.patch(
        f"/api/projects/{project1_id}/",
        json={"project_number": "PROJ-P1"}
    )
    
    # Act: Update project 2
    test_client.patch(
        f"/api/projects/{project2_id}/",
        json={"project_number": "PROJ-P2"}
    )
    
    # Assert
    resp1 = test_client.get(f"/api/projects/{project1_id}/")
    resp2 = test_client.get(f"/api/projects/{project2_id}/")
    
    assert resp1.json()["project_number"] == "PROJ-P1"
    assert resp2.json()["project_number"] == "PROJ-P2"
