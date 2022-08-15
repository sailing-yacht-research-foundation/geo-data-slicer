// Note: Mapping for variables not recognized by wgrib2 (tool we used to convert to csv and then to json), will be using ECMWF short codes
// Will also include 5 variables that are actually recognized by wgrib2, but converted into a different short code

function mapERA5Variables(variableName) {
  switch (variableName) {
    case 'var192_140_222':
      return 'WDW';
    case 'var192_140_225':
      return 'DWWW';
    case 'var192_140_228':
      return 'DWPS';
    case 'var192_140_233':
      return 'CDWW';
    case 'var192_140_235':
      return 'MDWW';
    case 'var192_140_237':
      return 'SHTS';
    case 'var192_140_238':
      return 'MDTS';
    case 'var192_140_239':
      return 'MPTS';
    case 'WVPER':
      return 'MPWW';
    case 'HTSGW':
      return 'SWH';
    case 'WVHGT':
      return 'SHWW';
    case 'WWSDIR':
      return 'MWD';
    case 'MWSPER':
      return 'MWP';
    default:
      return variableName;
  }
}

module.exports = mapERA5Variables;

/*
References used:
https://www.nco.ncep.noaa.gov/pmb/docs/on388/table2.html
https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_table4-2-10-0.shtml
https://ftp.cpc.ncep.noaa.gov/wd51we/wgrib/ectab_140

This 3 variables matched without any modification: (Have different short code, but the names are identical )
NOAA: 103 Mean period of wind waves	s	WVPER
ECCODES Parameter ID	140236 Name	Mean period of wind waves Short Name	mpww

NOAA: 100 Significant height of combined wind waves and swell	m	HTSGW
ECCODES Parameter ID	140229 Name	Significant height of combined wind waves and swell Short Name	swh

NOAA: 102 Significant height of wind waves	m	WVHGT
ECCODES Parameter ID	140234 Name	Significant height of wind waves Short Name	shww

This 2 variables also automatically converted when using wgrib2, but has different name (is this the same? To be confirmed):
Also these are found from different url: https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_table4-2-10-0.shtml

NOAA 14 Direction of Combined Wind Waves and Swell	degree true	WWSDIR
Parameter ID	140230 Name	Mean wave direction Short Name	mwd

NOAA 15 Mean Period of Combined Wind Waves and Swell	s  MWSPER
Parameter ID	140232 Name	Mean wave period Short Name	mwp


There's also this url:
https://ftp.cpc.ncep.noaa.gov/wd51we/wgrib/ectab_140
Which contains the same param number from same parmCategory (140) from noaa.
I tried using wgrib2 with this param: 
-if ":[var_unknown_in_grib]:" -set_var [CODE_FOUND] -fi
for example: 
-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=233:" -set_var CDWW -fi

The only thing that works is the CDWW (Coefficient of Drag with Waves). The other is error, regardless of short code I use (e.g. Neither MDTS or MDPS is working)



Coefficient of drag with waves	cdww	dimensionless	140233	
16	Coefficient of Drag With Waves	-	CDWW

Mean direction of total swell	mdts	degrees	140238		
Not Found anything in both URL, maybe keep MDTS?
238:MDPS:Mean direction of primary swell [degrees]


Significant height of total swell	shts	m	140237
Not Found anything in both URL, maybe keep SHTS?
237:SHPS:Significant height of primary swell [m]

Wave spectral directional width	wdw	radians	140222
222:WDW:Wave spectral directional width


Wave spectral directional width for swell	dwps	radians	140228
228:DWPS:Wave spectral directional width for swell

Wave spectral directional width for wind waves	dwww	radians	140225	
225:DWWW:Wave spectral directional width for wind waves

Mean period of total swell	mpts	s	140239
239:MPPS:Mean period of primary swell [s]

Here's the command used for easier retrial in the future:

-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=238:" -set_var MDPS -fi
-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=235:" -set_var MDWW -fi
-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=237:" -set_var SHTS -fi
-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=222:" -set_var WDW -fi
-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=228:" -set_var DWPS -fi
-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=225:" -set_var DWWW -fi
-if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=239:" -set_var MPTS -fi

wgrib2 test_new.grb -if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=233:" -set_var CDWW -fi -if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=222:" -set_var WDW -fi -if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=228:" -set_var DWPS -fi -if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=225:" -set_var DWWW -fi -if ":var discipline=192 center=98 local_table=1 parmcat=140 parm=239:" -set_var MPTS -fi -grib test_new_fin.grb
*/
