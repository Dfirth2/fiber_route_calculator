# Quick Reference

## Start Application (Non-Docker)

### Linux/macOS - Two Terminals

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend-angular
npm start
```

Then open: http://localhost:4200

### Windows - Two Command Prompts

**Command Prompt 1 (Backend):**
```cmd
cd backend
venv\Scripts\activate.bat
python main.py
```

**Command Prompt 2 (Frontend):**
```cmd
cd frontend-angular
npm start
```

Then open: http://localhost:4200

### Using Setup Scripts

**Linux/macOS:**
```bash
./setup-nondocker.sh    # First time only
./start-nondocker.sh    # To start both servers
```

**Windows:**
```cmd
setup-nondocker.bat     # First time only
```

## Stop Application

### Linux/macOS
```bash
# Press Ctrl+C in each terminal

# Or kill specific processes:
lsof -ti:8000 | xargs kill -9   # Backend
lsof -ti:4200 | xargs kill -9   # Frontend
```

### Windows
```cmd
# Press Ctrl+C in each command prompt

# Or find and kill:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

netstat -ano | findstr :4200
taskkill /PID <PID> /F
```

## Common Commands

### Backend Commands

```bash
cd backend
source venv/bin/activate          # Activate virtual environment

python main.py                    # Start development server
python -m pytest                  # Run tests
python -m pytest -v               # Run tests with verbose output
```

### Frontend Commands

```bash
cd frontend-angular
npm start                         # Start development server
npm run build                     # Build for production
npm test                          # Run tests
npm run lint                      # Check code style
```

## Configuration

### Database Connection

**SQLite (Default - Development):**
```bash
export DATABASE_URL=sqlite:///./fiber_db.sqlite
```

**PostgreSQL (Production):**
```bash
export DATABASE_URL=postgresql://fiber_user:password@localhost:5432/fiber_db
```

### Environment Variables

```bash
# Linux/macOS
export ENVIRONMENT=development
export UPLOAD_DIR=./uploads

# Windows PowerShell
$env:ENVIRONMENT = "development"
$env:UPLOAD_DIR = ".\uploads"

# Windows CMD
set ENVIRONMENT=development
set UPLOAD_DIR=.\uploads
```

## Testing

### Test Backend Health
```bash
curl http://localhost:8000/health
```

### Test Projects API
```bash
curl http://localhost:8000/api/projects/
```

### Test API Docs
```
http://localhost:8000/docs
```

## Troubleshooting Quick Fixes

### Backend won't start: "Port 8000 in use"
```bash
# Linux/macOS
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Frontend won't start: "Port 4200 in use"
```bash
# Linux/macOS
lsof -ti:4200 | xargs kill -9

# Windows
netstat -ano | findstr :4200
taskkill /PID <PID> /F
```

### "ModuleNotFoundError: No module named 'app'"
```bash
# Make sure you're in backend directory
cd backend
python main.py  # Not ../backend/main.py
```

### "npm ERR! Cannot find module"
```bash
cd frontend-angular
rm -rf node_modules package-lock.json
npm install
```

### Database not accessible
```bash
# For SQLite, create the uploads directory:
mkdir -p backend/uploads

# For PostgreSQL, verify it's running:
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS
```

### CORS errors in browser
```bash
# Add your server URL to CORS_ORIGINS in backend/.env
# Example for work server at 192.168.1.100:
# CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# Restart backend after changes
```

## File Locations

```
fiber_route_calculator/
├── backend/
│   ├── main.py                 # Entry point
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Configuration (create from .env.example)
│   ├── fiber_db.sqlite          # SQLite database (created automatically)
│   ├── uploads/                 # Uploaded PDF files
│   └── app/
│       ├── config.py           # Configuration
│       ├── db/
│       │   └── database.py      # Database setup
│       └── routes/              # API endpoints
│
├── frontend-angular/
│   ├── package.json            # Node.js dependencies
│   ├── angular.json            # Angular configuration
│   ├── src/
│   │   ├── main.ts             # Entry point
│   │   ├── index.html          # HTML template
│   │   └── app/                # Angular components
│   └── dist/                   # Built files (production)
│
├── README.md                    # Main documentation
├── CONFIGURATION.md            # Configuration guide
├── TROUBLESHOOTING.md          # Troubleshooting guide
├── setup-nondocker.sh          # Automated setup (Linux/macOS)
└── setup-nondocker.bat         # Automated setup (Windows)
```

## Useful URLs

- **Frontend**: http://localhost:4200
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **API Health**: http://localhost:8000/health

## Environment Files

### backend/.env Template
```env
ENVIRONMENT=development
DATABASE_URL=sqlite:///./fiber_db.sqlite
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=524288000
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

## Performance Tips

1. **Uploads** are stored in `backend/uploads` - ensure disk space available
2. **Database** grows with project data - SQLite best for development, PostgreSQL for production
3. **Browser caching** - Hard refresh (Ctrl+Shift+R) if UI doesn't update
4. **PDF size** - Recommended max 50MB, max upload 500MB

## Getting Started Checklists

### First Time Setup
- [ ] Install Python 3.11+
- [ ] Install Node.js 18+
- [ ] Install PostgreSQL (optional, for production)
- [ ] Clone/download application
- [ ] Run setup script or manual setup
- [ ] Start both servers
- [ ] Open http://localhost:4200
- [ ] Upload a PDF plat

### Deploy to Work Server
- [ ] Install dependencies (Python, Node, PostgreSQL)
- [ ] Run setup-nondocker script
- [ ] Configure .env with work server hostname
- [ ] Start backend and frontend
- [ ] Test API endpoint from work server
- [ ] Verify database connection
- [ ] Update CORS_ORIGINS if behind proxy
