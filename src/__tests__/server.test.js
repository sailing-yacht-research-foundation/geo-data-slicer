const supertest = require('supertest');

const createServer = require('../server');
const processRegionRequest = require('../services/processRegionRequest');
const processPointRequest = require('../services/processPointRequest');

jest.mock('../services/processRegionRequest', () => jest.fn());
jest.mock('../services/processPointRequest', () => jest.fn());

describe('HTTP Server for Geo Data Slicer', () => {
  let app;
  beforeAll(() => {
    app = createServer();
  });
  afterAll(async () => {
    jest.resetAllMocks();
  });

  test('GET / [Base endpoint]', (done) => {
    supertest(app)
      .get('/')
      .expect(200)
      .then((response) => {
        expect(response.text).toBe('SYRF - Geo Data Slicer');
        done();
      });
  });

  test('GET /health [Health Check]', (done) => {
    supertest(app)
      .get('/health')
      .expect(200)
      .then((response) => {
        const data = JSON.parse(response.text);
        expect(data).toMatchObject({
          message: 'OK',
        });
        expect(typeof data.timestamp).toBe('number');
        done();
      });
  });

  test('POST /api/v1 [Weather for Region of Interest] - Missing Required Fields', (done) => {
    supertest(app)
      .post('/api/v1')
      .send({})
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message:
              'Fields required: roi, startTimeUnixMS, endTimeUnixMS, payload',
          }),
        );
        done();
      });

    supertest(app)
      .post('/api/v1')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-4.625244140625, 53.28492154619624],
                [-2.98828125, 53.28492154619624],
                [-2.98828125, 54.28446875235516],
                [-4.625244140625, 54.28446875235516],
                [-4.625244140625, 53.28492154619624],
              ],
            ],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
        webhookToken: 'webhookToken',
        updateFrequencyMinutes: 60,
        payload: {
          data: 'random stuff',
        },
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Payload defined, required: raceID',
          }),
        );
        done();
      });

    supertest(app)
      .post('/api/v1')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-4.625244140625, 53.28492154619624],
                [-2.98828125, 53.28492154619624],
                [-2.98828125, 54.28446875235516],
                [-4.625244140625, 54.28446875235516],
                [-4.625244140625, 53.28492154619624],
              ],
            ],
          },
        },
        webhook: 'https://webhook.site/some/path',
        webhookToken: 'webhookToken',
        updateFrequencyMinutes: 60,
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Fields required: startTimeUnixMS, endTimeUnixMS, payload',
          }),
        );
        done();
      });

    supertest(app)
      .post('/api/v1')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-4.625244140625, 53.28492154619624],
                [-2.98828125, 53.28492154619624],
                [-2.98828125, 54.28446875235516],
                [-4.625244140625, 54.28446875235516],
                [-4.625244140625, 53.28492154619624],
              ],
            ],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
        payload: {
          raceID: 'random-stuff',
        },
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Invalid format: raceID',
          }),
        );
        done();
      });
  });

  test('POST /api/v1 [Weather for Region of Interest] - Invalid Fields', (done) => {
    supertest(app)
      .post('/api/v1')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [-3.6, 53.6],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Invalid roi: Wrong geometry type provided',
          }),
        );
        done();
      });

    supertest(app)
      .post('/api/v1')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-4.625244140625, 53.28492154619624],
                [-2.98828125, 53.28492154619624],
                [-2.98828125, 54.28446875235516],
                [-4.625244140625, 54.28446875235516],
                [-4.625244140625, 53.28492154619624],
              ],
            ],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
        payload: {
          raceID: 'random-stuff',
        },
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Invalid format: raceID',
          }),
        );
        done();
      });
  });

  test('POST /api/v1 [Weather for Region of Interest] - Success', async () => {
    const response = await supertest(app)
      .post('/api/v1')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-4.625244140625, 53.28492154619624],
                [-2.98828125, 53.28492154619624],
                [-2.98828125, 54.28446875235516],
                [-4.625244140625, 54.28446875235516],
                [-4.625244140625, 53.28492154619624],
              ],
            ],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
        webhookToken: 'webhookToken',
        updateFrequencyMinutes: 60,
        payload: {
          raceID: 'a1ed42f4-eb5d-4a62-8667-073ec256f6ab',
        },
      })
      .expect(200);
    expect(response.text).toBe('ok');
    expect(processRegionRequest).toHaveBeenCalledTimes(1);

    const response2 = await supertest(app)
      .post('/api/v1')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-4.625244140625, 53.28492154619624],
                [-2.98828125, 53.28492154619624],
                [-2.98828125, 54.28446875235516],
                [-4.625244140625, 54.28446875235516],
                [-4.625244140625, 53.28492154619624],
              ],
            ],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
        payload: {
          raceID: 'a1ed42f4-eb5d-4a62-8667-073ec256f6ab',
        },
      })
      .expect(200);

    expect(response2.text).toBe('ok');
    expect(processRegionRequest).toHaveBeenCalledTimes(2);
  });

  test('POST /api/v1 [Weather for Point of Interest] - Missing Required Fields', (done) => {
    supertest(app)
      .post('/api/v1/point')
      .send({})
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Fields required: point, startTimeUnixMS, endTimeUnixMS',
          }),
        );
        done();
      });
    supertest(app)
      .post('/api/v1/point')
      .send({
        point: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [-3.6, 53.6],
          },
        },
        webhook: 'https://webhook.site/some/path',
        webhookToken: 'webhookToken',
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Fields required: startTimeUnixMS, endTimeUnixMS',
          }),
        );
        done();
      });
  });

  test('POST /api/v1 [Weather for Point of Interest] - Invalid Fields', (done) => {
    supertest(app)
      .post('/api/v1/point')
      .send({
        point: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-4.625244140625, 53.28492154619624],
                [-2.98828125, 53.28492154619624],
                [-2.98828125, 54.28446875235516],
                [-4.625244140625, 54.28446875235516],
                [-4.625244140625, 53.28492154619624],
              ],
            ],
          },
        },
        webhook: 'https://webhook.site/some/path',
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Invalid point: Wrong geometry type provided',
          }),
        );
        done();
      });

    supertest(app)
      .post('/api/v1/point')
      .send({
        roi: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [-3.6, 53.6],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
        payload: {
          raceID: 'random-stuff',
        },
      })
      .expect(400)
      .then((response) => {
        expect(response.text).toBe(
          JSON.stringify({
            message: 'Invalid format: raceID',
          }),
        );
        done();
      });
  });

  test('POST /api/v1 [Weather for Point of Interest] - Success', (done) => {
    supertest(app)
      .post('/api/v1/point')
      .send({
        point: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [-3.6, 53.6],
          },
        },
        startTimeUnixMS: 1626660309015,
        endTimeUnixMS: 1626663909015,
        webhook: 'https://webhook.site/some/path',
        webhookToken: 'webhookToken',
      })
      .expect(200)
      .then((response) => {
        expect(response.text).toBe('ok');
        expect(processPointRequest).toHaveBeenCalledTimes(1);
        done();
      });
  });
});
