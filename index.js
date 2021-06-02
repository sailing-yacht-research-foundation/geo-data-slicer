var express = require("express");
const execSync = require('child_process').execSync;
const turf = require('@turf/turf');
const axios = require('axios').default
const fs = require('fs');

const LONGITUDE_CONVENTION = {ZERO_TO_THREE_SIXTY:'0to360', NEGATIVE_ONE_EIGHTY_TO_ONE_EIGHTY:'-180to180'}
const SPATIAL_RESOLUTION_UNITS = {DEGREES:'degrees'}
const TEMPORAL_RESOLUTION_UNITS = {HOURS:3600000}
const DAYS_PER_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const ARCHIVE_TIME_UNITS = {DAYS:'days'} // The units used when an archive says it keeps data stored for n units. For example, an archive may hold the last 6 days of data. In that case the units are days.

// R%R% is the release hour (ex 06, or 18)
// T%T%T% is the timestep number, for instance 000 for the h0, or 180 for the 180th timestep in the future (hour)
// Y%Y%Y%Y% is year
// M%M% is month
// D%D% is day
const GLOBAL_MODEL_SOURCES_NOW = {
    GFS:{name:'GFS', 
        longitude_convention: LONGITUDE_CONVENTION.ZERO_TO_THREE_SIXTY, 
        url_supports_spatial_slicing: true,
        csv_order:{level:3, lon:4, lat:5, variable:2, date:0, value:6},
        spatial_resolution:0.25, 
        spatial_resolution_units:SPATIAL_RESOLUTION_UNITS.DEGREES, 
        release_times_utc:['00','06','12','18'], 
        timestep_resolution: 1, 
        timestep_miliseconds: TEMPORAL_RESOLUTION_UNITS.HOURS, 
        max_timesteps:120,
        archive_time_units: ARCHIVE_TIME_UNITS.DAYS,
        number_of_time_units_on_file: 9,
        file_url:'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25_1hr.pl?file=gfs.tR%R%z.pgrb2.0p25.fT%T%T%&lev_10_m_above_ground=on&var_UGRD=on&var_VGRD=on&subregion=&leftlon=LEFT_LON&rightlon=RIGHT_LON&toplat=TOP_LAT&bottomlat=BOTTOM_LAT&dir=%2Fgfs.Y%Y%Y%Y%M%M%D%D%%2FR%R%%2Fatmos'}
}


// 40 to 84.7	140 to 244.7	0.3 x 0.3	rtofs_glo.t00z.Axxx_alaska_std.grb2
// Arctic	60 to 79.92	160 to 235.92	0.08 x 0.08	rtofs_glo.t00z.Axxx_arctic_std.grb2
// Bering	40 to 67.12	155 to 210.92	0.08 x 0.08	rtofs_glo.t00z.Axxx_bering_std.grb2
// Guam	0 to 29.92	130 to 179.92	0.08 x 0.08	rtofs_glo.t00z.Axxx_guam_std.grb2
// Gulf of Alaska	40 to 62	195 to 236	0.5 x 0.5	rtofs_glo.t00z.Axxx_gulf_alaska_std.grb2
// Honolulu	0 to 39.92	180 to 229.92	0.08 x 0.08	rtofs_glo.t00z.Axxx_honolulu_std.grb2
// Samoa	-30 to -0.08	170 to 214.72	0.08 x 0.08	rtofs_glo.t00z.Axxx_samoa_std.grb2
// Tropical Pacific	-40 to 39	130 to 249	1 x 1	rtofs_glo.t00z.Axxx_trop_paci_lowres_std.grb2
// Western Atlantic	10 to 44.72	260 to 305.92	0.08 x 0.08	rtofs_glo.t00z.Axxx_west_atl_std.grb2
// Western Conus	10 to 59.92	210 to 259.92	0.08 x 0.08	rtofs_glo.t00z.Axxx_west_conus_std.grb2
const REGIONAL_MODEL_SOURCES_NOW = {
    RTOFS_FORECAST_ALASKA : {},
    RTOFS_FORECAST_BERING : {},
    RTOFS_FORECAST_GUAM : {},
    RTOFS_FORECAST_ALASKA_GULF : {},
    RTOFS_FORECAST_ARCTIC : {},
    RTOFS_FORECAST_HONULULU : {},
    RTOFS_FORECAST_SAMOA : {},
    RTOFS_FORECAST_TROPICAL_PACIFIC : {},
    RTOFS_FORECAST_WESTERN_ATLANTIC : {},
    RTOFS_FORECAST_WESTERN_CONUS : {},
    RTOFS_NOWCAST_ALASKA : {},
    RTOFS_NOWCAST_BERING : {},
    RTOFS_NOWCAST_GUAM : {},
    RTOFS_NOWCAST_ALASKA_GULF : {},
    RTOFS_NOWCAST_ARCTIC : {},
    RTOFS_NOWCAST_HONULULU : {},
    RTOFS_NOWCAST_SAMOA : {},
    RTOFS_NOWCAST_TROPICAL_PACIFIC : {},
    RTOFS_NOWCAST_WESTERN_ATLANTIC : {},
    RTOFS_NOWCAST_WESTERN_CONUS : {},
    
    
    
}

function padZeros(numSpaces, positiveInteger){
    const integer = positiveInteger
    var prefix = ''
    for(zeroCounter = 1; zeroCounter <= numSpaces; zeroCounter++){
        prefix = prefix + '0'
    }

    var integerDigits = 0
    if(integer < 10 && integer >= 0){
        integerDigits = 1
    }else if(integer >= 10 && integer < 100){
        integerDigits = 2
    }else if(integer >= 100 && integer < 1000){
        integerDigits = 3
    }else{
        return integer.toString()
    }

    var result = prefix.substr(0, prefix.length - integerDigits) + integer.toString()
    return result
}



function getURLSForDay(day, month, year, model, leftLon, rightLon, topLat, bottomLat){
    const urls = []
    const dayString = padZeros(2, day)
    const monthString = padZeros(2, month)
    const yearString = padZeros(4, year)

    model.release_times_utc.forEach(releaseTimeString => {
        const url = model.file_url
        const hour = parseInt(releaseTimeString)
        const dateAvailable = new Date(year, month - 1, day, hour)
        const availableTime = dateAvailable.getTime()

        for(timestepIndex = 0; timestepIndex <= (model.timestep_resolution*model.max_timesteps); timestepIndex += model.timestep_resolution){
            const paddedTimestep = padZeros(3, timestepIndex)
           
            const formattedUrl = url.replaceAll('Y%Y%Y%Y%', yearString).replaceAll('M%M%', monthString).replaceAll('D%D%', dayString).replaceAll('R%R%', releaseTimeString).replaceAll('T%T%T%', paddedTimestep).replaceAll('LEFT_LON',leftLon.toString()).replaceAll('RIGHT_LON', rightLon.toString()).replaceAll('TOP_LAT', topLat.toString()).replaceAll('BOTTOM_LAT', bottomLat.toString())
            const startTime = availableTime + (timestepIndex * model.timestep_miliseconds)
            const timeSliceStart = new Date(startTime)
            const endTime = startTime + (model.timestep_resolution * model.timestep_miliseconds)
            const timeSliceEnd = new Date(endTime)

            urls.push({releaseTime:dateAvailable, startTime: timeSliceStart, endTime: timeSliceEnd, url: formattedUrl})
        }
    })

    return urls
}


function dateToUTCDate(date){
    return new Date(date.toISOString())
}

class SpatialBounds {
    constructor(leftLon, rightLon, topLat, bottomLat){

        // TODO: Make sure it makes sense - meaning we don't have longitudes > 180 or 360. or latitudes < -90

        this.leftLon = leftLon
        this.rightLon = rightLon
        this.topLat = topLat
        this.bottomLat = bottomLat

    }

    // getLeftLon(longitudeConvention){
    //     if(longitudeConvention === LONGITUDE_CONVENTION.NEGATIVE_ONE_EIGHTY_TO_ONE_EIGHTY){
    //         if(this.leftLon < 0){

    //         }
    //     }
    // }
}

function buildUrls(targetStartDateTimeUTC, targetEndDateTimeUTC, spatialBounds){
    
    const startDate = dateToUTCDate(targetStartDateTimeUTC)
    const startYear = startDate.getUTCFullYear()
    const startMonth = startDate.getUTCMonth() + 1
    const startDay = startDate.getUTCDate()
    const startHour = startDate.getUTCHours()

    const endDate = dateToUTCDate(targetEndDateTimeUTC)
    const endYear = endDate.getUTCFullYear()
    const endMonth = endDate.getUTCMonth() + 1
    const endDay = endDate.getUTCDate()
    const endHour = endDate.getUTCHours()


    // Get global models first.
    const globalModelKeys = Object.keys(GLOBAL_MODEL_SOURCES_NOW)
    var globalModelUrls = []
    globalModelKeys.forEach(key => {
        const model = GLOBAL_MODEL_SOURCES_NOW[key]

        var yearCounter = startYear
        var monthCounter = startMonth
        var dayCounter = startDay

        while(yearCounter <= endYear){

            if(yearCounter < endYear){
                while(monthCounter <= 12){
                     while(dayCounter < DAYS_PER_MONTH[monthCounter]){
                        
                        globalModelUrls = globalModelUrls.concat(getURLSForDay(dayCounter, monthCounter, yearCounter, model, spatialBounds.leftLon, spatialBounds.rightLon, spatialBounds.topLat, spatialBounds.bottomLat))
                        dayCounter += 1
                    }
                    montCounter += 1
                    dayCounter = 1
                }
            }else{
                while(monthCounter <= endMonth){
                    if(monthCounter < endMonth){
                        while(dayCounter <= DAYS_PER_MONTH[monthCounter]){
                            globalModelUrls = globalModelUrls.concat(getURLSForDay(dayCounter, monthCounter, yearCounter, model, spatialBounds.leftLon, spatialBounds.rightLon, spatialBounds.topLat, spatialBounds.bottomLat))
                            dayCounter += 1
                        }

                    }else{
                        while(dayCounter <= endDay){
                            globalModelUrls = globalModelUrls.concat(getURLSForDay(dayCounter, monthCounter, yearCounter, model, spatialBounds.leftLon, spatialBounds.rightLon, spatialBounds.topLat, spatialBounds.bottomLat))
                            dayCounter += 1
                        }
                    }
                   
                    monthCounter +=1
                    dayCounter = 1
                }
            }
            yearCounter += 1
            monthCounter = 1
        }

    })

    return globalModelUrls
}

function gribToGeoJson(grib, levels, variables){
    const pointsJsons = []
    // TODO create separate geojsons for each level and variable. 
    Object.keys(grib).forEach(point => {
        const properties = grib[point]
        pointsJsons.push(turf.point(JSON.parse(point), properties))
    })
    return turf.featureCollection(pointsJsons)
}

function processGrib(csvFilename, csvOrder){
    const file = fs.readFileSync(csvFilename).toString('utf-8')
      const lines = file.split("\n")
      const points = {}
      const levels = []
      const variables = []
      lines.forEach(line => {
          const row = line.split(',')
          const level = row[csvOrder.level]
          if(!levels.includes(level)){
              levels.push(level)
          }

          const lon = parseFloat(row[csvOrder.lon])
          const lat = parseFloat(row[csvOrder.lat])
          const variable = row[csvOrder.variable]
          if(!variables.includes(variable)){
              variables.push(variable)
          }
          const date = row[csvOrder.date]
          const value = parseFloat(row[csvOrder.value])
          if(row[4] !== null && row[5] !== null && row[4] !== undefined && row[5] !== undefined){
            const pointString = JSON.stringify([lon, lat])
            if(points[pointString] === undefined){
                points[pointString] = {}

            }
            if(points[pointString][level] === undefined){
                points[pointString][level] = {}
            }

            if(points[pointString][level][variable] === undefined){
                points[pointString][level][variable] = []
            }

            points[pointString][level][variable].push({date:(new Date(date)).getTime(), value:value})
          }
          
      })

      // Sort all points by time.
      Object.keys(points).forEach(point => {
          Object.keys(points[point]).forEach(level => {
            Object.keys(points[point][level]).forEach(variable => {
                points[point][level][variable] = points[point][level][variable].sort(function(a,b) {
                    return (b.date - a.date)
                });
            })
          })
      })
      const json = gribToGeoJson(points)
      fs.writeFileSync('geojson.json', JSON.stringify(json))
     // code = execSync('node -v');
}

function grabGrib(fileUrl){
    try{
        const binaryData = axios.get(fileUrl,  {
            responseType: 'arraybuffer'
        })
    .then(function (response) {
      // handle success
    //   var buf = Buffer.from(response.data);
    //   fs.writeFileSync('gfs.grib', buf, 'base64');
    //   execSync('wgrib2 gfs.grib -small_grib -186:-184 -37.86:-35 subregion.grib')
    //   execSync('wgrib2 subregion.grib -csv subregion.csv')
      
    })
    }catch(err){
        console.log(fileUrl)
    }
}

// const today = new Date()
// const twoDaysAgo = new Date(today.getTime() - (2 * 24 * 60 * 60 * 1000));
// const urls = buildUrls(twoDaysAgo, today, new SpatialBounds(0,360, 90, -90))

// grabGrib(urls[0].url)

processGrib('subregion.csv', GLOBAL_MODEL_SOURCES_NOW.GFS.csv_order)

// First arg is the input file path, second arg is CLI options as JS object
// grib2json('gfs.grib', {
//   data: true,
//   output: 'output.json'
// })
// .then(function (json) {
//   // Do whatever with the json data, same format as output of the CLI
// })

// var app = express();
// app.listen(3000, () => {
//  console.log("Server running on port 3000");
// });

//buildUrls(dateToUTCDate(new Date()), dateToUTCDate(new Date()))
//grabGrib('https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_1p00.pl?file=gfs.t00z.pgrb2.1p00.f000&lev_10_m_above_mean_sea_level=on&var_UGRD=on&var_U-GWD=on&leftlon=0&rightlon=360&toplat=90&bottomlat=-90&dir=%2Fgfs.20210531%2F00%2Fatmos')
//grabGrib('https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/gfs.20210524/00/atmos/gfs.t00z.pgrb2.0p50.f033')
// app.get("/", (req, res, next) => {
//     res.json(["Tony","Lisa","Michael","Ginger","Food"]);
// });