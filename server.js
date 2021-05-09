// Load required libraries and app config
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const path = require('path');

const app = express();
const config = require(path.join(`${__dirname}/config.js`));

// Enable HTTP bodyParser and logger
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(logger('dev'));

// Start express
app.listen(config.express.port);
console.log(`Listening on port ${config.express.port}`);

/*
 * Microcontroller actions:
 * Connect to microcontroller, initialize sensors
 * and saves data to InfluxDB if enabled on intervals.
 * Blinks a LED diode to indicate successful connection.
 */
const five = require('johnny-five');

let led; let sensorEnvLight; let sensorEnvTempRH;
let sensorWaterTemp; let sensorWaterEC; let sensorWaterPH;
let pump_nutrients1; let pump_nutrients2; let pump_phup; let pump_phdown;
let ed_fanheater; let ed_fancooler; let ed_heatingpad; let ed_mister

// Connect to microcontroller
const mcu = new five.Board({
  port: config.mcu.port,
});

mcu.once('ready', () => {
  console.log('Microcontroller ready!');
  mcu.isReady = true;

  // Initialize relays
  pump_nutrients1 = new five.Relay({
    pin: config.relayPins.pump_nutrients1,
    isOn: false,
  });
  pump_nutrients2 = new five.Relay({
    pin: config.relayPins.pump_nutrients2,
    isOn: false,
  });
  pump_phup = new five.Relay({
    pin: config.relayPins.pump_phup,
    isOn: false,
  });
  pump_phdown = new five.Relay({
    pin: config.relayPins.pump_phdown,
    isOn: false,
  });
  ed_fanheater = new five.Relay({
    pin: config.relayPins.ed_fanheater,
    isOn: false,
  });
  ed_fancooler = new five.Relay({
    pin: config.relayPins.ed_fancooler,
    isOn: false,
  });
  ed_heatingpad = new five.Relay({
    pin: config.relayPins.ed_heatingpad,
    isOn: false,
  });
  ed_mister = new five.Relay({
    pin: config.relayPins.ed_mister,
    isOn: false,
  });

  // Initialize sensors
  // Environment light sensor
  sensorEnvLight = new five.Light({
    pin: config.sensorPins.env_light,
    freq: 1000,
  });
  // Environment temperature / humidity sensor
  sensorEnvTempRH = new five.Multi({
    controller: 'SHT31D',
    freq: 1000,
  });
  // Water temperature sensor
  sensorWaterTemp = new five.Thermometer({
    controller: 'DS18B20',
    pin: config.sensorPins.water_temp,
    freq: 1000,
  });
  // Water electrical conductivity sensor
  sensorWaterEC = new five.Sensor({
    pin: config.sensorPins.water_ec,
    freq: 1000,
  });
  // Water ph sensor
  sensorWaterPH = new five.Sensor({
    pin: config.sensorPins.water_ph,
    freq: 1000,
  });

  // Pulse LED diode to indicate the microcontroller is running
  led = new five.Led(config.sensorPins.led);
  led.pulse(250);
  setTimeout(() => {
    led.stop().off();
  }, 5000)

// Exit handler for mcu
}).on('exit', () => {
  led.stop().off();
  ed_fanheater.close();
  ed_fancooler.close();
  ed_heatingpad.close();
  ed_mister.close();
  console.log('Dropping connection to microcontroller.');
// Error handler for mcu
}).on('error', (err) => {
  console.log('Unable to connect with microcontroller.');
  console.log(err);
});

// Poll sensors for data
function getEnvLight(sensorEnvLight) {
  return Math.round(sensorEnvLight.value / 1024 * 100);
}
function getEnvTemp(sensorEnvTempRH) {
  return Math.round(sensorEnvTempRH.thermometer.celsius);
}
function getEnvHumidity(sensorEnvTempRH) {
  return Math.round(sensorEnvTempRH.hygrometer.relativeHumidity);
}
function getWaterTemp(sensorWaterTemp) {
  return Math.round(sensorWaterTemp.celsius);
}

// Read voltage from analog sensor and convert
// to EC, compensate for temperature and then
// convert to TDS (total dissolved solids) ppm.
// Returns a float with 2 decimal places
const ec_kvalue = 1;
const tds_factor = 0.5;
function getWaterEC(sensorWaterEC) {
  let ec_temperature = getWaterTemp(sensorWaterTemp);
  let ec_voltage = sensorWaterEC.value * 5 / 1024;
  let ec_value = (133.42 * ec_voltage * ec_voltage * ec_voltage - 255.86 * ec_voltage * ec_voltage + 857.39 * ec_voltage) * ec_kvalue;
  let ec_value25 = ec_value / (1.0+0.02*(ec_temperature-25.0)); // Temperature compensation

  //return (ec_value25 * tds_factor).toFixed(2);
  return(1000);
}

// Read voltage from analog sensor and convert
// to ph with calibration offset.
// Returns a float value with 2 decimal places.
const ph_offset = 0.75 // Offset for calibration
function getWaterPH(sensorWaterPH) {
  let ph_voltage = sensorWaterPH.value * 5 / 1024;
  return (3.5 * ph_voltage + ph_offset).toFixed(2);
}

// Get all historical data from a particular sensor
function getAllSensorData(sensor, callback) {
  r.table('sensors')
    .pluck('date', sensor)
    .orderBy('date')
    // eslint-disable-next-line consistent-return
    .run(app.rdbConn, (err, sensorData) => {
      if (err) {
        return callback(err);
      }
      sensorData.toArray(callback);
    });
}

// Get all historical data
function getAllEnvLightData(callback) {
  return getAllSensorData('env_light', callback);
}
function getAllEnvTempData(callback) {
  return getAllSensorData('env_temp', callback);
}
function getAllEnvHumidityData(callback) {
  return getAllSensorData('env_humidity', callback);
}
function getAllWaterTempData(callback) {
  return getAllSensorData('water_temp', callback);
}
function getAllWaterECData(callback) {
  return getAllSensorData('water_ec', callback);
}
function getAllWaterPHData(callback) {
  return getAllSensorData('water_ph', callback);
}

// Save sensor data to database
function saveSensorData(env_light, env_temp, env_humidity, water_temp, water_ec, water_ph) {
  const {InfluxDB, Point} = require('@influxdata/influxdb-client');
  const client = new InfluxDB({url: 'http://' + config.influxdb.host, token: config.influxdb.token});
  const writeApi = client.getWriteApi(config.influxdb.org, config.influxdb.bucket, 'ms');

  writeApi.useDefaultTags({host: 'growbox'});

  // Data points
  const db_env_light = new Point('env_light')
    .floatField('value', env_light);
  writeApi.writePoint(db_env_light);
  const db_env_temp = new Point('env_temp')
    .floatField('value', env_temp);
  writeApi.writePoint(db_env_temp);
  const db_env_rh = new Point('env_humidity')
    .floatField('value', env_humidity);
  writeApi.writePoint(db_env_rh);
  const db_water_temp = new Point('water_temp')
    .floatField('value', water_temp);
  writeApi.writePoint(db_water_temp);
  const db_water_ec = new Point('water_ec')
    .floatField('value', water_ec);
  writeApi.writePoint(db_water_ec);
  const db_water_ph = new Point('water_ph')
    .floatField('value', water_ph);
  writeApi.writePoint(db_water_ph);
  writeApi
    .close()
    .then(() => {
      console.log('Saving sensor data')
    })
    .catch(e => {
      console.error(e)
      console.log('\\nERROR: Could not save sensor data')
    })
}

// Start regulatory actions and light up LED diode
// if threshold values are exceeded
function regulateActions(env_temp, env_humidity, water_temp) {
  // Fan heater
  if (env_temp <= config.thresholdValues.env_temp.min) {
    led.pulse(1000);
    ed_fanheater.open();
    console.log('Regulating air heater - ', env_temp);
  }

  // Ultrasonic mister
  if (env_humidity <= config.thresholdValues.env_humidity.min) {
    led.pulse(1000);
    ed_mister.open();
    console.log('Regulating mister - ', env_humidity);
  }

  setTimeout(() => {
    ed_fanheater.close();
    ed_mister.close();
  }, 15000)

  // Fan cooler
  if (env_humidity >= config.thresholdValues.env_humidity.max || env_temp >= config.thresholdValues.env_temp.max) {
    led.pulse(1000);
    ed_fancooler.open();
    console.log('Regulating air cooler - ', env_humidity, env_temp);
  } else {
    ed_fancooler.close();
  }

  // Water temperature
  // Turn heating pad on if too cold.
  if (water_temp < config.thresholdValues.water_temp.min) {
    led.pulse(1000);
    ed_heatingpad.open();
    console.log('Regulating water temperature - ', water_temp);
  } else {
    ed_heatingpad.close();
  }
  /*
// Fan heater
if (env_temp <= config.thresholdValues.env_temp.min) {
  led.pulse(1000);
  ed_fanheater.close();
  console.log('Regulating air heater - ', env_temp);
}

// Ultrasonic mister
if (env_humidity <= config.thresholdValues.env_humidity.min) {
  led.pulse(1000);
  ed_mister.close();
  console.log('Regulating mister - ', env_humidity);
}

setTimeout(() => {
  ed_fanheater.open();
  ed_mister.open();
}, 15000)

// Fan cooler
if (env_humidity >= config.thresholdValues.env_humidity.max || env_temp >= config.thresholdValues.env_temp.max) {
  led.pulse(1000);
  ed_fancooler.close();
  console.log('Regulating air cooler - ', env_humidity, env_temp);
} else {
  ed_fancooler.open();
}

// Water temperature
// Turn heating pad on if too cold.
if (water_temp < config.thresholdValues.water_temp.min) {
  led.pulse(1000);
  ed_heatingpad.close();
  console.log('Regulating water temperature - ', water_temp);
} else {
  ed_heatingpad.open();
}

// Water electrical conductivity
if (water_ec < config.thresholdValues.water_ec.min) {
  pump_nutrients1.open();
  setTimeout(pump_nutrients1.close(), 1000);
  pump_nutrients2.open();
  setTimeout(pump_nutrients2.close(), 1000);
}

// Water pH
if (water_ph < config.thresholdValues.water_ph.min) {
  pump_phup.open();
  setTimeout(pump_phup.close(), 500)
}
if (water_ph > config.thresholdValues.water_ph.max) {
  pump_phdown.open()
  setTimeout(pump_phdown.close(), 500)
}

 */
}

function stopDevice(device) {
  led.stop().off();
  device.close();
  console.log('Stopping device - ', device);
}

function stopAllDevices() {
  led.stop().off();
  ed_fanheater.open();
  ed_fancooler.open();
  ed_heatingpad.open();
  ed_mister.open();
  console.log('Stopping all devices');
}

// Emit sensor data and regulate grow environment on 60s intervals
setInterval(() => {
  let rt_env_light = getEnvLight(sensorEnvLight);
  let rt_env_temp = getEnvTemp(sensorEnvTempRH);
  let rt_env_humidity = getEnvHumidity(sensorEnvTempRH);
  let rt_water_temp = getWaterTemp(sensorWaterTemp);
  let rt_water_ec = getWaterEC(sensorWaterEC);
  let rt_water_ph = getWaterPH(sensorWaterPH);

  // Save to database if enabled in config
  if (config.influxdb.enabled === 1) {
    console.log('Air climate: ', rt_env_light, rt_env_temp, rt_env_humidity);
    console.log('Water quality: ', rt_water_temp, rt_water_ec, rt_water_ph);
    saveSensorData(rt_env_light, rt_env_temp, rt_env_humidity, rt_water_temp, rt_water_ec, rt_water_ph);
  } else {
    console.log('Air climate: ', rt_env_light, rt_env_temp, rt_env_humidity);
    console.log('Water quality: ', rt_water_temp, rt_water_ec, rt_water_ph);
  }

  regulateActions(rt_env_temp, rt_env_humidity, rt_water_temp);
}, 30000);

// Express data routes
// Realtime sensor data
app.get('/api/env_light', (req, res) => {
  res.write(JSON.stringify(getEnvLight(sensorEnvLight)));
  res.end();
});

app.get('/api/env_temp', (req, res) => {
  res.write(JSON.stringify(getEnvTemp(sensorEnvTempRH)));
  res.end();
});

app.get('/api/env_humidity', (req, res) => {
  res.write(JSON.stringify(getEnvHumidity(sensorEnvTempRH)));
  res.end();
});

app.get('/api/water_temp', (req, res) => {
  res.write(JSON.stringify(getWaterTemp(sensorWaterTemp)));
  res.end();
});

app.get('/api/water_ec', (req, res) => {
  res.write(JSON.stringify(getWaterEC(sensorWaterEC)));
  res.end();
});

app.get('/api/water_ph', (req, res) => {
  res.write(JSON.stringify(getWaterPH(sensorWaterPH)));
  res.end();
});

// Historical data, active if influxdb is enabled in the config
if (config.influxdb.enabled === 1) {
  app.get('/api/db/env_light', (req, res) => {
    getAllEnvLightData((err, data) => {
      if (err) { console.log(err); }

      res.write(JSON.stringify(data));
      res.end();
    });
  });

  app.get('/api/db/env_temp', (req, res) => {
    getAllEnvTempData((err, data) => {
      if (err) { console.log(err); }

      res.write(JSON.stringify(data));
      res.end();
    });
  });

  app.get('/api/db/env_humidity', (req, res) => {
    getAllEnvHumidityData((err, data) => {
      if (err) { console.log(err); }

      res.write(JSON.stringify(data));
      res.end();
    });
  });

  app.get('/api/db/water_temp', (req, res) => {
    getAllWaterTempData((err, data) => {
      if (err) { console.log(err); }

      res.write(JSON.stringify(data));
      res.end();
    });
  });

  app.get('/api/db/water_ec', (req, res) => {
    getAllWaterECData((err, data) => {
      if (err) { console.log(err); }

      res.write(JSON.stringify(data));
      res.end();
    });
  });

  app.get('/api/db/water_ph', (req, res) => {
    getAllWaterPHData((err, data) => {
      if (err) { console.log(err); }

      res.write(JSON.stringify(data));
      res.end();
    });
  });
}

// App exit handler

module.exports = {
  app,
};
