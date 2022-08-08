const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const childProcess = require('child_process');

const sliceGribByRegion = require('../sliceGribByRegion');
const csvToGeoJson = require('../csvToGeoJson');

jest.mock('fs', () => {
  return {
    ...jest.requireActual('fs'),
    unlink: jest.fn((command, callback) => {
      callback(null, true);
    }),
  };
});
jest.mock('child_process', () => {
  return {
    exec: jest.fn((command, callback) => {
      callback(null, true);
    }),
  };
});
jest.mock('../csvToGeoJson');
jest.mock('../../logger');

describe('Slice grib files into smaller grib and extract the values', () => {
  afterAll(async () => {
    jest.resetAllMocks();
  });
  afterEach(async () => {
    jest.clearAllMocks();
  });
  it('should successfully extract data and keep vector data together', async () => {
    const operatingFolder = path.resolve(__dirname, `../../operating_folder/`);

    const runtime = '2021-06-16 01:00:00+00';
    csvToGeoJson.mockResolvedValueOnce({
      runtimes: [runtime],
      variablesToLevel: new Map([
        ['uvgrd', ['10 m above ground']],
        ['uvogrd', ['10 m above ground']],
        ['GUST', ['10 m above ground']],
      ]),
      geoJsons: [],
    });

    const originalFileName = 'large.grib2';
    const fileID = uuid.v4();
    const result = await sliceGribByRegion([5, 53, 6, 54], originalFileName, {
      folder: operatingFolder,
      fileID,
      model: 'GFS',
      searchStartTime: Date.now(),
      searchEndTime: Date.now(),
      sliceJson: true,
    });

    const expectedFilterTime = '20210616010000';
    // Require expect.any(Function), exec is promisified
    expect(childProcess.exec.mock.calls[0]).toEqual([
      `wgrib2 large.grib2  -small_grib 5:6 53:54 ${operatingFolder}/small_${fileID}.grib2`,
      expect.any(Function),
    ]);
    expect(childProcess.exec.mock.calls[1]).toEqual([
      `wgrib2 ${operatingFolder}/small_${fileID}.grib2 -csv ${operatingFolder}/${fileID}.csv`,
      expect.any(Function),
    ]);
    expect(childProcess.exec).toHaveBeenCalledTimes(5);
    expect(childProcess.exec.mock.calls).toEqual(
      expect.arrayContaining([
        [
          `wgrib2 large.grib2  -small_grib 5:6 53:54 ${operatingFolder}/small_${fileID}.grib2`,
          expect.any(Function),
        ],
        [
          `wgrib2 ${operatingFolder}/small_${fileID}.grib2 -csv ${operatingFolder}/${fileID}.csv`,
          expect.any(Function),
        ],
        [
          `wgrib2 ${operatingFolder}/small_${fileID}.grib2 -Match_inv -match ":(GUST):(10 m above ground):" -match ":start_FT=${expectedFilterTime}:" -grib_out ${operatingFolder}/${fileID}_GUST_${expectedFilterTime}_10_m_above_ground.grib2`,
          expect.any(Function),
        ],
        [
          `wgrib2 ${operatingFolder}/small_${fileID}.grib2 -Match_inv -match ":(UGRD|VGRD):(10 m above ground):" -match ":start_FT=${expectedFilterTime}:" -grib_out ${operatingFolder}/${fileID}_uvgrd_${expectedFilterTime}_10_m_above_ground.grib2`,
          expect.any(Function),
        ],
        [
          `wgrib2 ${operatingFolder}/small_${fileID}.grib2 -Match_inv -match ":(UOGRD|VOGRD):(10 m above ground):" -match ":start_FT=${expectedFilterTime}:" -grib_out ${operatingFolder}/${fileID}_uvogrd_${expectedFilterTime}_10_m_above_ground.grib2`,
          expect.any(Function),
        ],
      ]),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      originalFileName,
      expect.any(Function),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      `${operatingFolder}/${fileID}.csv`,
      expect.any(Function),
    );
    expect(fs.unlink).toHaveBeenCalledWith(
      `${operatingFolder}/small_${fileID}.grib2`,
      expect.any(Function),
    );
    expect(result).toEqual({
      slicedGribs: [
        {
          filePath: `${operatingFolder}/${fileID}_uvgrd_${expectedFilterTime}_10_m_above_ground.grib2`,
          variables: ['UGRD', 'VGRD'],
          levels: ['10 m above ground'],
          runtimes: [runtime],
        },
        {
          filePath: `${operatingFolder}/${fileID}_uvogrd_${expectedFilterTime}_10_m_above_ground.grib2`,
          variables: ['UOGRD', 'VOGRD'],
          levels: ['10 m above ground'],
          runtimes: [runtime],
        },
        {
          filePath: `${operatingFolder}/${fileID}_GUST_${expectedFilterTime}_10_m_above_ground.grib2`,
          variables: ['GUST'],
          levels: ['10 m above ground'],
          runtimes: [runtime],
        },
      ],
      geoJsons: [],
    });
  });

  it('should skip json slice, but keep extract metadata from csv when sliceJson parameter is false', async () => {
    const operatingFolder = path.resolve(__dirname, `../../operating_folder/`);

    const runtime = '2021-06-16 01:00:00+00';
    csvToGeoJson.mockResolvedValueOnce({
      runtimes: [runtime],
      variablesToLevel: new Map([
        ['uvgrd', ['10 m above ground']],
        ['uvogrd', ['10 m above ground']],
        ['GUST', ['10 m above ground']],
      ]),
      geoJsons: [],
    });

    const originalFileName = 'large.grib2';
    const fileID = uuid.v4();

    childProcess.exec.mockImplementation((command, callback) => {
      callback(null, { stdout: 'lat 1\nlon 2\n' });
    });
    await sliceGribByRegion([5, 53, 6, 54], originalFileName, {
      folder: operatingFolder,
      fileID,
      model: 'GFS',
      searchStartTime: Date.now(),
      searchEndTime: Date.now(),
      sliceJson: false,
    });

    expect(childProcess.exec.mock.calls[0]).toEqual([
      `wgrib2 large.grib2  -small_grib 5:6 53:54 ${operatingFolder}/small_${fileID}.grib2`,
      expect.any(Function),
    ]);
    expect(childProcess.exec.mock.calls[1]).toEqual([
      `wgrib2 ${operatingFolder}/small_${fileID}.grib2 -V -d 1`,
      expect.any(Function),
    ]);
    expect(childProcess.exec.mock.calls[2]).toEqual([
      `wgrib2 ${operatingFolder}/small_${fileID}.grib2  -small_grib 2:2 1:1 ${operatingFolder}/sampling_${fileID}.grib2`,
      expect.any(Function),
    ]);
    expect(childProcess.exec.mock.calls[3]).toEqual([
      `wgrib2 ${operatingFolder}/sampling_${fileID}.grib2 -csv ${operatingFolder}/${fileID}.csv`,
      expect.any(Function),
    ]);
  });
});
