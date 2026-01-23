#!/bin/bash

# Fiber Route Calculator Setup Script

echo "🔧 Fiber Route Calculator - Setup"
echo "=================================="

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "✅ Docker found"

# Create environment files
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env..."
    cp backend/.env.example backend/.env
    echo "   Edit backend/.env with your settings"
fi

if [ ! -f frontend/.env ]; then
    echo "📝 Creating frontend/.env..."
    cp frontend/.env.example frontend/.env
fi

# Create upload directory
mkdir -p /tmp/fiber_uploads
echo "📁 Created upload directory"

# Start services
echo ""
echo "🚀 Starting services with Docker Compose..."
docker-compose up -d

echo ""
echo "✅ Setup complete!"
echo ""
echo "Services are starting:"
echo "  - Frontend: http://localhost:3000 (wait 30 seconds for build)"
echo "  - Backend:  http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - Database: localhost:5432"
echo ""
echo "Check logs:"
echo "  docker-compose logs -f frontend"
echo "  docker-compose logs -f backend"
echo ""
echo "Stop services:"
echo "  docker-compose down"
