# geo-data-grabber
Given a spatial and temporal domain, return a set of earth science data. 
This repository hosts a service that recieves a bounding box and a time frame and gets the available slices of space-time data from our internal s3. 
It also creates "useful" data types with said data, such as geojson. 
