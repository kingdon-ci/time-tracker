#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "Starting Groq Billing Scraper..."
echo "This script will open a browser window for manual login."
echo ""

# Run the playwright script
node scripts/groq-scraper.mjs

if [ $? -eq 0 ]; then
  echo ""
  echo "Data collection complete."
  echo "Summary updated in web/public/groq_summary.json"
else
  echo ""
  echo "Error during data collection."
fi
