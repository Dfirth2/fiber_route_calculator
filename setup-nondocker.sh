#!/bin/bash

# Fiber Route Calculator - Non-Docker Setup Script
# This script sets up the application to run without Docker

echo "🔧 Fiber Route Calculator - Non-Docker Setup"
echo "=============================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ Python $PYTHON_VERSION found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js $NODE_VERSION found"

# Create .env file
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env..."
    cat > backend/.env << 'EOF'
# Environment variables for development with SQLite
ENVIRONMENT=development
DATABASE_URL=sqlite:///./fiber_db.sqlite
SECRET_KEY=your-secret-key-change-in-production
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=524288000
CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://localhost:4200,http://127.0.0.1:3000,http://127.0.0.1:8000
EOF
    echo "   ✅ Created with SQLite (development mode)"
    echo "   ℹ️  For production with PostgreSQL, update DATABASE_URL in backend/.env"
else
    echo "✅ backend/.env already exists"
fi

# Create uploads directory
mkdir -p backend/uploads
echo "📁 Created backend/uploads directory"

# Backend setup
echo ""
echo "🔧 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "📦 Activating virtual environment and installing dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

cd ..

# Frontend setup
echo ""
echo "🔧 Setting up frontend..."
cd frontend-angular

if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install -q
    if [ $? -eq 0 ]; then
        echo "✅ Frontend dependencies installed"
    else
        echo "❌ Failed to install frontend dependencies"
        exit 1
    fi
else
    echo "✅ Frontend dependencies already installed"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Start the backend:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "2. In another terminal, start the frontend:"
echo "   cd frontend-angular"
echo "   npm start"
echo ""
echo "3. Open your browser to http://localhost:4200"
echo ""
echo "📖 For more information, see README.md"
echo ""
