.PHONY: run this clean all weekly six test export-json spin-up spin-build spin-watch

all:
	-make clean
	make this

today:
	./hack/today.sh

weekly:
	./hack/weekly.sh

six:
	./hack/six.sh

run:
	./hack/runme.sh

this: this_month.csv

this_month.csv:
	./hack/this-month.sh

prep-data:
	@echo "Preparing dashboard data..."
	@set -a && . ./.env.local && set +a && \
	INCLUDE_NONBILLABLE=true OUTPUT_FILE=web/public/data.json ruby export.rb ^ && \
	INCLUDE_NONBILLABLE=true OUTPUT_FILE=web/public/six.json ruby export.rb 6 && \
	ruby generate_summary.rb

spin-build: prep-data
	cd web && npm run build
	cd spin-app/time-tracker-service && spin build

spin-up: prep-data spin-build
	set -a && . ./.env.local && set +a && \
	cd spin-app/time-tracker-service && \
	spin up --variable early_api_key=$$EARLY_API_KEY --variable early_api_secret=$$EARLY_API_SECRET

spin-watch: prep-data
	@set -a && . ./.env.local && set +a && \
	cd spin-app/time-tracker-service && \
	spin watch --variable early_api_key=$$EARLY_API_KEY --variable early_api_secret=$$EARLY_API_SECRET

clean:
	rm this_month.csv
	rm output.csv
	rm -f web/public/data.json
	rm -rf web/dist

test:
	cd test && ruby run_tests.rb
