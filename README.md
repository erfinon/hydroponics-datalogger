# hydroponics-datalogger
Automated hydroponic system using Arduino Uno, ConfigurableFirmata, Johnny-Five, Express, InfluxDB and Grafana

## Arduino components
- Photoresistor
- SHT31D temperature/humidity sensor
- DS18B20 water temperature sensor
- DFRobot PH sensor
- Keystudio TDS sensor
- 8 channel relay module

## Electrical devices
- Coupe warmer
- Fan cooler
- Heating plate
- Mister
- 4x 12V/5W peristaltic pumps
- 230/12 voltage transformer

## TODO
I plan on adding a more advanced nutrient delivery system for different growing stages of the plants at a later point

## Prerequisites
ConfigurableFirmata - https://github.com/firmata/ConfigurableFirmata

Node.js version 14.15.5 - https://nodejs.org/download/release/v14.15.5/node-v14.15.5-x64.msi

InfluxDB version 2.0.6 - https://dl.influxdata.com/influxdb/releases/influxdb2-2.0.6-windows-amd64.zip

Grafana version 7.5.5 - https://dl.grafana.com/oss/release/grafana-7.5.5.windows-amd64.msi

InfluxDB data logging and Grafana visualization can be disabled in the app's config.js file. 

## Setup
### ConfigurableFirmata
Unzip ConfigurableFirmata to Arduino library folder, typically '/Documents/Arduino/libraries/' on Mac or Linux or '\My Documents\Arduino\libraries\' on Windows and load the Arduino IDE.
Load the sketch from 'File - Examples - ConfigurableFirmata - ConfigurableFirmata' and click upload while your Arduino is plugged into your computer.

### Node.js
Download the Node.js install file and follow the on-screen instructions for installing.

### InfluxDB
Requires wget and PowerShell to install.

wget https://dl.influxdata.com/influxdb/releases/influxdb2-2.0.6-windows-amd64.zip -UseBasicParsing -OutFile influxdb2-2.0.6-windows-amd64.zip
Expand-Archive .\influxdb2-2.0.6-windows-amd64.zip -DestinationPath 'C:\Program Files\InfluxData\influxdb2\'

### Grafana
Download the Grafana install file and follow the on-screen instructions for installing. Default username/password is admin/admin.
Import dashboard.json from 'Dashboards - Manage' within Grafana.

## Documentation

## Warning
Connecting the relay module to a power source will automatically power on all relays. Keep this in mind!

Starting the app will power the relay module for a few ms, connecting power to the peristaltic pumps should be avoided until the app is running. Unfortunately I haven't found a working solution to avoid these issues.

### Install dependencies
npm install

### Start app
npm start
