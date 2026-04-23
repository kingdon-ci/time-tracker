.PHONY: run this clean all weekly six test web export-json

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

export-json:
	set -a && . ./.env.local && set +a && INCLUDE_NONBILLABLE=true OUTPUT_FILE=web/public/data.json ruby export.rb ^

export-six:
	set -a && . ./.env.local && set +a && INCLUDE_NONBILLABLE=true OUTPUT_FILE=web/public/six.json ruby export.rb 6

summary-json:
	ruby generate_summary.rb

web: export-json export-six summary-json
	npm run dev

clean:
	rm this_month.csv
	rm output.csv
	rm -f web/public/data.json

test:
	cd test && ruby run_tests.rb
