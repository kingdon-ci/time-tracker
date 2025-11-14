.PHONY: run this clean all weekly six test

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

clean:
	rm this_month.csv
	rm output.csv

test:
	cd test && ruby run_tests.rb
