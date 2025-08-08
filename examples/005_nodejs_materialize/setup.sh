#!/bin/bash

# Dagster Node.js Materializer Setup and Demo Script

echo "🚀 Setting up Dagster Node.js Job Materializer..."

# Change to the example directory
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Setup complete!"
echo ""
echo "📖 Available commands:"
echo "  npm run example  - Run the example demonstrations"
echo "  npm test         - Run the test suite"
echo "  node index.js    - Use the module directly"
echo ""
echo "📋 Prerequisites:"
echo "  - Dagster webserver running on http://localhost:3000"
echo "  - Jobs available in the workspace (update_users_job, update_users_dynamic_job)"
echo ""
echo "🏃 To run the examples:"
echo "  npm run example"
