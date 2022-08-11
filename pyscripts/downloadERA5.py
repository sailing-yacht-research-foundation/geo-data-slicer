#!/usr/bin/python

import os
import sys
import cdsapi
from pathlib import Path
from datetime import timezone, datetime, timedelta 

if len(sys.argv) < 4:
    print("3 Arguments required 'CompetitionID' 'Start Time' 'End Time'")
    exit()

competitionUnitId = sys.argv[1]
startTime = sys.argv[2]
endTime = sys.argv[3]

c = cdsapi.Client()

startDate = datetime.strptime(startTime, "%Y%m%d%H%M%S")
endDate = datetime.strptime(endTime, "%Y%m%d%H%M%S")

currentDate = startDate
timeToGet = []
while currentDate <= endDate:
  timeToGet.append(currentDate)
  currentDate = currentDate + timedelta(hours=1)

print(timeToGet)
print(__file__)

scriptDir = os.path.dirname(__file__)
competitionDir = os.path.join(scriptDir, '../operating_folder/' + competitionUnitId)

Path(competitionDir).mkdir(parents=True, exist_ok=True)

for time in timeToGet:
    fileName = competitionDir + "/" + time.strftime("%Y_%m_%d_%H") + ".grib"
    c.retrieve(
        'reanalysis-era5-single-levels',
        {
            'product_type': [
                'reanalysis',
                # 'ensemble_mean', 'ensemble_members', 'ensemble_spread',
            ],
            'variable': [
                'coefficient_of_drag_with_waves', 'mean_direction_of_total_swell',
                'mean_direction_of_wind_waves', 'mean_period_of_wind_waves', 'mean_wave_direction',
                'mean_wave_period', 'significant_height_of_combined_wind_waves_and_swell', 'significant_height_of_total_swell',
                'significant_height_of_wind_waves', 'wave_spectral_directional_width', 'wave_spectral_directional_width_for_swell',
                'wave_spectral_directional_width_for_wind_waves', 'mean_period_of_total_swell'
            ],
            'year': time.strftime("%Y"),
            'month': time.strftime("%m"),
            'day': time.strftime("%d"),
            'time': [
                time.strftime("%H:00")
            ],
            'format': 'grib',
        },
        fileName)
