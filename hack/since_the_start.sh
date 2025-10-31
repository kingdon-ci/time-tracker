#!/usr/bin/env bash
source .env.local
export EARLY_API_KEY EARLY_API_SECRET
OUTPUT_FILE=2024_11_history.csv ruby ./export.rb 2024 11
OUTPUT_FILE=2024_12_history.csv ruby ./export.rb 2024 12
OUTPUT_FILE=2025_01_history.csv ruby ./export.rb 2025 01
OUTPUT_FILE=2025_02_history.csv ruby ./export.rb 2025 02
OUTPUT_FILE=2025_03_history.csv ruby ./export.rb 2025 03
OUTPUT_FILE=2025_04_history.csv ruby ./export.rb 2025 04
OUTPUT_FILE=2025_05_history.csv ruby ./export.rb 2025 05
OUTPUT_FILE=2025_06_history.csv ruby ./export.rb 2025 06
OUTPUT_FILE=2025_07_history.csv ruby ./export.rb 2025 07
OUTPUT_FILE=2025_08_history.csv ruby ./export.rb 2025 08
OUTPUT_FILE=2025_09_history.csv ruby ./export.rb 2025 09
OUTPUT_FILE=2025_10_history.csv ruby ./export.rb 2025 10
