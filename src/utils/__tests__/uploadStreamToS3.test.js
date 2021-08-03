const AWS = require('aws-sdk');
const stream = require('stream');

const uploadStreamToS3 = require('../uploadStreamToS3');

jest.mock('aws-sdk', () => {
  const mockS3Instance = {
    upload: jest.fn().mockReturnThis(),
    promise: jest.fn(),
  };
  return { S3: jest.fn(() => mockS3Instance) };
});

describe('Create upload stream to s3', () => {
  let s3;
  beforeAll(() => {
    s3 = new AWS.S3();
  });
  afterAll(() => {
    jest.resetAllMocks();
  });
  it('should create a passthrough stream and promise', async () => {
    const mockPromise = new Promise((resolve, reject) => {
      // mock a response from s3 after done uploading
      setTimeout(() => {
        resolve({
          Location: 'https://s3.aws.com/bucketName/path/to/file.txt',
          ETag: 'etag',
          Bucket: 'bucketName',
          Key: 'path/to/file.txt',
        });
      }, 100);
    });

    s3.promise.mockResolvedValueOnce(mockPromise);
    const { writeStream, uploadPromise } = uploadStreamToS3(
      'path/to/file.txt',
      'bucketName',
    );
    expect(writeStream).toBeInstanceOf(stream.PassThrough);
    const result = await uploadPromise;
    expect(result).toEqual({
      Location: 'https://s3.aws.com/bucketName/path/to/file.txt',
      ETag: 'etag',
      Bucket: 'bucketName',
      Key: 'path/to/file.txt',
    });
  });
});
