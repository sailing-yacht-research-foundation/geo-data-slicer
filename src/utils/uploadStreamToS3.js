const stream = require('stream');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

function uploadStreamToS3(fileName, bucket) {
  const passThrough = new stream.PassThrough();

  const uploadPromise = s3
    .upload({
      Bucket: bucket,
      Key: fileName,
      Body: passThrough,
    })
    .promise();

  return { writeStream: passThrough, uploadPromise };
}

module.exports = uploadStreamToS3;
