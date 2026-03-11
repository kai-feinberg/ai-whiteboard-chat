#!/bin/bash
# Opens a browser instance logged into the app
# Usage: ./scripts/browser-login.sh
# Credentials: test+clerk_test@gmail.com / verification code: 424242

echo "Closing all active browser sessions..."
# Get all sessions and close them
for session in $(agent-browser session list 2>/dev/null | grep -oE '^\S+' || true); do
  agent-browser --session "$session" close 2>/dev/null || true
done
agent-browser close 2>/dev/null || true
sleep 1

echo "Opening browser and logging in..."
agent-browser open http://localhost:3000 --headed
sleep 2

# Check if we're already logged in (look for dashboard elements)
SNAPSHOT=$(agent-browser snapshot -i 2>/dev/null || echo "")
if echo "$SNAPSHOT" | grep -q "Dashboard\|New Canvas\|Open Chat"; then
  echo "Already logged in!"
  echo "Login complete. Browser session is ready."
  echo "Use 'agent-browser snapshot -i' to interact with the page."
  echo "Use 'agent-browser close' when done."
  exit 0
fi

# Click Sign In button
echo "Clicking Sign In..."
agent-browser click 'text="Sign In"' 2>/dev/null || agent-browser click @e1 2>/dev/null || true
sleep 2

# Fill email address and click Continue
echo "Filling email..."
agent-browser fill 'input[name="identifier"]' "test+clerk_test@gmail.com" 2>/dev/null || true
agent-browser click 'button:has-text("Continue")' 2>/dev/null || true
sleep 3

# Take snapshot to see the verification code page and get element refs
echo "Getting verification code field..."
SNAPSHOT=$(agent-browser snapshot -i 2>/dev/null || echo "")

# Extract the verification code textbox ref (e15, e16, etc.)
CODE_REF=$(echo "$SNAPSHOT" | grep -oE 'textbox "Enter verification code" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' || echo "")

if [ -z "$CODE_REF" ]; then
  # Fallback ref if parsing failed
  CODE_REF="e15"
fi

echo "Filling verification code with ref: @$CODE_REF"
agent-browser fill @$CODE_REF "424242" 2>/dev/null || true
sleep 2

echo "Verification code entered - Clerk will auto-login"

echo "Login complete. Browser session is ready."
echo "Use 'agent-browser snapshot -i' to interact with the page."
echo "Use 'agent-browser close' when done."
