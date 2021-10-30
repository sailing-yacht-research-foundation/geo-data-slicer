#!/bin/bash

# give permission to the files inside /secure_docs directory

chmod -R 777 /home/ubuntu/geo-data-slicer/geo-data-slicer

# navigate into current working directory

cd /home/ubuntu/geo-data-slicer/geo-data-slicer/

# run docker command to build the application

docker build -t slicer .

# run docker command to start the application
docker run -d --env-file=envfile -p 3000:3000 slicer
