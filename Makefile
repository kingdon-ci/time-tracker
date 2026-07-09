.PHONY: setup build-brain test-brain test-android build install lint format clean all

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
