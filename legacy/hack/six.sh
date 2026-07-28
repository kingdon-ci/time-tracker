#!/usr/bin/env bash
source "$(dirname "$0")/../../.env.local" 2>/dev/null || source .env.local 2>/dev/null
export EARLY_API_KEY EARLY_API_SECRET
export INCLUDE_NONBILLABLE=true
OUTPUT_FILE=six.csv ruby "$(dirname "$0")/../export.rb" '6'