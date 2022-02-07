function parseCsvData(csvData) {
  const data = [];
  csvData.split('\n').forEach((line) => {
    const lineComponents = line.split(',');
    if (lineComponents.length == 7) {
      data.push({
        time: lineComponents[1], // 0 is reference time
        variable: lineComponents[2].replace(/"/gm, ''),
        level: lineComponents[3],
        lon: lineComponents[4],
        lat: lineComponents[5],
        value: parseFloat(lineComponents[6]),
      });
    }
  });

  return data;
}

module.exports = parseCsvData;
