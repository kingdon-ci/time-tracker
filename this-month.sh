#!/usr/bin/env bash
source .env.local
export EARLY_API_KEY EARLY_API_SECRET
OUTPUT_FILE=this_month.csv ruby ./export.rb '^'
