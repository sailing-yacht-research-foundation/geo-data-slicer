const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const sliceGribByRegion = require('../sliceGribByRegion');

jest.mock('fs');
jest.mock('child_process', () => {
  return {
    execSync: jest.fn().mockReturnValue(true),
  };
});

describe('Slice grib files into smaller grib and extract the values', () => {
  afterEach(async () => {
    jest.resetAllMocks();
  });
  it('should successfully extract data and keep vector data together', async () => {
    const operatingFolder = path.resolve(__dirname, `../../operating_folder/`);

    const csvData = `2021-06-16 00:00:00,2021-06-16 01:00:00,UGRD,10 m above ground,5,53,-4.51266
2021-06-16 00:00:00,2021-06-16 01:00:00,UGRD,10 m above ground,5.25,53,-4.45266
2021-06-16 00:00:00,2021-06-16 01:00:00,VGRD,10 m above ground,5,53,2.07934
2021-06-16 00:00:00,2021-06-16 01:00:00,VGRD,10 m above ground,5.25,53,1.76934
2021-06-16 00:00:00,2021-06-16 01:00:00,UOGRD,10 m above ground,5,53,-4.51266
2021-06-16 00:00:00,2021-06-16 01:00:00,UOGRD,10 m above ground,5.25,53,-4.45266
2021-06-16 00:00:00,2021-06-16 01:00:00,VOGRD,10 m above ground,5,53,2.07934
2021-06-16 00:00:00,2021-06-16 01:00:00,VOGRD,10 m above ground,5.25,53,1.76934
2021-06-16 00:00:00,2021-06-16 01:00:00,GUST,10 m above ground,5,53,3
2021-06-16 00:00:00,2021-06-16 01:00:00,GUST,10 m above ground,5.25,53,3
`;
    fs.readFileSync.mockReturnValue(csvData);

    const result = sliceGribByRegion([5, 53, 6, 54], 'large.grib2', {
      folder: operatingFolder,
      fileID: 'uuid',
      model: 'GFS',
    });

    expect(childProcess.execSync.mock.calls[0]).toEqual([
      `wgrib2 large.grib2 -small_grib 5:6 53:54 ${operatingFolder}/small_uuid.grib2`,
    ]);
    expect(childProcess.execSync.mock.calls[1]).toEqual([
      `wgrib2 ${operatingFolder}/small_uuid.grib2 -csv ${operatingFolder}/uuid.csv`,
    ]);
    expect(childProcess.execSync).toHaveBeenCalledTimes(5);
    expect(childProcess.execSync.mock.calls).toEqual(
      expect.arrayContaining([
        [
          `wgrib2 large.grib2 -small_grib 5:6 53:54 ${operatingFolder}/small_uuid.grib2`,
        ],
        [
          `wgrib2 ${operatingFolder}/small_uuid.grib2 -csv ${operatingFolder}/uuid.csv`,
        ],
        [
          `wgrib2 ${operatingFolder}/small_uuid.grib2 -match ":(GUST):(10 m above ground):" -grib_out ${operatingFolder}/uuid_GUST_10_m_above_ground.grib2`,
        ],
        [
          `wgrib2 ${operatingFolder}/small_uuid.grib2 -match ":(UGRD|VGRD):(10 m above ground):" -grib_out ${operatingFolder}/uuid_uvgrd_10_m_above_ground.grib2`,
        ],
        [
          `wgrib2 ${operatingFolder}/small_uuid.grib2 -match ":(UOGRD|VOGRD):(10 m above ground):" -grib_out ${operatingFolder}/uuid_uvogrd_10_m_above_ground.grib2`,
        ],
      ]),
    );
    expect(fs.unlinkSync).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      slicedGribs: [
        {
          filePath: `${operatingFolder}/uuid_uvgrd_10_m_above_ground.grib2`,
          variables: ['UGRD', 'VGRD'],
          levels: ['10 m above ground'],
        },
        {
          filePath: `${operatingFolder}/uuid_uvogrd_10_m_above_ground.grib2`,
          variables: ['UOGRD', 'VOGRD'],
          levels: ['10 m above ground'],
        },
        {
          filePath: `${operatingFolder}/uuid_GUST_10_m_above_ground.grib2`,
          variables: ['GUST'],
          levels: ['10 m above ground'],
        },
      ],
      runtimes: ['2021-06-16 01:00:00+00'],
      geoJsons: expect.arrayContaining([
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                UGRD: -4.51266,
                VGRD: 2.07934,
              },
              geometry: {
                type: 'Point',
                coordinates: [5, 53],
              },
            },
            {
              type: 'Feature',
              properties: {
                UGRD: -4.45266,
                VGRD: 1.76934,
              },
              geometry: {
                type: 'Point',
                coordinates: [5.25, 53],
              },
            },
          ],
          properties: {
            level: '10 m above ground',
            time: '2021-06-16 01:00:00',
          },
        },
      ]),
    });
  });
});
