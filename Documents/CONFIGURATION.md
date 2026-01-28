# Configuration Guide

## Environment Variables

The application is configured through environment variables. Create a `.env` file in the `backend` directory or set them in your system environment.

### Required Variables

#### Database Configuration
- **DATABASE_URL**: Database connection string
  - SQLite (default): `sqlite:///./fiber_db.sqlite`
  - PostgreSQL: `postgresql://username:password@host:port/database`
  - Default: Auto-selects based on ENVIRONMENT

- **ENVIRONMENT**: `development` or `production`
  - Default: `development`
  - Controls database type (SQLite for dev, PostgreSQL for prod)

#### File Upload
- **UPLOAD_DIR**: Path where uploaded PDFs are stored
  - Default: `./uploads`
  - Ensure this directory exists and is writable

- **MAX_UPLOAD_SIZE**: Maximum file size in bytes (default 500MB = 524288000)

### Security Variables (Production Only)

- **SECRET_KEY**: Secret key for JWT token signing
  - Default: `your-secret-key-change-in-production`
  - ⚠️ **MUST change in production!**

- **ALGORITHM**: JWT algorithm (default `HS256`)

- **ACCESS_TOKEN_EXPIRE_MINUTES**: Token expiration time (default 30 minutes)

### CORS Configuration

- **CORS_ORIGINS**: Comma-separated list of allowed origins
  - Development defaults: `http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000`
  - Production: Add your domain(s)
  - Example: `https://myapp.com,https://www.myapp.com,http://internal-server:3000`

## Example .env Files

### Development (SQLite)

```env
ENVIRONMENT=development
DATABASE_URL=sqlite:///./fiber_db.sqlite
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=524288000
SECRET_KEY=dev-secret-key-not-for-production
CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000
```

### Production (PostgreSQL)

```env
ENVIRONMENT=production
DATABASE_URL=postgresql://fiber_user:STRONG_PASSWORD@prod-db-server:5432/fiber_db
UPLOAD_DIR=/var/fiber_uploads
MAX_UPLOAD_SIZE=524288000
SECRET_KEY=GENERATE_STRONG_SECRET_WITH_openssl_rand_-hex_32
CORS_ORIGINS=https://myapp.com,https://www.myapp.com
```

## Generating a Secure Secret Key

```bash
# Linux/macOS:
openssl rand -hex 32

# Python:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## Database Setup Examples

### SQLite (Development)

SQLite requires no additional setup. The database file will be created automatically:

```bash
export DATABASE_URL=sqlite:///./fiber_db.sqlite
python main.py
# File created at: ./fiber_db.sqlite
```

### PostgreSQL (Production)

1. Install PostgreSQL
2. Create database and user:

```bash
sudo -u postgres psql

CREATE DATABASE fiber_db;
CREATE USER fiber_user WITH PASSWORD 'your_secure_password';
ALTER ROLE fiber_user SET client_encoding TO 'utf8';
ALTER ROLE fiber_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE fiber_user SET default_transaction_deferrable TO on;
ALTER ROLE fiber_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE fiber_db TO fiber_user;
\q
```

3. Set environment variable:

```bash
export DATABASE_URL=postgresql://fiber_user:your_secure_password@localhost:5432/fiber_db
```

## API Server Configuration

### Port Configuration

- **Backend Port**: 8000 (set in `main.py`)
- **Frontend Port**: 4200 (set in `angular.json`)

To change ports, edit:
- Backend: `backend/main.py` line with `uvicorn.run()`
- Frontend: `frontend-angular/angular.json` serve section

### CORS Settings

If you get CORS errors:

1. Check current allowed origins:
   ```bash
   grep CORS_ORIGINS backend/.env
   ```

2. Add your domain to CORS_ORIGINS:
   ```env
   CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://your-domain:3000
   ```

3. Restart backend for changes to take effect

## Troubleshooting Configuration

### "CORS error" or "blocked by CORS policy"

**Cause**: Frontend origin not in CORS_ORIGINS list

**Solution**:
```bash
# Find what origin your frontend is running on (in browser console):
# console.log(window.location.origin)

# Add to CORS_ORIGINS in .env
CORS_ORIGINS=http://localhost:3000,http://your-server:3000
```

### Database tables not created

**Cause**: `UPLOAD_DIR` doesn't exist or no write permissions

**Solution**:
```bash
mkdir -p uploads
chmod 755 uploads
```

### File uploads fail

**Cause**: `UPLOAD_DIR` path doesn't exist or insufficient permissions

**Solution**:
```bash
# Ensure directory exists
mkdir -p /path/to/uploads

# Ensure it's writable by the backend user
chmod 755 /path/to/uploads
```

## Advanced Configuration

### Using Environment Files

Instead of exporting variables, create `.env` file:

```bash
# backend/.env
ENVIRONMENT=production
DATABASE_URL=postgresql://...
CORS_ORIGINS=https://myapp.com
```

The app will automatically load from `.env` on startup.

### Docker Compose Configuration

If using Docker, database config is in `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgresql://fiber_user:password@db:5432/fiber_db
      - ENVIRONMENT=production
```

### Nginx Reverse Proxy

If using Nginx (like in Docker setup), configure CORS to match your Nginx listen address:

```bash
CORS_ORIGINS=http://nginx-server,http://nginx-server:80,https://your-domain.com
```

See `nginx.conf` for proxy configuration.
