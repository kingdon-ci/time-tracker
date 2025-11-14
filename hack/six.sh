#!/usr/bin/env bash
source .env.local
export EARLY_API_KEY EARLY_API_SECRET
export INCLUDE_NONBILLABLE=true
OUTPUT_FILE=six.csv ruby ./export.rb '6'