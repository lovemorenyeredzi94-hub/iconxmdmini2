#!/bin/bash
# Render build script

echo "🚀 Installing dependencies..."
npm install

echo "📁 Creating directories..."
mkdir -p session database

echo "📄 Creating admin.json if not exists..."
if [ ! -f "database/admin.json" ]; then
    echo '["263781328870"]' > database/admin.json
fi

echo "✅ Build complete!"