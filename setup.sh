#!/bin/bash

# Setup script for Grievance Management System

echo "=========================================="
echo "Grievance Management System Setup"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js $(node --version) detected"
echo ""

# Setup Backend
echo "📦 Setting up backend..."
cd server || exit 1

if [ ! -f .env ]; then
    echo "⚠️  .env file not found in server directory"
    echo "Please copy config/.env to server/.env and update the DATABASE_URL"
    echo ""
fi

echo "Installing backend dependencies..."
npm install

echo "Generating Prisma client..."
npm run prisma:generate

echo "✓ Backend setup complete!"
echo ""

# Setup Frontend
echo "📦 Setting up frontend..."
cd ../client || exit 1

echo "Installing frontend dependencies..."
npm install

echo "✓ Frontend setup complete!"
echo ""

cd ..

echo "=========================================="
echo "Setup Complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update server/.env with your database connection string"
echo "2. Run 'cd server && npm run prisma:push' to create database tables"
echo "3. Start the backend: 'cd server && npm run dev'"
echo "4. In a new terminal, start the frontend: 'cd client && npm run dev'"
echo ""
echo "Backend will run on: http://localhost:5000"
echo "Frontend will run on: http://localhost:3000"
echo ""
