module.exports = {
  mcu: {
    port: 'COM3',
  },
  express: {
    port: 4000,
  },
  influxdb: {
    enabled: 1,
    host: '192.168.55.14:8086',
    org: 'admin',
    bucket: 'maya',
    username: 'admin',
    password: 'growbox123',
    token: 'tX6rFsAAs6zIaYKwEjv9qrXi8a-udQpmwh_5Y916DCUc5YYFoRr3-FWEcT0u8laKiO6x6J9taupV0vUPo3K1KQ==',
  },
  sensorPins: {
    led: 3,
    env_light: 'A3',
    water_temp: 2,
    water_ec: 'A0',
    water_ph: 'A1',
  },
  relayPins: {
    pump_nutrients1: 4,
    pump_nutrients2: 5,
    pump_phup: 6,
    pump_phdown: 7,
    ed_fanheater: 8,
    ed_fancooler: 9,
    ed_heatingpad: 10,
    ed_mister: 11,
  },
  thresholdValues: {
    env_light: {
      min: '',
      max: '',
    },
    env_temp: {
      min: '',
      max: '',
    },
    env_humidity: {
      min: '',
      max: '',
    },
    water_temp: {
      min: '',
      max: '',
    },
    water_ec: {
      min: '',
      max: '',
    },
    water_ph: {
      min: '',
      max: '',
    },
  },
};
