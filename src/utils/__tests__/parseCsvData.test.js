const parseCsvData = require('../parseCsvData');

describe('Function to parse csv to processable data', () => {
  it('should convert csv to json data', () => {
    const csvData = `2021-06-24 18:00:00,2021-06-29 16:00:00,UGRD,10 m above ground,0,-90,-3.63023
2021-06-24 18:00:00,2021-06-29 16:00:00,UGRD,10 m above ground,0.25,-90,-3.62023
2021-06-24 18:00:00,2021-06-29 16:00:00,UGRD,10 m above ground,0.5,-90,-3.61023
`;
    const result = parseCsvData(csvData);
    expect(result).toEqual([
      {
        time: '2021-06-29 16:00:00',
        variable: 'UGRD',
        level: '10 m above ground',
        lon: '0',
        lat: '-90',
        value: -3.63023,
      },
      {
        time: '2021-06-29 16:00:00',
        variable: 'UGRD',
        level: '10 m above ground',
        lon: '0.25',
        lat: '-90',
        value: -3.62023,
      },
      {
        time: '2021-06-29 16:00:00',
        variable: 'UGRD',
        level: '10 m above ground',
        lon: '0.5',
        lat: '-90',
        value: -3.61023,
      },
    ]);
  });
});
