const stream = require('stream');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});
const bucketName = process.env.AWS_S3_BUCKET;

function uploadStreamToS3(fileName) {
  var passThrough = new stream.PassThrough();

  const uploadPromise = s3
    .upload({
      Bucket: bucketName,
      Key: fileName,
      Body: passThrough,
    })
    .promise();

  return { writeStream: passThrough, uploadPromise };
}

module.exports = uploadStreamToS3;
