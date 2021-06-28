function format(valuesDictionary) {
  var count = 0;
  Object.keys(valuesDictionary).forEach((key) => {
    // Skip the first value since it's "ship"
    if (count > 0) {
      try {
        valuesDictionary[key] = parseFloat(valuesDictionary[key]);
      } catch (err) {
        valuesDictionary[key] = null;
      }
      if (isNaN(valuesDictionary[key])) {
        valuesDictionary[key] = null;
      }
    }
    count++;
  });
}
function valuesToDictionary(values) {
  const valuesDictionary = {
    source: values[0],
    hour: values[1],
    lat: values[2],
    lon: values[3],
    twd_degrees: values[4],
    tws_kts: values[5],
    gust_kts: values[6],
    waveheight_ft: values[7],
  };
  format(valuesDictionary);
  return valuesDictionary;
}

module.exports = valuesToDictionary;
