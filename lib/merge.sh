#!/bin/bash
# Script concatenates all csv files into one txt file and prepends file name (without extention) as the first column

rm all.txt
echo "Stock,Date,Open,High,Low,Close,Volume" > all.txt
for f in ../datum/nyse/financials/*.csv;
do 
echo $f;
fname=`basename $f .csv`
awk -v prefix="$fname" '{print prefix"," $0}' $f | tail -q -r | sed \$d >> all.txt

done