#!/bin/sh

for run in {1..100}
do
	node httpclient.js localhost 8000 $run &
done
