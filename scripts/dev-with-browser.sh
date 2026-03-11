#!/bin/bash
# Comprehensive dev startup script with auto browser login
# Usage: ./scripts/dev-with-browser.sh
# This script starts the dev server and automatically opens a logged-in browser session

set -e

echo "========================================="
echo "🚀 Starting AI Whiteboard Chat Dev Server"
echo "========================================="

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  # Kill all background processes
  jobs -p | xargs kill 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Step 1: Build convex once
echo "📦 Running convex dev --once..."
npx convex dev --once

# Step 2: Start web server in background
echo "🌐 Starting web server on http://localhost:3000..."
npm run dev:web &
WEB_PID=$!

# Step 3: Start convex dev in background  
echo "🔥 Starting convex dev watcher..."
npx convex dev &
CONVEX_PID=$!

# Step 4: Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while ! curl -s http://localhost:3000 > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Server failed to start after $MAX_RETRIES attempts"
    kill $WEB_PID $CONVEX_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo "✅ Server is ready at http://localhost:3000"

# Step 5: Close any existing browser sessions
echo "🧹 Cleaning up existing browser sessions..."
for session in $(agent-browser session list 2>/dev/null | grep -oE '^\S+' || true); do
  agent-browser --session "$session" close 2>/dev/null || true
done
agent-browser close 2>/dev/null || true
sleep 1

# Step 6: Open browser and login
echo "🔐 Opening browser and logging in..."
agent-browser open http://localhost:3000 --headed
sleep 3

# Try to login
echo "📝 Attempting automatic login..."

# Check if we're already logged in (redirected to dashboard/canvas)
CURRENT_URL=$(agent-browser get url 2>/dev/null || echo "")
if echo "$CURRENT_URL" | grep -qE "(dashboard|canvas|settings)"; then
  echo "✅ Already logged in!"
else
  # Click Sign In button
  agent-browser click 'text="Sign In"' 2>/dev/null || true
  sleep 2

  # Fill email address and click Continue
  agent-browser fill 'input[name="identifier"]' "test+clerk_test@gmail.com" 2>/dev/null || true
  agent-browser click 'button:has-text("Continue")' 2>/dev/null || true
  sleep 3

  # Take snapshot to check if we're on verification code page
  SNAPSHOT=$(agent-browser snapshot -i 2>/dev/null || echo "")
  
  if echo "$SNAPSHOT" | grep -q "Enter verification code"; then
    # Extract ref from snapshot
    CODE_REF=$(echo "$SNAPSHOT" | grep -oE 'textbox "Enter verification code" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' || echo "e15")
    
    echo "Filling verification code..."
    agent-browser fill @$CODE_REF "424242" 2>/dev/null || true
    sleep 2
    echo "✅ Verification code entered - auto-login in progress"
  else
    echo "✅ Login might be complete or not needed"
  fi
fi

echo ""
echo "========================================="
echo "🎉 DEV ENVIRONMENT READY!"
echo "========================================="
echo "🔗 Local: http://localhost:3000"
echo "🌐 Agent Browser: Running with headed mode"
echo ""
echo "Commands:"
echo "  agent-browser snapshot -i    # View interactive elements"
echo "  agent-browser click @e1      # Click element by ref"
echo "  ./scripts/browser-login.sh   # Re-login if needed"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user to press Ctrl+C
wait
