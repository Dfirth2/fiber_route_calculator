#!/bin/bash

# Start both backend and frontend in the background

echo "🚀 Starting Fiber Route Calculator..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start backend
echo -e "${YELLOW}Starting backend on port 8000...${NC}"
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend
echo -e "${YELLOW}Starting frontend on port 4200...${NC}"
cd frontend-angular
npm start &
FRONTEND_PID=$!
cd ..

sleep 5

echo ""
echo -e "${GREEN}✅ Application started!${NC}"
echo ""
echo "📍 Frontend:  http://localhost:4200"
echo "📍 Backend:   http://localhost:8000"
echo "📍 API Docs:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
