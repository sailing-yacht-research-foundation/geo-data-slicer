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
- `pm2 start` This will run the service with pm2, and restart the application whenever unhandled exception is thrown.

To stop pm2 service, run `pm2 stop geoslicer`

## Logs

All information log & error logs are saved in `logs/combined.log` & `logs/error.log`. Any exception will be store into `logs/exceptions.log`

## Deployment

Slicer is using CodeDeploy to deploy into dev & production servers.
The CodeDeploy script will zip all the project files and folders (including submodule), upload to s3, and download the files/folders into the server. This is because CodeDeploy only pulls from repo, but doesn't copy the repo itself, so we can't run git submodule update --init in the .sh script. (Pull Request #23)

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

## ERA5 Notes

- The script will accept a competition unit id, startTime, and endTime of the competition in `yyyymmddHHMMSS` format. It will then loop every 1h increment from the start to end, and call the cds api library that will be downloaded to the filesystem. Our node Slicer should then process it like any other grib and upload it to s3.
- Need to run the python script using "python3.6 pyscripts/downloadERA5.py [competitionUnitId] [startTime] [endTime]"
- Using python xxxx triggers an error of no module named socket when using the cdsapi package and I can't seem to find the solution. `pip install cdsapi` works but it installed to the conda env python, while
  `pip3 install cdsapi` is directed to the python3.6, so using that works. It's like are 3 python that can be used in this image and the one that work is the python3.6. The main python (in `/usr/bin/python`) might also work, but I'm not too familiar with the pip tools to install the cdsapi, pip3 and pip is installing for the other 2 python which is confusing.
- Sliced JSONs will use the ECMWF short codes, including the 5 parameters that are automatically converted by `wgrib2` to prevent confusion between variables. (Reference: https://apps.ecmwf.int/codes/grib/param-db?filter=All)
- Scheduled job will run everyday, on 0:15 UTC time, slicing for races that finished 7 days ago.

## Sandboxed Slicer Process

According to the bullmq's documentation, the concurrency is only possible when workers perform asynchronous operations (call to db, or external http service) (Reference: https://docs.bullmq.io/guide/workers/concurrency). Since our slicer are also using grib tools that might be CPU intensive, it is recommended to use Sandboxed processors. This will spawn a separate process (`ps -aux` will show more processes other than the main node process), and it might not be killed properly in development mode (where the process might be restarted multiple times due to watching changes) and shooting up the ram usage.
Notes:

- Sandboxed processor job won't have access to some of the functionality (e.g. no `job.update()`) or props (e.g. `progress` which in sandboxed job, becomes a function that is deprecated and will be removed in future versions) of regular job.

## Backfilling Races Sliced Weather

- Backfilling all races (except imported tracks) will be done by the scheduled task every 30 mins, which will enqueue more races when there are low number of races pending for slicing in queue.
- Any races that has all the required fields for slicing will be included, excluding races that has failed before, or skipped because of too large or other reasons.
