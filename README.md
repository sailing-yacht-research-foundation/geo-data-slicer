# geo-data-slicer
Given a spatial and temporal domain, return a set of earth science data. 
This data comes from the model/forecast data which is archived by the geo-data-archiver as well as from scraping "point sources" which change frequently.

It also creates "useful" data types with said data, such as geojson or other json objects which are useful to the analysis engine. 
It is meant to interface with the analysis engine directly. 

## Todo:

* Define contract between this service and the analysis engine. 
* Connect to the archiver s3 and PostGIS services to get the data to be sliced.
* Add error logging and exception handling, tests, etc.

