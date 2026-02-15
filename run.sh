#!/bin/bash

# yt-media-storage: One-click Launch Script

echo "🚀 Starting Vault into YouTube..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies (this may take a moment)..."
    npm install
fi

# Start the development server
echo "✨ Launching development server..."
npm run dev
