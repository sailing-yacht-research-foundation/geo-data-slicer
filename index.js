/** The internet provides us with 3 types of weather data:
 * 1) Data which is released on a schedule and that always covers the same geographic range.
 *          - Weather models
 * 2) Data which always covers the same geographic range, but is either not released on a schedule, is updated so frequently as to be considered "real-time", or is updated infrequently randomly.
 *          - Sail Flow
 *          - Anchored ocean buoys
 * 3) Data which does not cover the same geographic range and is not released according to any schedule. It may be real time or it may not have been updated in months.
 *          - Ship reports
 *          - Moving ocean "gliders" or drifting buoys.
 * Whereas the geo-data-archiver is concerned with the first type of data, this service is concerned with collecting the second two types for a particular race.
 * It then collects the region and time slice from the models that are archived by the geo-data-archiver, and it sends all of this data to the analytics engine.
 * 
 * This service doesn't know anything about races or sailing in particular, but it does know about weather utilities, geojson and geoindices.
 * 
 * We need to figure out how a request should work.
 */


var express = require("express");
const puppeteer = require('puppeteer');
const execSync = require('child_process').execSync;
const turf = require('@turf/turf');
const axios = require('axios').default
const ws = require('ws') 
const fs = require('fs');

const KDBush = require('kdbush');
var geokdbush = require('geokdbush');
var cities = require('all-the-cities');


async function getShipReports() {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.goto('https://www.ndbc.noaa.gov/ship_obs.php?uom=E&time=2')
    const values = await page.evaluate(()=>{
        const values = []
        document.querySelectorAll('#contentarea > pre > span').forEach(s => {values.push(s.textContent.split(/[ ,]+/))})
        return values
    })

    const valuesDictionaries = []
    var counter = 0
    values.forEach(valuesArray => {
        if(counter > 0){
            valuesDictionaries.push(valuesToDictionary(valuesArray))
        }
        counter++
    })
    await browser.close()
    return valuesDictionaries
}

function format(valuesDictionary){
    var count = 0
    Object.keys(valuesDictionary).forEach(key => {
        // Skip the first value since it's "ship"
        if(count > 0){
            try{
                valuesDictionary[key] = parseFloat(valuesDictionary[key])
            }catch(err){
                valuesDictionary[key] = null
            }
            if(isNaN(valuesDictionary[key])){
                valuesDictionary[key] = null
            }
        }
        count++
    })
}

function valuesToDictionary(values){
    const valuesDictionary =  {source:values[0], hour:values[1],  lat:values[2], lon:values[3], twd_degrees:values[4], tws_kts:values[5], gust_kts:values[6], waveheight_ft:values[7]}
    format(valuesDictionary)
    return valuesDictionary
}

function weatherSourceToFeatureCollection(sourceList){
    const points = []
    sourceList.forEach(p => {
        const point = turf.point([p.lon, p.lat], p);
        points.push(point)
    })
    return turf.featureCollection(points)
}

// We need both indices and feature collections.
// Indices do extremely fast lookups for points, 
// FeatureCollections help us find all points within a polygon.
const pointSourcesToScrape = JSON.parse(fs.readFileSync('data/dynamic_weather_sources.json', 'utf-8'))
var shipReportIndex = null
const sailFlowSpotIndex = new KDBush(pointSourcesToScrape.SAILFLOW, (v) => v.lon, (v) => v.lat )
const noaaBuoyIndex = new KDBush(pointSourcesToScrape.NOAA, (v) => v.lon, (v) => v.lat )
const windfinderIndex = new KDBush(pointSourcesToScrape.WINDFINDER, (v) => v.lon, (v) => v.lat )

var shipReportsFeatureCollection = null
const sailFlowSpotFeatureCollection = weatherSourceToFeatureCollection(pointSourcesToScrape.SAILFLOW)
const noaaBuoyFeatureCollection = weatherSourceToFeatureCollection(pointSourcesToScrape.NOAA)
const windfinderFeatureCollection = weatherSourceToFeatureCollection(pointSourcesToScrape.WINDFINDER)

getShipReports().then((values) => {
    console.log(values)
    shipReportIndex = new KDBush(values, (v) => v.lon, (v) => v.lat);
    shipReportsFeatureCollection = weatherSourceToFeatureCollection(values)
})

function makeGeoJsons(csvData){
    const lines = csvData.split('\n')
    const timeToLevelToPoints = {}
    const geoJsons = []
    const indices = {}
    lines.forEach(line => {
        const lineComponents = line.split(',')
        if(lineComponents.length == 7){
            const time1 = lineComponents[0]
            const time2 = lineComponents[1]
    
            const variable = lineComponents[2].replace(/"/gm, '')
            const level = lineComponents[3]
            const lonString = lineComponents[4]
            const latString = lineComponents[5]
            const pointHash = lonString+latString

            const lon = parseFloat(lineComponents[4])
            const lat = parseFloat(lineComponents[5])
            const value = parseFloat(lineComponents[6])

            if(timeToLevelToPoints[time1] === undefined){
                timeToLevelToPoints[time1] = {}
                indices[time1] = {}
            }


            if(timeToLevelToPoints[time1][level] === undefined){
                timeToLevelToPoints[time1][level] = {}
            }
            
            if(timeToLevelToPoints[time1][level][pointHash] === undefined){
                timeToLevelToPoints[time1][level][pointHash] = {lat:lat, lon:lon}
            }
            timeToLevelToPoints[time1][level][pointHash][variable] = value  
        }
    })
    
    Object.keys(timeToLevelToPoints).forEach(time => {
        Object.keys(timeToLevelToPoints[time]).forEach(level => {
            const geoJsonPoints = []
            const points = []
            Object.values(timeToLevelToPoints[time][level]).forEach(p => {
                try{
                    const geoJsonPoint = turf.point([p.lon, p.lat], p)
                    geoJsonPoints.push(geoJsonPoint)
                    points.push(p)
                }catch(err){

                }
            })

            const index = new KDBush(points, (v) => v.lon, (v) => v.lat )
            indices[time][level] = index
            const geoJson = turf.featureCollection(geoJsonPoints)
            geoJson.properties = {level:level.replace(/"/gm, ''), time:time.replace(/"/gm, '')}
            geoJsons.push(geoJson)
        })
    })
    return {geoJsons:geoJsons, indices:indices}
}

function sliceGribByRegion(roi, filename, model){
    // TODO: get spatial bounds from roi.
    const leftLon = -123.6621
    const rightLon = -121.3303
    const topLat = 38.6898
    const bottomLat = 37.2347

    execSync('wgrib2 ' + filename + ' -small_grib ' + leftLon +':' + rightLon + ' ' + bottomLat + ':' + topLat + ' small_grib.grib2')
    //execSync('rm ' + filename)
    execSync('wgrib2 small_grib.grib2 -csv grib.csv')
    //execSync('rm small_grib.grib2')
    const csvData = fs.readFileSync('grib.csv', 'utf-8')
    const parsedData = makeGeoJsons(csvData)
    const geoJsons = parsedData.geoJsons
    const indicies = parsedData.indices

    var counter = 0
    geoJsons.forEach(geoJson => {
        console.log(geoJson)
        if(geoJson.properties.level === '10 m above ground' || geoJson.properties.level === 'surface'){
            fs.writeFileSync(counter.toString() +  '.json', JSON.stringify(geoJson))
            counter++
        }
      
    })

}

// roi: region of interest (polygon)
function getArchivedDated(roi, startTime, endTime){
    /** TODO
     *      a) Check size of roi and react accordingly. Maybe we need a util to calculate sizes of things and adjust our approach accordingly. Maybe we need a way to just determine is roi oceanic or local.
     *      b) Query PostGIS for space and time boundaries to get a list of s3 files.
     *      c) Download said s3 files. 
     *      d) Slice GRIBs into regions using wgrib2 or cdo, then convert to geojson and (either upload gribs and geojson to s3 and save the record or send this info to the analysis engine so it can do it).
     *      e) Return with a either a list of sliced files in an s3 bucket just for sliced data, or actually return the geojson objects with time and boundary info. 
     */
}

function processRegionRequest(roi, startTimeUnixMS, endTimeUnixMS, webhook, webhookToken, updateFrequencyMinutes){
    // TODO: Figure out where to do the actual Puppeteer scraping.

    //const archivedData = getArchivedData(roi, startTimeUnixMS, endTimeUnixMS)
    const containedShipReports = turf.pointsWithinPolygon(shipReportsFeatureCollection, roi)
    const containedNoaaBuoys = turf.pointsWithinPolygon(noaaBuoyFeatureCollection, roi)
    const containedSailflowSpots = turf.pointsWithinPolygon(sailFlowSpotFeatureCollection, roi)
    const containedWindfinderPoints = turf.pointsWithinPolygon(windfinderFeatureCollection, roi)

}

function processPointRequest(point, time, webhook, webhookToken){

}

// const wss = new WebSocket.Server({
//     port: 8080,
//     perMessageDeflate: {
//       zlibDeflateOptions: {
//         // See zlib defaults.
//         chunkSize: 1024,
//         memLevel: 7,
//         level: 3
//       },
//       zlibInflateOptions: {
//         chunkSize: 10 * 1024
//       },
//       // Other options settable:
//       clientNoContextTakeover: true, // Defaults to negotiated value.
//       serverNoContextTakeover: true, // Defaults to negotiated value.
//       serverMaxWindowBits: 10, // Defaults to negotiated value.
//       // Below options specified as default values.
//       concurrencyLimit: 10, // Limits zlib concurrency for perf.
//       threshold: 1024 // Size (in bytes) below which messages
//       // should not be compressed.
//     }
// });


// wss.on('connection', function connection(ws) {
//     console.log('SERVER: connected')
    
//     ws.on('close', function close() {
    
//     })

//     ws.on('message', function incoming(data) {
        
//     })
// })

const app = express()
const port = 3000
app.use(express.json());

app.post('/', function(request, response){
    
    const roi = request.body.roi
    const startTimeUnixMS = request.body.startTimeUnixMS
    const endTimeUnixMS = request.body.endTimeUnixMS
    // Where should we send the data?
    const webhook = request.body.webhook
    const webhookToken = request.body.webhookToken

    // How often should we check the real time sources for new data?
    const updateFrequencyMinutes = request.body.updateFrequencyMinutes

    processRequest(roi, startTimeUnixMS, endTimeUnixMS, webhook, webhookToken, updateFrequencyMinutes)


});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

sliceGribByRegion(null, 'hrrr.t00z.wrfsubhf01.grib2')