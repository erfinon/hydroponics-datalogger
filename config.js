const mcu = {
  port: '/dev/ttyACM0',
}

const express = {
  port: 4000,
}

const influxdb = {
  enabled: 1,
  host: 'localhost:8086',
  org: 'admin',
  bucket: 'maya',
  username: 'admin',
  password: 'growbox123',
  token: 'tX6rFsAAs6zIaYKwEjv9qrXi8a-udQpmwh_5Y916DCUc5YYFoRr3-FWEcT0u8laKiO6x6J9taupV0vUPo3K1KQ==',
}

const sensorPins = {
  led: 3,
  env_light: 'A3',
  water_temp: 2,
  water_ec: 'A0',
  water_ph: 'A1',
}

const relayPins = {
  pump_nutrients1: 4,
  pump_nutrients2: 5,
  pump_phdown: 6,
  pump_phup: 7,
  ed_fanheater: 8,
  ed_fancooler: 9,
  ed_heatingpad: 10,
  ed_mister: 11,
}

const thresholdValues = {
  env_temp: {
    min: '20',
    max: '27',
  },
  env_humidity: {
    min: '40',
    max: '60',
  },
  water_temp: {
    min: '18',
    max: '', // No way to adjust water temperature down for now
  },
  water_ec: {
    min: '400',
    max: '', // No way to adjust EC down for now
  },
  water_ph: {
    min: '5.20',
    max: '6.80',
  },
}

module.exports = {
  mcu, express, influxdb, sensorPins, relayPins, thresholdValues
};
