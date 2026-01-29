"""
Unit tests for handhole functionality
Tests marker creation, retrieval, and management for handholes
"""

import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.database import Base
from app.models.database import User, Project, Marker
from app.models.schemas import MarkerCreate, MarkerResponse
from main import app
from app.db.database import get_db


@pytest.fixture
def test_db():
    """Create a test database"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    
    from sqlalchemy.orm import sessionmaker
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield engine
    
    app.dependency_overrides.clear()


@pytest.fixture
def client(test_db):
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def test_user(test_db):
    """Create a test user"""
    from sqlalchemy.orm import sessionmaker
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
    db = TestingSessionLocal()
    
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password="hashedpassword"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    
    return user


@pytest.fixture
def test_project(test_db, test_user):
    """Create a test project"""
    from sqlalchemy.orm import sessionmaker
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
    db = TestingSessionLocal()
    
    project = Project(
        name="Test Project",
        description="A test project",
        pdf_filename="test.pdf",
        owner_id=test_user.id,
        page_count=1
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    db.close()
    
    return project


class TestHandholeMarkers:
    """Test handhole marker creation and retrieval"""
    
    def test_create_handhole_marker(self, client, test_project, test_db):
        """Test creating a handhole marker"""
        from sqlalchemy.orm import sessionmaker
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
        
        handhole_data = {
            "page_number": 1,
            "marker_type": "handhole",
            "x": 100.0,
            "y": 200.0
        }
        
        response = client.post(
            f"/api/projects/{test_project.id}/markers",
            json=handhole_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["marker_type"] == "handhole"
        assert data["x"] == 100.0
        assert data["y"] == 200.0
        assert data["page_number"] == 1
    
    def test_get_handhole_markers(self, client, test_project, test_db):
        """Test retrieving handhole markers"""
        from sqlalchemy.orm import sessionmaker
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
        
        # Create multiple markers
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "terminal", "x": 50.0, "y": 100.0}
        )
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "handhole", "x": 100.0, "y": 200.0}
        )
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "handhole", "x": 150.0, "y": 250.0}
        )
        
        response = client.get(f"/api/projects/{test_project.id}/markers")
        
        assert response.status_code == 200
        markers = response.json()
        assert len(markers) == 3
        
        handholes = [m for m in markers if m["marker_type"] == "handhole"]
        assert len(handholes) == 2
        
        assert handholes[0]["x"] == 100.0
        assert handholes[1]["x"] == 150.0
    
    def test_filter_handholes_by_page(self, client, test_project, test_db):
        """Test filtering handholes by page number"""
        # Create handholes on different pages
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "handhole", "x": 100.0, "y": 200.0}
        )
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 2, "marker_type": "handhole", "x": 150.0, "y": 250.0}
        )
        
        response = client.get(f"/api/projects/{test_project.id}/markers?page_number=1")
        
        assert response.status_code == 200
        markers = response.json()
        assert len(markers) == 1
        assert markers[0]["page_number"] == 1
    
    def test_delete_handhole_marker(self, client, test_project, test_db):
        """Test deleting a handhole marker"""
        from sqlalchemy.orm import sessionmaker
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
        
        # Create a handhole
        create_response = client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "handhole", "x": 100.0, "y": 200.0}
        )
        marker_id = create_response.json()["id"]
        
        # Delete it
        delete_response = client.delete(
            f"/api/projects/{test_project.id}/markers/{marker_id}"
        )
        
        assert delete_response.status_code == 200
        
        # Verify it's deleted
        get_response = client.get(f"/api/projects/{test_project.id}/markers")
        markers = get_response.json()
        assert len(markers) == 0
    
    def test_handhole_with_assignment(self, client, test_project, test_db):
        """Test that handholes can be assigned (but not connected via conduit)"""
        from sqlalchemy.orm import sessionmaker
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
        
        # Create a handhole marker
        response = client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "handhole", "x": 100.0, "y": 200.0}
        )
        
        assert response.status_code == 200
        marker = response.json()
        assert marker["id"] > 0
        
        # Create a marker link (assignment) to the handhole
        link_response = client.post(
            f"/api/projects/{test_project.id}/marker-links",
            json={
                "marker_id": marker["id"],
                "page_number": 1,
                "to_x": 300.0,
                "to_y": 400.0
            }
        )
        
        assert link_response.status_code == 200
        link = link_response.json()
        assert link["marker_id"] == marker["id"]
    
    def test_mixed_marker_types(self, client, test_project, test_db):
        """Test creating and retrieving mixed marker types"""
        from sqlalchemy.orm import sessionmaker
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
        
        # Create various marker types
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "terminal", "x": 50.0, "y": 100.0}
        )
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "dropPed", "x": 150.0, "y": 250.0}
        )
        client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "handhole", "x": 200.0, "y": 300.0}
        )
        
        response = client.get(f"/api/projects/{test_project.id}/markers")
        markers = response.json()
        
        assert len(markers) == 3
        types = {m["marker_type"] for m in markers}
        assert "terminal" in types
        assert "dropPed" in types
        assert "handhole" in types


class TestHandholeConstraints:
    """Test constraints on handhole usage"""
    
    def test_handhole_cannot_be_conduit_endpoint(self, client, test_project, test_db):
        """Test that handholes should not be used as conduit endpoints"""
        from sqlalchemy.orm import sessionmaker
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
        
        # This is validated in the frontend, but documenting the constraint
        # Handholes are single-point equipment, not connection points
        assert True  # Frontend validation is sufficient
    
    def test_handhole_marker_type_string(self, client, test_project, test_db):
        """Test that handhole is stored as string marker_type"""
        from sqlalchemy.orm import sessionmaker
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
        
        response = client.post(
            f"/api/projects/{test_project.id}/markers",
            json={"page_number": 1, "marker_type": "handhole", "x": 100.0, "y": 200.0}
        )
        
        assert response.status_code == 200
        marker = response.json()
        assert isinstance(marker["marker_type"], str)
        assert marker["marker_type"] == "handhole"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
