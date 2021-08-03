const fs = require('fs');
const childProcess = require('child_process');

const sliceGribByPoint = require('../sliceGribByPoint');

jest.mock('fs');
jest.mock('child_process', () => {
  return {
    execSync: jest
      .fn()
      .mockReturnValueOnce(
        `1:0:vt=20210616010000:UGRD:10 m above ground:lon=5.000000,lat=53.000000,val=-4.51266\n2:1687319:vt=20210616010000:VGRD:10 m above ground:lon=5.000000,lat=53.000000,val=2.07934\n`,
      )
      .mockReturnValueOnce(
        `1:0:vt=20210616010000:UGRD:10 m above ground:lon=359.000000,lat=53.000000,val=-4.51266\n2:1687319:vt=20210616010000:VGRD:10 m above ground:lon=359.000000,lat=53.000000,val=2.07934\n`,
      ),
  };
});

describe('Slice grib file for data closest to a point', () => {
  afterEach(async () => {
    jest.resetAllMocks();
  });
  it('should successfully extract data from gribs', async () => {
    const result = sliceGribByPoint(
      {
        type: 'Point',
        geometry: {
          coordinates: [5, 53],
        },
      },
      'large.grib2',
    );

    expect(childProcess.execSync).toHaveBeenCalledTimes(1);
    expect(childProcess.execSync.mock.calls[0]).toEqual([
      `wgrib2 large.grib2 -VT -var -lev -lon 5 53`,
    ]);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        features: [
          {
            properties: { UGRD: -4.51266, VGRD: 2.07934 },
            geometry: { coordinates: [5, 53], type: 'Point' },
            type: 'Feature',
          },
        ],
        properties: { level: '10 m above ground', time: '2021-06-16 01:00:00' },
        type: 'FeatureCollection',
      },
    ]);

    // For minus longitude
    const resultCase2 = sliceGribByPoint(
      {
        type: 'Point',
        geometry: {
          coordinates: [-1, 53],
        },
      },
      'large.grib2',
    );

    expect(childProcess.execSync).toHaveBeenCalledTimes(2);
    expect(childProcess.execSync.mock.calls[1]).toEqual([
      `wgrib2 large.grib2 -VT -var -lev -lon -1 53`,
    ]);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    expect(resultCase2).toEqual([
      {
        features: [
          {
            properties: { UGRD: -4.51266, VGRD: 2.07934 },
            geometry: { coordinates: [-1, 53], type: 'Point' },
            type: 'Feature',
          },
        ],
        properties: { level: '10 m above ground', time: '2021-06-16 01:00:00' },
        type: 'FeatureCollection',
      },
    ]);
  });
});
