const moment = require('moment');
var rp = require("request-promise");
var pollingtoevent = require("polling-to-event");

var Accessory,
    Service,
    Characteristic,
    FakeGatoHistoryService;

class WEATHER {

    constructor(log, config, api) {

        FakeGatoHistoryService = require('fakegato-history')(api);

        Accessory = api.platformAccessory;
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;

        var platform = this;

        this.api = api;
        this.log = log;
        this.config = config;
        this.name = config.name;
        this.displayName = config.name;
        this.homeID = config.homeID;
        this.username = config.username;
        this.password = config.password;
        this.tempUnit = config.tempUnit;
        this.timeout = config.timeout;

        this.url = "https://my.tado.com/api/v2/homes/" + this.homeID +
            "/weather?password=" + this.password +
            "&username=" + this.username;

        this.temp = 0;

        this.emitter = pollingtoevent(function(done) {
            rp.get(platform.url, function(err, req, data) {
                done(err, data);
            });
        }, {
            longpolling: false,
            interval: 7 * 60 * 1000
        });

    }

    getServices() {

        var accessory = this;

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Identify, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Weather')
            .setCharacteristic(Characteristic.SerialNumber, "W-" + this.homeID + "-00")
            .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version);

        this.Weather = new Service.TemperatureSensor(this.name);

        this.Weather.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.01
            })
            .updateValue(accessory.state)

        //FAKEGATO
        this.historyService = new FakeGatoHistoryService("weather", this, {
            storage: 'fs',
            disableTimer: true,
            path: this.api.user.cachedAccessoryPath()
        });

        accessory.getCurrentTemperature()

        return [this.informationService, this.Weather, this.historyService];

    }

    getCurrentTemperature() {

        var self = this;

        self.emitter
            .on("poll", function(data) {

                var result = JSON.parse(data);

                if (self.tempUnit == "CELSIUS") {

                    self.temp = result.outsideTemperature.celsius;
                    //self.log("Outside temperature: " + self.temp + " degrees");

                } else {

                    self.temp = result.outsideTemperature.fahrenheit;
                    //self.log("Outside temperature: " + self.temp + " fahrenheit");

                }

                self.historyService.addEntry({
                    time: moment().unix(),
                    temp: self.temp,
                    pressure: 0,
                    humidity: 0
                });

                self.Weather.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.temp);

            })
            .on("error", function(err) {
                console.log("%s", err);
                self.Weather.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.temp);
            });

    }

}

module.exports = WEATHER