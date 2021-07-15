# geo-data-slicer

Given a spatial and temporal domain, return a set of earth science data.
This data comes from the model/forecast data which is archived by the geo-data-archiver as well as from scraping "point sources" which change frequently.

It also creates "useful" data types with said data, such as geojson or other json objects which are useful to the analysis engine.
It is meant to interface with the analysis engine directly.

## Todo:

- Add error logging and exception handling, tests, etc.

## Building & Running

You need to build the container

- `docker build -t geo_data_slicer:1.0 .`
- `docker run -p 3000:3000 -it --mount type=bind,source=$(pwd),target=/data geo_data_slicer:1.0 /bin/bash`
