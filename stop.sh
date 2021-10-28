#!/bin/bash

# stop existing container

docker stop $(docker ps -q --filter ancestor=slicer )
