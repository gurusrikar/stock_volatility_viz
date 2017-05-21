#!/bin/bash
# Script concatenates all csv files into one txt file and prepends file name (without extention) as the first column

rm all.txt
echo "Stock,Date,Open,High,Low,Close,Volume" > all.txt
#for f in /Users/gurusrikar/Documents/Spring_2017/CSE578/Project/work/datum/NYSE/basic_materials/*.csv;
for f in ./*.csv;
do 
echo $f;
fname=`basename $f .csv`
# awk -v prefix="$fname" '{print prefix"," $0}' $f | tail -n +2 -q >> all.txt
awk -v prefix="$fname" '{print prefix"," $0}' $f | tail -q -r | sed \$d >> all.txt

done
