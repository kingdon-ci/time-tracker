.PHONY: setup build-brain test-brain test-ruby test test-android build install lint format clean all \
	prep-data spin-build spin-up spin-watch today weekly six run this summary-json

# Detect Android Studio JBR path on macOS
AS_JDK := /Applications/Android Studio.app/Contents/jbr/Contents/Home/bin
ifeq ($(shell uname), Darwin)
  ifeq ($(shell [ -d "$(AS_JDK)" ] && echo yes), yes)
    export PATH := $(AS_JDK):$(PATH)
  endif
endif

all: build

setup:
	rustup target add wasm32-wasip1

build-brain:
	cd brain && cargo build --target wasm32-wasip1 --release
	mkdir -p android/app/src/main/assets
	cp brain/target/wasm32-wasip1/release/time_tracker_brain.wasm android/app/src/main/assets/brain.wasm

test-brain:
	cd brain && cargo test

test-ruby:
	ruby legacy/test/run_tests.rb

test: test-ruby

test-android: build-brain
	cd android && chmod +x gradlew && ./gradlew test --no-daemon

build: test-brain test-android
	cd android && chmod +x gradlew && ./gradlew assembleDebug --no-daemon

install: build
	cd android && ./gradlew installDebug --no-daemon

lint:
	cd brain && cargo clippy --target wasm32-wasip1 -- -D warnings
	cd android && ./gradlew lint --no-daemon

format:
	cd brain && cargo fmt

clean:
	cd brain && cargo clean || true
	cd android && ./gradlew clean --no-daemon || true
	rm -f android/app/src/main/assets/brain.wasm
	rm -f this_month.csv output.csv six.csv weekly.csv today.csv
	rm -f web/public/data.json web/public/six.json web/public/history_summary.json
	rm -rf web/dist

prep-data:
	@echo "Preparing dashboard data..."
	@set -a && . ./.env.local && set +a && \
	INCLUDE_NONBILLABLE=true OUTPUT_FILE=web/public/data.json ruby legacy/export.rb ^ && \
	INCLUDE_NONBILLABLE=true OUTPUT_FILE=web/public/six.json ruby legacy/export.rb 6 && \
	ruby legacy/generate_summary.rb

spin-build: prep-data
	cd web && npm run build
	cd legacy/spin-app/time-tracker-service && spin build

spin-up: prep-data spin-build
	@set -a && . ./.env.local && set +a && \
	cd legacy/spin-app/time-tracker-service && \
	spin up --variable early_api_key=$$EARLY_API_KEY --variable early_api_secret=$$EARLY_API_SECRET

spin-watch: prep-data
	@set -a && . ./.env.local && set +a && \
	cd legacy/spin-app/time-tracker-service && \
	spin watch --variable early_api_key=$$EARLY_API_KEY --variable early_api_secret=$$EARLY_API_SECRET

today:
	./legacy/hack/today.sh

weekly:
	./legacy/hack/weekly.sh

six:
	./legacy/hack/six.sh

run:
	./legacy/hack/runme.sh

this: this_month.csv

this_month.csv:
	./legacy/hack/this-month.sh

summary-json:
	@set -a && . ./.env.local && set +a && \
	ruby legacy/generate_summary.rb
