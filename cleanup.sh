#!/bin/bash

echo "🧹 Cleaning up Fiber Route Calculator..."

# Stop containers
echo "Stopping containers..."
docker-compose down

# Remove volumes (optional - comment out to keep data)
echo "Removing volumes..."
docker-compose down -v

echo "✅ Cleanup complete"
