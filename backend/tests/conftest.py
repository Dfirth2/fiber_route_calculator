import os
import sys
import tempfile

# Force tests to use a file-based SQLite database to avoid needing Postgres during CI/local runs
TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "fiber_test.sqlite")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

# Ensure the app package is importable when running tests from the backend directory
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
