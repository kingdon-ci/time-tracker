.PHONY: run this clean

run:
	./hack/runme.sh

this: this_month.csv

this_month.csv:
	./hack/this-month.sh

clean:
	rm this_month.csv
	rm output.csv
