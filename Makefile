.PHONY: run this clean

run:
	./runme.sh

this: this_month.csv

this_month.csv:
	./this-month.sh

clean:
	rm this_month.csv
	rm output.csv
