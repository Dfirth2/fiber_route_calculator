@echo off
REM Fiber Route Calculator - Non-Docker Setup Script for Windows

echo.
echo ============================================
echo Fiber Route Calculator - Non-Docker Setup
echo ============================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3 is not installed. Please install Python 3.11 or higher.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION% found

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed. Please install Node.js 18 or higher.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found

REM Create .env file
if not exist "backend\.env" (
    echo [*] Creating backend\.env...
    (
        echo # Environment variables for development with SQLite
        echo ENVIRONMENT=development
        echo DATABASE_URL=sqlite:///./fiber_db.sqlite
        echo SECRET_KEY=your-secret-key-change-in-production
        echo UPLOAD_DIR=./uploads
        echo MAX_UPLOAD_SIZE=524288000
        echo CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://localhost:4200,http://127.0.0.1:3000,http://127.0.0.1:8000
    ) > backend\.env
    echo [OK] Created with SQLite ^(development mode^)
    echo [INFO] For production with PostgreSQL, update DATABASE_URL in backend\.env
) else (
    echo [OK] backend\.env already exists
)

REM Create uploads directory
if not exist "backend\uploads" (
    mkdir backend\uploads
    echo [*] Created backend\uploads directory
)

REM Backend setup
echo.
echo Setting up backend...

cd backend

if not exist "venv" (
    echo [*] Creating Python virtual environment...
    python -m venv venv
)

echo [*] Activating virtual environment and installing dependencies...
call venv\Scripts\activate.bat
pip install -q -r requirements.txt

if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)

echo [OK] Backend dependencies installed

cd ..

REM Frontend setup
echo.
echo Setting up frontend...

cd frontend-angular

if not exist "node_modules" (
    echo [*] Installing Node.js dependencies...
    call npm install -q
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
    echo [OK] Frontend dependencies installed
) else (
    echo [OK] Frontend dependencies already installed
)

cd ..

echo.
echo ============================================
echo [OK] Setup complete!
echo ============================================
echo.
echo Next Steps:
echo.
echo 1. Start the backend:
echo    cd backend
echo    venv\Scripts\activate.bat
echo    python main.py
echo.
echo 2. In another terminal, start the frontend:
echo    cd frontend-angular
echo    npm start
echo.
echo 3. Open your browser to http://localhost:4200
echo.
echo For more information, see README.md
echo.
pause
