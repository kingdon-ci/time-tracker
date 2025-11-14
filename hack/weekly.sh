#!/usr/bin/env bash
source .env.local
export EARLY_API_KEY EARLY_API_SECRET
export ONLY_NONBILLABLE=true
OUTPUT_FILE=weekly.csv ruby ./export.rb 'w'