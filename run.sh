#!/bin/bash

# give permission to the files inside /secure_docs directory

chmod -R 777 /home/ubuntu/geo-data-slicer

# navigate into current working directory

cd /home/ubuntu/geo-data-slicer

# run docker command to build the application

sudo docker build -t slicer .

# stop existing container
sudo docker stop slicer

# remove stopped container
sudo docker rm slicer

# run docker command to start the application
sudo docker run -d --restart unless-stopped --env-file=.env -p 3000:3000 --name slicer slicer:latest

#delete unused images
sudo docker rmi $(docker images -q -f dangling=true)
