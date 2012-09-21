#!/usr/bin/env node

var fs      = require('fs'), 
    request = require('superagent'), 
    async   = require('async'), 
    moment  = require('moment');

var config;

try {
  config = JSON.parse( fs.readFileSync('./config.json') );
}
catch (err) {
  console.log('There has been an error parsing your config.json');
  console.log(err);
}

var wunderground_key      = config.wunderground_key;
var wunderground_location = config.wunderground_location;

var newMoon = moment("2012-09-16T02:14:00+00:00");
var moonPhases = [
  { val: 0.000, name: "New Moon",        id: "moon_new" },
  { val: 0.125, name: "Waxing Crescent", id: "moon_waxing_crescent" },
  { val: 0.250, name: "First Quarter",   id: "moon_first_quarter" },
  { val: 0.375, name: "Waxing Gibbous",  id: "moon_waxing_gibbous" },
  { val: 0.500, name: "Full Moon",       id: "moon_full" },
  { val: 0.625, name: "Waning Gibbous",  id: "moon_waning_gibbous" },
  { val: 0.750, name: "Last Quarter",    id: "moon_last_quarter" },
  { val: 0.875, name: "Waning Crescent", id: "moon_waning_crescent" },
  { val: 1.000, name: "New Moon",        id: "moon_new" }
];

getCurrentConditions = function(callback) {
  
  request
  .get('http://api.wunderground.com/api/' + wunderground_key + '/conditions/q/' + wunderground_location + '.json')
  .end( function(res) {
    
    var weather = {conditions:null,forecast:null};
    
    weather.conditions = res.body.current_observation;
  
    callback(null, weather);
  });
  
};

getForecast = function(weather, callback) {
  
  request
  .get('http://api.wunderground.com/api/' + wunderground_key + '/forecast/q/' + wunderground_location + '.json')
  .end( function(res) {
    
    weather.forecast = res.body.forecast.simpleforecast.forecastday.map( function(e) {
      if ( e.icon.substr(0,6) == 'chance' )
        e.icon = e.icon.substr(6)
      
      return {
        high: e.high.celsius, 
        low: e.low.celsius,
        icon: e.icon
      };
    } );
    
    callback(null, weather);
    
  });
  
};

svgthing = function(weather, callback) {
  
  var template = fs.readFileSync('kindleweather-template.svg', 'utf8');
  
  var output = template;
  
  output = output.replace( '$location', weather.conditions.observation_location.city );
  output = output.replace( '$date', moment().format('ddd, MMM Do H:mm') );
  
  output = output.replace( 'ICON_ONE',   weather.conditions.icon  );
  output = output.replace( 'ICON_TWO',   weather.forecast[1].icon );
  output = output.replace( 'ICON_THREE', weather.forecast[2].icon );
  output = output.replace( 'ICON_FOUR',  weather.forecast[3].icon );
  
  output = output.replace( 'HIGH_ONE',   weather.conditions.temp_c );
  output = output.replace( 'HIGH_TWO',   weather.forecast[1].high );
  output = output.replace( 'HIGH_THREE', weather.forecast[2].high );
  output = output.replace( 'HIGH_FOUR',  weather.forecast[3].high );
  
  output = output.replace( 'LOW_ONE',    weather.conditions.feelslike_c  );
  output = output.replace( 'LOW_TWO',    weather.forecast[1].low );
  output = output.replace( 'LOW_THREE',  weather.forecast[2].low );
  output = output.replace( 'LOW_FOUR',   weather.forecast[3].low ); 
  
  output = output.replace( 'DAY_THREE',  moment().add('d',2).format('dddd') );
  output = output.replace( 'DAY_FOUR',   moment().add('d',3).format('dddd') ); 
    
  var moonAge = ( moment().diff(newMoon, 'days', true) / 29.530588853 ) % 1;
    
  var phase,d;
  for ( var i = moonPhases.length-1; i >= 0; i-- ) {
    if ( phase === undefined || d > Math.abs( moonAge - moonPhases[i].val ) ) { phase = moonPhases[i]; d = Math.abs( moonAge - moonPhases[i].val ); }
  }
    
  output = output.replace( '$moon', phase.id );
  
  if ( weather.conditions.temp_c > 30 ) {
    output = output.replace( '$thermometer', 'thermometer_highest' );
  } else if ( weather.conditions.temp_c > 20 ) {
    output = output.replace( '$thermometer', 'thermometer_high' );
  } else if ( weather.conditions.temp_c > 10 ) {
    output = output.replace( '$thermometer', 'thermometer_med' );
  } else if ( weather.conditions.temp_c > 0 ) {
    output = output.replace( '$thermometer', 'thermometer_low' );
  } else {
    output = output.replace( '$thermometer', 'thermometer_lowest' );
  }
  
  var conditions = [];
  
  if ( weather.conditions.precip_today_metric > 0 ) {
    conditions.push('rain');
  }
  
  if ( weather.conditions.wind_kph > 10 ) {
    conditions.push('wind');
  }
  
  for ( i in conditions ) {
    output = output.replace( '$cond'+i, conditions[i] );
  }
  
  var sunrise = calcSun('rise', weather.conditions.observation_location.latitude, weather.conditions.observation_location.longitude, 90.83);
  var sunset = calcSun('set',  weather.conditions.observation_location.latitude, weather.conditions.observation_location.longitude, 90.83);
  
  if ( sunrise !== null )
    output = output.replace( '$sunrise', moment(sunrise).format('H:mm') );
  else
    output = output.replace( '$sunrise', '--:--' );
  if ( sunset !== null )
    output = output.replace( '$sunset',  moment(sunset).format('H:mm') );
  else
    output = output.replace( '$sunset', '--:--' );

  fs.writeFileSync( 'kindleweather-output.svg', output );
  
};

update = function() {
  
  async.waterfall([
    function(callback) {
      getCurrentConditions(callback);
    },
    function(arg1, callback) {
      getForecast(arg1, callback);
    },
    function(arg1, callback) {
      svgthing(arg1, callback);
    }
  ], function (err, result) {
     console.log(result);  
  });
  
};

update();

calcSun = function(type,lat,lng,zenith) {
  
  floor = Math.floor;
  
  sin = function(a) { return Math.sin(a*(Math.PI/180)); };
  cos = function(a) { return Math.cos(a*(Math.PI/180)); };
  tan = function(a) { return Math.tan(a*(Math.PI/180)); };
  
  asin = function(a) { return Math.asin(a)*(180/Math.PI); };
  acos = function(a) { return Math.acos(a)*(180/Math.PI); };
  atan = function(a) { return Math.atan(a)*(180/Math.PI); };
  
  var now = moment();
  
  var N = now.format('DDD') * 1;
  
  var lngHour = lng / 15;
  
  if ( type == 'rise')
    t = N + ((6 - lngHour) / 24);
  if ( type == 'set')
    t = N + ((18 - lngHour) / 24);
  
  var M = (0.9856 * t) - 3.289;
  
  var L = ( M + (1.916 * sin(M)) + (0.020 * sin(2 * M)) + 282.634 + 360 ) % 360;
  
  var RA = atan(0.91764 * tan(L) );
  
  var Lquadrant  = (floor( L/90)) * 90;
  var RAquadrant = (floor(RA/90)) * 90;
  RA = RA + (Lquadrant - RAquadrant);
  
  RA = RA / 15;
  
  var sinDec = 0.39782 * sin(L);
  var cosDec = cos(asin(sinDec));
  
  var cosH = (cos(zenith) - (sinDec * sin(lat))) / (cosDec * cos(lat));
  
  // the sun never rises on this location (on the specified date)
  if ( cosH > 1 && type == 'rise')
    return null;
  
  // the sun never sets on this location (on the specified date)
  if ( cosH < -1 && type == 'set' )
    return null;

  var H;
  
  if ( type == 'rise' )
    H = 360 - acos(cosH);
  
  if ( type == 'set' )
    H = acos(cosH);
  
  H = H / 15;
  
  var T = H + RA - (0.06571 * t) - 6.622;
  
  var UT = ( T - lngHour + 24 ) % 24;
  
  var localT = UT - moment().zone()/60;
  
  var h = Math.floor(localT);
  var m = Math.floor( (localT - h) * 60 );
  
  var ret = moment().hours(h).minutes(m).seconds(0);
  
  return ret.toDate();
  
};
