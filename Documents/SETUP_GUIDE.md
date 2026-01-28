# Fiber Route Calculator - Documentation Index

Welcome! This guide will help you get the application running on your work server without Docker.

## 🚀 Quick Start

**Already have Python and Node.js installed?**

```bash
# Linux/macOS:
chmod +x setup-nondocker.sh
./setup-nondocker.sh

# Windows:
setup-nondocker.bat

# Then start the servers:
./start-nondocker.sh  # Linux/macOS
# or manually in two terminals
```

## 📚 Documentation Files

### Core Documentation

1. **[README.md](README.md)** - Main project documentation
   - Project overview
   - Docker setup instructions
   - Non-Docker setup guide
   - Troubleshooting section

2. **[QUICKREF.md](QUICKREF.md)** - Quick reference for common tasks ⭐ **Start here!**
   - Quick start commands
   - Common commands
   - Troubleshooting quick fixes
   - File locations
   - URLs and configuration templates

3. **[CONFIGURATION.md](CONFIGURATION.md)** - Detailed configuration guide
   - Environment variables explained
   - Example .env files for different scenarios
   - Database setup instructions
   - PostgreSQL vs SQLite comparison
   - Advanced configuration options

4. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Detailed troubleshooting guide
   - Step-by-step diagnosis checklist
   - Common error messages and solutions
   - Database connection issues
   - CORS configuration
   - API endpoint testing

## 🛠️ Setup Scripts

### Automated Setup (Recommended)

1. **Linux/macOS**: `./setup-nondocker.sh`
   - Checks for Python and Node.js
   - Creates virtual environment
   - Installs dependencies
   - Creates necessary directories

2. **Windows**: `setup-nondocker.bat`
   - Same as Linux script but for Windows
   - Run from Command Prompt

3. **Start Both Servers** (after setup): `./start-nondocker.sh`
   - Starts backend on port 8000
   - Starts frontend on port 4200
   - Linux/macOS only (Windows: start manually in two terminals)

### Manual Setup

If you prefer to set up manually, see [QUICKREF.md](QUICKREF.md) for step-by-step commands.

## 📋 Step-by-Step Setup

### 1. Initial Setup (One Time)

```bash
# Linux/macOS:
chmod +x setup-nondocker.sh
./setup-nondocker.sh

# Windows:
setup-nondocker.bat
```

This will:
- Check for Python 3.11+ and Node.js 18+
- Create Python virtual environment
- Install all dependencies
- Create directories for uploads and database
- Generate `.env` file with defaults

### 2. Configure for Your Server

Edit `backend/.env`:
```bash
# For work server at IP 192.168.1.100:
CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# If using PostgreSQL:
DATABASE_URL=postgresql://user:password@localhost:5432/fiber_db
```

### 3. Start the Application

**Option A: Automated (Linux/macOS)**
```bash
./start-nondocker.sh
# Opens http://localhost:4200 automatically
```

**Option B: Manual (All Platforms)**

Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate.bat  # Windows

python main.py
# Backend starts on http://localhost:8000
```

Terminal 2 - Frontend:
```bash
cd frontend-angular
npm start
# Frontend starts on http://localhost:4200
```

### 4. Access the Application

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🔧 Common Issues

### "Projects won't load" / "Database not found"

**Causes**: Backend not running, database not connected, or CORS issue

**Quick Fix**:
```bash
# 1. Ensure backend is running (should see "Uvicorn running on")
# 2. Test API: curl http://localhost:8000/health
# 3. Check browser console (F12) for errors
# 4. See TROUBLESHOOTING.md for detailed steps
```

### "Can't connect to database"

**Cause**: Wrong DATABASE_URL or database not running

**Quick Fix**:
```bash
# For SQLite (default):
export DATABASE_URL=sqlite:///./fiber_db.sqlite

# For PostgreSQL:
export DATABASE_URL=postgresql://user:password@localhost:5432/fiber_db

# Restart backend
```

### "Port 8000 already in use"

**Fix**:
```bash
# Linux/macOS:
lsof -ti:8000 | xargs kill -9

# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**For more issues**, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 📊 Database Choice

### SQLite (Development - Default)
- ✅ No setup needed
- ✅ Good for single user
- ✅ Easy to backup (just one file)
- ❌ Not ideal for multiple concurrent users

**Setup**: Automatic (no action needed)

### PostgreSQL (Production)
- ✅ Multi-user support
- ✅ Better for large datasets
- ✅ Industry standard
- ❌ Requires installation and configuration

**Setup**: See [CONFIGURATION.md](CONFIGURATION.md)

## 🔌 API Connection

The frontend automatically detects the backend:
- **Local (localhost)**: Uses http://localhost:8000/api
- **Remote (IP or hostname)**: Uses /api (relative path through reverse proxy)

No configuration needed for local setup!

## 📁 Project Structure

```
fiber_route_calculator/
├── backend/
│   ├── main.py              # Backend entry point
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # Configuration (create from .env.example)
│   ├── fiber_db.sqlite       # SQLite database (created on first run)
│   └── uploads/              # User-uploaded PDFs
│
├── frontend-angular/
│   ├── package.json          # Node.js dependencies
│   ├── src/
│   │   ├── main.ts           # Frontend entry point
│   │   └── app/              # Angular components
│   └── dist/                 # Built files (production)
│
├── README.md                 # Full documentation
├── QUICKREF.md              # Quick reference ⭐
├── CONFIGURATION.md         # Configuration guide
├── TROUBLESHOOTING.md       # Troubleshooting guide
└── setup-nondocker.sh       # Automated setup
```

## 🆘 Getting Help

1. **Quick answers**: Check [QUICKREF.md](QUICKREF.md)
2. **Setup help**: See [README.md](README.md) - Setup Without Docker section
3. **Configuration issues**: See [CONFIGURATION.md](CONFIGURATION.md)
4. **Can't load projects**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Backend running: `curl http://localhost:8000/health`
- [ ] Frontend running: Can open http://localhost:4200
- [ ] API accessible: `curl http://localhost:8000/api/projects/`
- [ ] No CORS errors in browser console (F12)
- [ ] Can upload a PDF
- [ ] Can calibrate scale
- [ ] Can draw routes and save

## 🚀 Production Deployment

For deploying to production server:

1. Use PostgreSQL instead of SQLite
2. Generate strong SECRET_KEY
3. Configure proper CORS_ORIGINS
4. Set up Nginx reverse proxy (see nginx.conf)
5. Use environment=production
6. Ensure upload directory has enough space
7. Set up SSL certificates for HTTPS
8. Consider using systemd services for auto-start

See [CONFIGURATION.md](CONFIGURATION.md) for production-specific settings.

## 📞 Support

If you encounter issues:

1. Check the appropriate documentation file (see above)
2. Review backend logs (where backend is running)
3. Check browser console (F12 → Console tab)
4. Check browser network tab (F12 → Network tab) for API errors
5. Verify all prerequisites are installed (Python 3.11+, Node.js 18+)

---

**Still stuck?** Start with [QUICKREF.md](QUICKREF.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for step-by-step help.
