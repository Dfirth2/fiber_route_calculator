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
    db_path = os.path.join(temp_upload_dir, "test_markers.sqlite")
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


def test_create_terminal_marker(test_client):
    """Test creating a terminal marker."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act
    resp = test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={
            "x": 100.0,
            "y": 150.0,
            "marker_type": "terminal",
            "page_number": 1
        }
    )
    
    # Assert
    assert resp.status_code == 200
    data = resp.json()
    assert data["x"] == 100.0
    assert data["y"] == 150.0
    assert data["marker_type"] == "terminal"
    assert data["page_number"] == 1
    assert "id" in data


def test_create_drop_marker(test_client):
    """Test creating a drop pedestal marker."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act
    resp = test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={
            "x": 200.0,
            "y": 250.0,
            "marker_type": "dropPed",
            "page_number": 1
        }
    )
    
    # Assert
    assert resp.status_code == 200
    data = resp.json()
    assert data["marker_type"] == "dropPed"


def test_get_markers_for_project(test_client):
    """Test retrieving all markers for a project."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Create multiple markers
    test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={"x": 100.0, "y": 150.0, "marker_type": "terminal", "page_number": 1}
    )
    test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={"x": 200.0, "y": 250.0, "marker_type": "dropPed", "page_number": 1}
    )
    
    # Act: Get all markers
    resp = test_client.get(f"/api/projects/{project_id}/markers/")
    
    # Assert
    assert resp.status_code == 200
    markers = resp.json()
    assert len(markers) == 2
    assert any(m["marker_type"] == "terminal" for m in markers)
    assert any(m["marker_type"] == "dropPed" for m in markers)


def test_delete_marker(test_client):
    """Test deleting a marker."""
    # Arrange
    project_id = create_test_project(test_client)
    marker_resp = test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={"x": 100.0, "y": 150.0, "marker_type": "terminal", "page_number": 1}
    )
    marker_id = marker_resp.json()["id"]
    
    # Act: Delete marker
    delete_resp = test_client.delete(f"/api/projects/{project_id}/markers/{marker_id}/")
    
    # Assert
    assert delete_resp.status_code == 200
    
    # Verify it's deleted
    markers_resp = test_client.get(f"/api/projects/{project_id}/markers/")
    markers = markers_resp.json()
    assert len(markers) == 0


def test_multiple_markers_same_position_allowed(test_client):
    """Test that markers can be created at the same position."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Create two markers at same position with different types
    resp1 = test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={"x": 100.0, "y": 100.0, "marker_type": "terminal", "page_number": 1}
    )
    resp2 = test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={"x": 100.0, "y": 100.0, "marker_type": "dropPed", "page_number": 1}
    )
    
    # Assert
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    
    markers_resp = test_client.get(f"/api/projects/{project_id}/markers/")
    markers = markers_resp.json()
    assert len(markers) == 2


def test_marker_persistence_across_requests(test_client):
    """Test that markers persist across multiple requests."""
    # Arrange
    project_id = create_test_project(test_client)
    
    # Act: Create marker
    create_resp = test_client.post(
        f"/api/projects/{project_id}/markers/",
        json={"x": 100.0, "y": 150.0, "marker_type": "terminal", "page_number": 1}
    )
    marker_id = create_resp.json()["id"]
    
    # Act: Retrieve marker multiple times
    resp1 = test_client.get(f"/api/projects/{project_id}/markers/")
    resp2 = test_client.get(f"/api/projects/{project_id}/markers/")
    
    # Assert
    markers1 = resp1.json()
    markers2 = resp2.json()
    assert len(markers1) == 1
    assert len(markers2) == 1
    assert markers1[0]["id"] == marker_id
    assert markers2[0]["id"] == marker_id


def test_create_marker_for_nonexistent_project(test_client):
    """Test creating a marker for a project that doesn't exist."""
    # Act
    resp = test_client.post(
        "/api/projects/99999/markers/",
        json={"x": 100.0, "y": 150.0, "marker_type": "terminal", "page_number": 1}
    )
    
    # Assert
    assert resp.status_code != 200  # Should fail
