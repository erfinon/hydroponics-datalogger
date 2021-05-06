//////////////////////////////////////////
// Shows how to use InfluxDB query API. //
//////////////////////////////////////////

import {InfluxDB, FluxTableMetaData} from '@influxdata/influxdb-client'
const config = require(path.join(`${__dirname}/config.js`));

const queryApi = new InfluxDB({url: 'http://' + config.influxdb.host, token: config.influxdb.token}).getQueryApi(config.influxdb.org)
const fluxQuery =
  'from(bucket:"maya") |> range(start: 0) |> filter(fn: (r) => r._measurement == "env_light")'

console.log('*** QUERY ROWS ***')
// Execute query and receive table metadata and rows.
// https://v2.docs.influxdata.com/v2.0/reference/syntax/annotated-csv/
queryApi.queryRows(fluxQuery, {
  next(row: string[], tableMeta: FluxTableMetaData) {
    const o = tableMeta.toObject(row)
    // console.log(JSON.stringify(o, null, 2))
    console.log(
      `${o._time} ${o._measurement} in '${o.location}' (${o.example}): ${o._field}=${o._value}`
    )
  },
  error(error: Error) {
    console.error(error)
    console.log('\nFinished ERROR')
  },
  complete() {
    console.log('\nFinished SUCCESS')
  },
})