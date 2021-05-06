/*
Sets up a new InfluxDB database with a user, organization
and bucket. All values are defined in config/index.js
*/
const path = require('path')
const {InfluxDB} = require('@influxdata/influxdb-client')
const {SetupAPI} = require('@influxdata/influxdb-client-apis')
const config = require(path.join(`${__dirname}/config.js`));

const org = config.influxdb.org;
const bucket = config.influxdb.bucket;
const username = config.influxdb.username;
const password = config.influxdb.password;
const token = config.influxdb.token;

console.log('Setting up database...')
const setupApi = new SetupAPI(new InfluxDB({url: 'http://' + config.influxdb.host}))

setupApi
  .getSetup()
  .then(async ({allowed}) => {
    if (allowed) {
      await setupApi.postSetup({
        body: {
          org,
          bucket,
          username,
          password,
          token,
        },
      })
      console.log(`InfluxDB setup on '${config.influxdb.host}' is complete.`)
    } else {
      console.log(`InfluxDB setup on '${config.influxdb.host}' has already been done.`)
    }
    console.log('\nSuccess! Hydroponics datalogger is ready to run.')
  })
  .catch(error => {
    console.error(error)
    console.log('\nError setting up database! Further action may be needed.')
  })