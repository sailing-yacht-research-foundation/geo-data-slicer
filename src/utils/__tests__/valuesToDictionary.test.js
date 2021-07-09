const valuesToDictionary = require('../valuesToDictionary');

describe('Function to assoc values of ship report', () => {
  it('should correctly parse ship report', () => {
    const reports = [
      'SHIP    HOUR  LAT    LON WDIR  WSPD   GST  WVHT   DPD   PRES  PTDY  ATMP  WTMP  DEWP   VIS  TCC  S1HT  S1PD  S1DIR  S2HT  S2PD  S2DIR'.split(
        /[ ,]+/,
      ),
      'SHIP     04  47.6  -59.1  350   1.9     -     -     -  30.31 +0.01  47.7     -  36.1     -    -     -     -      -     -     -      -  ---- -----'.split(
        /[ ,]+/,
      ),
      'SHIP     04  47.6  -52.7  220   2.9     -     -     -  30.35 +0.03  47.8     -  42.8     -    -     -     -      -     -     -      -  ---- -----'.split(
        /[ ,]+/,
      ),
    ];
    expect(valuesToDictionary(reports[1])).toEqual({
      source: 'SHIP',
      hour: 4,
      lat: 47.6,
      lon: -59.1,
      twd_degrees: 350,
      tws_kts: 1.9,
      gust_kts: null,
      waveheight_ft: null,
    });
  });
});
