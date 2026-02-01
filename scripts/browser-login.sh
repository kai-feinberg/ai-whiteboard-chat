#!/bin/bash
# Opens a browser instance logged into the app
# Usage: ./scripts/browser-login.sh
# Credentials: test+clerk_test@gmail.com / verification code: 424242

echo "Closing all active browser sessions..."
# Get all sessions and close them
for session in $(agent-browser session list 2>/dev/null | grep -oE '^\S+'); do
  agent-browser --session "$session" close 2>/dev/null
done
agent-browser close 2>/dev/null
sleep 1

echo "Opening browser and logging in..."
agent-browser open http://localhost:3000 --headed
sleep 2

# Click Sign In button
agent-browser click 'text="Sign In"'
sleep 2

# Fill email address and click Continue
agent-browser fill 'input[name="identifier"]' "test+clerk_test@gmail.com"
agent-browser click 'button:has-text("Continue")'
sleep 3

# # Take snapshot to see the verification code page
# echo "Taking snapshot of verification page..."
# agent-browser snapshot -i

# Fill verification code using ref from snapshot and click Continue
agent-browser fill @e15 "424242"
sleep 1
agent-browser click @e17
sleep 2

echo "Login complete. Browser session is ready."
echo "Use 'agent-browser snapshot -i' to interact with the page."
echo "Use 'agent-browser close' when done."
