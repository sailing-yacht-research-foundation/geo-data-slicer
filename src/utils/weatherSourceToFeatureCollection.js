const turf = require('@turf/turf');

const isNumber = require('./isNumber');

function weatherSourceToFeatureCollection(sourceList) {
  const points = [];
  sourceList.forEach((p) => {
    /* 
        // There's an error "coordinates must contain numbers" thrown each time because of this data:
        {
          source: 'SHIP',
          hour: null,
          lat: null,
          lon: null,
          twd_degrees: null,
          tws_kts: null,
          gust_kts: null,
          waveheight_ft: null
        }
      */
    if (isNumber(p.lon) && isNumber(p.lat)) {
      const point = turf.point([p.lon, p.lat], p);
      points.push(point);
    }
  });
  return turf.featureCollection(points);
}

module.exports = weatherSourceToFeatureCollection;
