#!/bin/bash

# give permission to the files inside /secure_docs directory

chmod -R 777 /home/ubuntu/geo-data-slicer/geo-data-slicer

# navigate into current working directory

cd /home/ubuntu/geo-data-slicer/geo-data-slicer/

rm -rf package.json
