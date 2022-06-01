const AWS = require('aws-sdk');
const fs = require('fs');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

async function downloadFromS3(bucket, key, downloadPath) {
  let params = {
    Bucket: bucket,
    Key: key,
  };

  return new Promise((resolve, reject) => {
    let file = fs.createWriteStream(downloadPath);
    const data = s3.getObject(params).createReadStream();
    const errorHandler = (err) => {
      file.destroy();
      reject(err);
    };
    data
      .on('error', errorHandler)
      .pipe(file)
      .on('error', errorHandler)
      .on('finish', () => {
        resolve(true);
      });
  });
}

module.exports = downloadFromS3;
