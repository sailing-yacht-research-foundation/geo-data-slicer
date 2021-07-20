# geo-data-slicer

Given a spatial and temporal domain, return a set of earth science data.
This data comes from the model/forecast data which is archived by the geo-data-archiver as well as from scraping "point sources" which change frequently.

It also creates "useful" data types with said data, such as geojson or other json objects which are useful to the analysis engine.
It is meant to interface with the analysis engine directly.

## Building & Running

You need to build the container

- `docker build -t geo_data_slicer:1.0 .`
- `docker run -p 3000:3000 -it --mount type=bind,source=$(pwd),target=/data geo_data_slicer:1.0 /bin/bash`

After running the container, install the dependencies with `npm install`, and start the service with one of this way:

- `npm run dev` to run on development mode using nodemon. Any changes to the source code will trigger reload on http server.
- `pm2 start src/main.js` This will run the service with pm2, and restart the application whenever unhandled exception is thrown.

## Logs

All information log & error logs are saved in `logs/combined.log` & `logs/error.log`. Any exception will be store into `logs/exceptions.log`

## Endpoints

- `/api/v1`

  - Method: POST
  - Body:
    Name | Type | Description
    ---|---|---
    **roi**|`geojson(polygon)`| Region of interest to be sliced from gribs, and other weather sources
    **startTimeUnixMS** |`number`| Starting time of data to be sliced
    **endTimeUnixMS** |`number`| Starting time of data to be sliced
    **webhook** |`string`| URL target for processed data
    **webhookToken** |`string`| Token for webhook
    **payload** |`object`| {raceID: 'xxx'}

- `/api/v1/point`

  - Method: POST
  - Body:
    Name | Type | Description
    ---|---|---
    **point**|`geojson(polygon)`| Point of interest to be sliced from weather sources
    **startTimeUnixMS** |`number`| Starting time of data to be sliced
    **endTimeUnixMS** |`number`| Starting time of data to be sliced
    **webhook** |`string`| URL target for processed data
    **webhookToken** |`string`| Token for webhook
