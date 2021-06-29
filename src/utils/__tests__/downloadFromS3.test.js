const fs = require('fs');
const AWS = require('aws-sdk');
const { PassThrough } = require('stream');

const downloadFromS3 = require('../downloadFromS3');

jest.mock('aws-sdk', () => {
  const mockS3Instance = {
    getObject: jest.fn().mockReturnThis(),
    createReadStream: jest.fn(),
  };
  return { S3: jest.fn(() => mockS3Instance) };
});
jest.mock('fs');

describe('Function to download file from S3', () => {
  let s3;
  beforeAll(() => {
    s3 = new AWS.S3();
  });
  afterAll(() => {
    jest.resetAllMocks();
  });
  it('should reject when the writing stream error', async () => {
    s3.createReadStream.mockReturnValueOnce(new PassThrough());

    const mockWriteable = new PassThrough();
    const mockFilePath = '/mockFile.txt';
    const mockError = new Error('Mocked Error Here!');

    fs.createWriteStream.mockReturnValueOnce(mockWriteable);

    const thePromise = downloadFromS3('bucket', 'key', mockFilePath);
    setTimeout(() => {
      mockWriteable.emit('error', mockError);
    }, 100);

    await expect(thePromise).rejects.toEqual(mockError);
  });

  it('should reject when the reading stream error', async () => {
    const mockReadable = new PassThrough();
    s3.createReadStream.mockReturnValueOnce(mockReadable);

    const mockWriteable = new PassThrough();
    const mockFilePath = '/mockFile.txt';
    const mockError = new Error('Mocked Error Here!');

    fs.createWriteStream.mockReturnValueOnce(mockWriteable);

    const thePromise = downloadFromS3('bucket', 'key', mockFilePath);
    setTimeout(() => {
      mockReadable.emit('error', mockError);
      mockReadable.emit('end');
    }, 100);

    await expect(thePromise).rejects.toEqual(mockError);
  });

  it('should resolves if the data writes successfully', async () => {
    const mockReadable = new PassThrough();
    s3.createReadStream.mockReturnValueOnce(mockReadable);

    const mockWriteable = new PassThrough();
    const mockFilePath = '/mockFile.txt';

    fs.createWriteStream.mockReturnValueOnce(mockWriteable);

    const thePromise = downloadFromS3('bucket', 'key', mockFilePath);

    setTimeout(() => {
      mockReadable.emit('data', 'beep!');
      mockReadable.emit('data', 'boop!');
      mockReadable.emit('end');
    }, 100);

    await expect(thePromise).resolves.toEqual(true);
  });
});
