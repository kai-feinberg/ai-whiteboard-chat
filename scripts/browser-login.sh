#!/bin/bash
# Opens a browser instance logged into the app
# Usage: ./scripts/browser-login.sh
# Credentials: test+clerk_test@gmail.com / verification code: 424242

echo "Opening browser and logging in..."

# Open browser in headed mode
agent-browser open http://localhost:3000 --headed
sleep 1

# Click Sign In button
agent-browser snapshot -i > /dev/null
agent-browser click @e1
sleep 2

# Fill email address (e3) and click Continue (e4)
agent-browser snapshot -i > /dev/null
agent-browser fill @e3 "test+clerk_test@gmail.com"
agent-browser click @e4
sleep 2

# Fill verification code (e4) and click Continue (e6)
agent-browser snapshot -i > /dev/null
agent-browser fill @e4 "424242"
agent-browser click @e6
sleep 3

echo "Login complete. Browser session is ready."
echo "Use 'agent-browser snapshot -i' to interact with the page."
echo "Use 'agent-browser close' when done."
