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
 * Connect to microcontroller, initialize relays and sensors,
 * save data to InfluxDB if enabled and regulate environment on intervals.
 * Blinks a LED diode to indicate successful connection.
 */
const five = require('johnny-five');

let led; let sensorEnvLight; let sensorEnvTemp; let sensorEnvHumidity;
let sensorWaterTemp; let sensorWaterEC; let sensorWaterPH;
let pump_nutrients1; let pump_nutrients2; let pump_phup; let pump_phdown;
let ed_fanheater; let ed_fancooler; let ed_heatingpad; let ed_mister

function shutdownDevices() {
  pump_nutrients1.close();
  pump_nutrients2.close();
  pump_phup.close();
  pump_phdown.close();
  ed_fanheater.close();
  ed_fancooler.close();
  ed_heatingpad.close();
  ed_mister.close();
}

// Connect to microcontroller
const mcu = new five.Board({
  port: config.mcu.port,
});

mcu.once('ready', () => {
  console.log('Microcontroller ready!');
  mcu.isReady = true;

  // Initialize relays
  pump_nutrients1 = new five.Relay(config.relayPins.pump_nutrients1);
  pump_nutrients2 = new five.Relay(config.relayPins.pump_nutrients2);
  pump_phup = new five.Relay(config.relayPins.pump_phup);
  pump_phdown = new five.Relay(config.relayPins.pump_phdown);
  ed_fanheater = new five.Relay(config.relayPins.ed_fanheater);
  ed_fancooler = new five.Relay(config.relayPins.ed_fancooler);
  ed_heatingpad = new five.Relay(config.relayPins.ed_heatingpad);
  ed_mister = new five.Relay(config.relayPins.ed_mister);
  // Make sure the relays are turned off
  shutdownDevices();

  // Initialize sensors
  // Environment light sensor
  sensorEnvLight = new five.Light({
    pin: config.sensorPins.env_light,
    freq: 5000,
  });
  // Environment temperature / humidity sensor
  sensorEnvTemp = new five.Thermometer({
    controller: 'SHT31D',
    freq: 5000,
  });
  // Environment humidity sensor
  sensorEnvHumidity = new five.Hygrometer({
    controller: 'SHT31D',
    freq: 5000,
  });
  // Water electrical conductivity sensor
  sensorWaterEC = new five.Sensor({
    pin: config.sensorPins.water_ec,
    freq: 5000,
  });
  // Water ph sensor
  sensorWaterPH = new five.Sensor({
    pin: config.sensorPins.water_ph,
    freq: 5000,
  });
  // Water temperature sensor
  sensorWaterTemp = new five.Thermometer({
    controller: 'DS18B20',
    pin: config.sensorPins.water_temp,
    freq: 5000,
  });

  // Pulse LED diode to indicate the microcontroller is running
  led = new five.Led(config.sensorPins.led);
  led.pulse(250);
  setTimeout(() => {
    led.stop().off();
  }, 5000)

// Exit handler for microcontroller
}).on('exit', () => {
  led.stop().off();
  shutdownDevices();
  console.log('Dropping connection to microcontroller.');

// Error handler for microcontroller
}).on('error', (err) => {
  led.stop().off();
  shutdownDevices();
  console.log('Unable to connect with microcontroller.');
  console.log(err);
});

// Poll sensors for data returns all values
// except light with two decimal points
// Light
function getEnvLight(sensorEnvLight) {
  return Math.round(sensorEnvLight.value / 1024 * 100);
}
// Temperature
function getEnvTemp(sensorEnvTemp) {
  return sensorEnvTemp.celsius.toFixed(2);
}
// Humidity
function getEnvHumidity(sensorEnvHumidity) {
  return sensorEnvHumidity.relativeHumidity.toFixed(2);
}
// Water temperature
function getWaterTemp(sensorWaterTemp) {
  return sensorWaterTemp.celsius.toFixed(2);
}

// Read voltage from analog sensor and convert
// to EC, compensate for temperature and then
// convert to TDS (total dissolved solids) ppm.
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

// LED diode function, turn off if no regulating action is performed.
function ledOff() {
  if (getEnvTemp(sensorEnvTemp) <= config.thresholdValues.env_temp.min && getEnvHumidity(sensorEnvHumidity) <= config.thresholdValues.env_humidity.min &&
    getEnvHumidity(sensorEnvHumidity) >= config.thresholdValues.env_humidity.max && getEnvTemp(sensorEnvTemp) >= config.thresholdValues.env_temp.max &&
    getWaterTemp(sensorWaterTemp) <= config.thresholdValues.water_temp.min) {
    led.stop().off();
  }
}

// Start regulatory actions and light up LED diode
// if threshold values are exceeded.
function regulateEnvironment(env_temp, env_humidity, water_temp) {
  // Fan heater
  if (env_temp <= config.thresholdValues.env_temp.min) {
    led.pulse(1000);
    ed_fanheater.open();
    console.log('Starting fan heater..')
  }

  // Ultrasonic mister
  if (env_humidity <= config.thresholdValues.env_humidity.min) {
    led.pulse(1000);
    ed_mister.open();
    console.log('Starting mister..')
  }

  // Heater is powerful and mister can destroy sensors,
  // turn these off after 15s and do incremental gains.
  setTimeout(() => {
    ed_fanheater.close();
    ed_mister.close();
    ledOff();
  }, 15000)

  // Fan cooler
  if (env_humidity >= config.thresholdValues.env_humidity.max || env_temp >= config.thresholdValues.env_temp.max) {
    led.pulse(1000);
    ed_fancooler.open();
    console.log('Starting fan cooler..')
  } else { ed_fancooler.close(); }

  // Heating pad
  if (water_temp <= config.thresholdValues.water_temp.min) {
    led.pulse(1000);
    ed_heatingpad.open();
    console.log('Starting heating pad..')
  } else { ed_heatingpad.close(); }

  ledOff();
  /*
  // Nutrient pumps
  if (water_ec < config.thresholdValues.water_ec.min) {
    led.pulse(1000);
    pump_nutrients1.open();
    pump_nutrients2.open();

    // Do 1s incremental gains on pump regulation.
    setTimeout(() => {
      led.stop().off();
      pump_nutrients1.close();
      pump_nutrients2.close();
    }, 1000)
  }

  // PH pumps
  if (water_ph < config.thresholdValues.water_ph.min) {
    led.pulse(1000);
    pump_phup.open();

    // Do 0.5s incremental gains on pump regulation.
    setTimeout(() => {
      led.stop().off();
      pump_phup.close();
    }, 500)
  }

  if (water_ph > config.thresholdValues.water_ph.max) {
    led.pulse(1000);
    pump_phdown.open()

    // Do 0.5s incremental gains on pump regulation.
    setTimeout(() => {
      led.stop().off();
      pump_phdown.close();
    }, 1000)
  }

   */
}


// Emit sensor data on 5m intervals
setInterval(() => {
  // Save to database if enabled in config
  if (config.influxdb.enabled === 1) {
    console.log('Air climate: ', getEnvLight(sensorEnvLight), getEnvTemp(sensorEnvTemp), getEnvHumidity(sensorEnvHumidity));
    console.log('Water quality: ', getWaterTemp(sensorWaterTemp), getWaterEC(sensorWaterEC), getWaterPH(sensorWaterPH));

    saveSensorData(getEnvLight(sensorEnvLight), getEnvTemp(sensorEnvTemp), getEnvHumidity(sensorEnvHumidity),
      getWaterTemp(sensorWaterTemp), getWaterEC(sensorWaterEC), getWaterPH(sensorWaterPH));
  } else {
    console.log('Air climate: ', getEnvLight(sensorEnvLight), getEnvTemp(sensorEnvTemp), getEnvHumidity(sensorEnvHumidity));
    console.log('Water quality: ', getWaterTemp(sensorWaterTemp), getWaterEC(sensorWaterEC), getWaterPH(sensorWaterPH));
  }

  regulateEnvironment(getEnvTemp(sensorEnvTemp), getEnvHumidity(sensorEnvHumidity), getWaterTemp(sensorWaterTemp),
    getWaterEC(sensorWaterEC), getWaterPH(sensorWaterPH));
}, 30000);


// Express data routes
// Realtime sensor data
app.get('/api/env_light', (req, res) => {
  res.write(JSON.stringify(getEnvLight(sensorEnvLight)));
  res.end();
});

app.get('/api/env_temp', (req, res) => {
  res.write(JSON.stringify(getEnvTemp(sensorEnvTemp)));
  res.end();
});

app.get('/api/env_humidity', (req, res) => {
  res.write(JSON.stringify(getEnvHumidity(sensorEnvHumidity)));
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

module.exports = {
  app,
};