# Troubleshooting: Projects Won't Load

This guide helps you diagnose why projects aren't loading in the application.

## Quick Diagnosis Checklist

- [ ] Backend is running on port 8000
- [ ] Frontend is running on port 4200 (or your configured port)
- [ ] Database file/connection is accessible
- [ ] No CORS errors in browser console
- [ ] API endpoint returns data (test with curl)

## Step-by-Step Troubleshooting

### 1. Verify Backend is Running

```bash
# Check if backend is responding
curl http://localhost:8000/health

# Expected response:
# {"status": "healthy"}
```

**If no response:**
- Backend is not running, start it:
  ```bash
  cd backend
  source venv/bin/activate  # or venv\Scripts\activate on Windows
  python main.py
  ```
- Backend crashed, check error messages and logs
- Wrong port, check backend configuration

### 2. Verify Database Connection

Check backend logs for database errors:

```bash
# Look for these errors in backend output:
# - "Could not connect to server"
# - "sqlite3.OperationalError"
# - "psycopg2.OperationalError"
```

**SQLite Issues:**
```bash
# Verify database file exists
ls -la backend/fiber_db.sqlite

# If missing, check UPLOAD_DIR is writable
ls -la backend/uploads

# Check file permissions
chmod 644 backend/fiber_db.sqlite
chmod 755 backend/uploads
```

**PostgreSQL Issues:**
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS

# Test connection
psql -U fiber_user -d fiber_db -h localhost

# If connection fails, check:
# 1. DATABASE_URL in .env matches PostgreSQL credentials
# 2. PostgreSQL is accepting connections on port 5432
# 3. Database and user exist in PostgreSQL
```

### 3. Check API Endpoint Directly

```bash
# Test projects endpoint
curl http://localhost:8000/api/projects/

# Expected response:
# [] (empty array, or list of projects)
```

**If you get 404:**
- Backend routes not loaded correctly
- Check backend startup output for errors
- Verify all route files are present: `backend/app/routes/*.py`

**If you get connection error:**
- Backend not running
- Wrong port (check DEFAULT PORT in main.py)

### 4. Check Browser Console for Errors

Open browser DevTools (F12) → Console tab:

```javascript
// Look for errors like:
// - "GET http://localhost:8000/api/projects/ net::ERR_CONNECTION_REFUSED"
// - "Access to XMLHttpRequest blocked by CORS"
// - "401 Unauthorized"
```

### 5. Verify CORS Configuration

```bash
# If you see CORS errors, check allowed origins
cat backend/.env | grep CORS_ORIGINS

# Add your frontend URL to CORS_ORIGINS
# Example:
# CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://myserver:3000
```

Then restart backend:
```bash
# Kill running backend (Ctrl+C or taskkill)
# Restart:
cd backend
source venv/bin/activate
python main.py
```

### 6. Check Frontend API Configuration

The frontend auto-detects the API URL. Verify it's correct:

```javascript
// In browser console, type:
localStorage.getItem('apiUrl')
// or check where API calls are going (Network tab in DevTools)
```

**Expected URL:**
- Local development: `http://localhost:8000/api`
- Production: `/api` (relative path, goes through reverse proxy)

### 7. Verify Database Tables Were Created

```bash
# SQLite:
sqlite3 backend/fiber_db.sqlite ".tables"
# Should show: assignments, markers, polylines, projects, scale_calibrations, etc.

# PostgreSQL:
psql -U fiber_user -d fiber_db -c "\dt"
# Should list all tables
```

**If tables are missing:**
- They should be created automatically on first run
- Check backend logs for SQLAlchemy errors
- Manually trigger table creation by restarting backend

## Common Error Messages and Solutions

### "ERROR: Could not connect to server"

**Cause:** PostgreSQL not running or wrong credentials

**Solution:**
```bash
# For PostgreSQL, verify it's running and accepts connections
psql -U fiber_user -d fiber_db

# Update DATABASE_URL in backend/.env with correct credentials
export DATABASE_URL=postgresql://fiber_user:password@localhost:5432/fiber_db

# Restart backend
```

### "ERROR: sqlite3.OperationalError: unable to open database file"

**Cause:** SQLite database file path is wrong or directory doesn't exist

**Solution:**
```bash
# Ensure uploads directory exists and is writable
mkdir -p backend/uploads
chmod 755 backend/uploads

# Verify DATABASE_URL is correct
# Should be: sqlite:///./fiber_db.sqlite

# Restart backend
```

### "No projects showing (empty list)"

**Cause:** 
- Database connected but no projects created yet (normal!)
- OR database has projects but they're not loading

**Solution:**
1. Create a new project through the UI (Upload a PDF)
2. If still not showing, check browser network tab for API errors
3. Verify backend is returning data:
   ```bash
   curl http://localhost:8000/api/projects/
   ```

### "Access to XMLHttpRequest blocked by CORS"

**Cause:** Frontend origin not in CORS_ORIGINS list

**Solution:**
1. Check what origin frontend is running on:
   ```javascript
   // In browser console:
   console.log(window.location.origin)
   ```

2. Add it to CORS_ORIGINS in backend/.env:
   ```env
   CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://myserver:3000
   ```

3. Restart backend for changes to take effect

### "404 Not Found" on /api/projects/

**Cause:** Backend routes not loaded or wrong port

**Solution:**
```bash
# Verify backend is running on port 8000
netstat -an | grep 8000  # Linux/Mac
netstat -ano | findstr :8000  # Windows

# Test health endpoint
curl http://localhost:8000/health
# Should return: {"status": "healthy"}

# Test projects endpoint
curl http://localhost:8000/api/projects/
# Should return: [] or [...]
```

## Database Connection Strings Reference

### SQLite
```
sqlite:///./fiber_db.sqlite
```

### PostgreSQL
```
postgresql://username:password@hostname:port/database
postgresql://fiber_user:fiber_password@localhost:5432/fiber_db
```

### PostgreSQL (SSL, for cloud databases)
```
postgresql+psycopg2://user:password@host:5432/db?sslmode=require
```

## Testing API Endpoints

### List all projects
```bash
curl http://localhost:8000/api/projects/
```

### Get specific project
```bash
curl http://localhost:8000/api/projects/1/
```

### Create a test project
```bash
curl -X POST http://localhost:8000/api/projects/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "Test description",
    "project_number": "TEST-001",
    "devlog_number": "DEV-001",
    "neighborhood_name": "Test Neighborhood",
    "contractor_name": "Test Contractor",
    "estimated_cost": 10000.0,
    "fiber_outage_cause": "Testing"
  }'
```

## Getting Help

If none of these solutions work:

1. **Check all logs:**
   ```bash
   # Backend startup messages (where backend is running)
   # Browser console (F12 → Console tab)
   # Browser network tab (F12 → Network tab)
   ```

2. **Verify environment setup:**
   ```bash
   python3 --version  # Should be 3.11+
   node --version     # Should be 18+
   echo $DATABASE_URL # Check what DB it's using
   ```

3. **Try fresh database:**
   ```bash
   # Backup old database
   mv backend/fiber_db.sqlite backend/fiber_db.sqlite.bak
   
   # Restart backend to create fresh database
   cd backend
   python main.py
   ```
