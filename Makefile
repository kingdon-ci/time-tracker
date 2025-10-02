.PHONY: run this clean all

all:
	-make clean
	make this

today:
	./hack/today.sh

run:
	./hack/runme.sh

this: this_month.csv

this_month.csv:
	./hack/this-month.sh

clean:
	rm this_month.csv
	rm output.csv
