#!/usr/bin/env bash
# Launch Chrome with remote debugging and connect agent-browser to the user's session.
# Usage:
#   ./scripts/browse.sh              # Just start Chrome with debugging (if not already running)
#   ./scripts/browse.sh <url>        # Start Chrome + open URL in agent-browser

CDP_PORT=9222
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Check if Chrome is already listening on the CDP port
if curl -s "http://localhost:${CDP_PORT}/json/version" > /dev/null 2>&1; then
  echo "✓ Chrome already running with remote debugging on port ${CDP_PORT}"
else
  echo "Starting Chrome with remote debugging on port ${CDP_PORT}..."
  "$CHROME" --remote-debugging-port=${CDP_PORT} &>/dev/null &
  # Wait for CDP to become available
  for i in {1..10}; do
    if curl -s "http://localhost:${CDP_PORT}/json/version" > /dev/null 2>&1; then
      echo "✓ Chrome ready"
      break
    fi
    sleep 0.5
  done
fi

if [ -n "$1" ]; then
  agent-browser --cdp ${CDP_PORT} open "$1"
  agent-browser --cdp ${CDP_PORT} wait --load networkidle
  agent-browser --cdp ${CDP_PORT} snapshot -i
fi
