var MiFlora = require('node-mi-flora');

var Service, Characteristic, HomebridgeAPI, FakeGatoHistoryService;
var inherits = require('util').inherits;
var os = require("os");
var hostname = os.hostname();

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory("homebridge-mi-flower-care", "mi-flower-care", MiFlowerCarePlugin);
};


function MiFlowerCarePlugin(log, config) {
    var that = this;
    this.log = log;
    this.name = config.name;
    this.displayName = this.name;
    this.deviceId = config.deviceId;
    this.interval = Math.min(Math.max(config.interval, 1), 600);

    this.config = config;

    this.storedData = {};

    if (config.humidityAlertLevel != null) {
        this.humidityAlert = true;
        this.humidityAlertLevel = config.humidityAlertLevel;
    } 
    else {
        this.humidityAlert = false;
    }

    if (config.lowLightAlertLevel != null) {
        this.lowLightAlert = true;
        this.lowLightAlertLevel = config.lowLightAlertLevel;
    } 
    else {
        this.lowLightAlert = false;
    }

    if (config.fertilityAlertLevel != null) {
        this.fertilityAlert = true;
        this.fertilityAlertLevel = config.fertilityAlertLevel;
    } 
    else {
        this.fertilityAlert = false;
    }

    // Setup services
    this.setUpServices();

    // Setup MiFlora
    this.flora = new MiFlora(this.deviceId);

    this.flora.on('data', function (data) {
        if (data.deviceId = that.deviceId) {
            that.log("Lux: %s, Temperature: %s, Moisture: %s, Fertility: %s", data.lux, data.temperature, data.moisture, data.fertility);
            that.storedData.data = data;

            that.fakeGatoHistoryService.addEntry({
                time: new Date().getTime() / 1000,
                temp: data.temperature,
                humidity: data.moisture
            });

            that.lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
                .updateValue(data.lux);
            that.lightService.getCharacteristic(Characteristic.StatusActive)
                .updateValue(true);

            that.tempService.getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(data.temperature);
            that.tempService.getCharacteristic(Characteristic.StatusActive)
                .updateValue(true);

            that.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .updateValue(data.moisture);
            that.humidityService.getCharacteristic(Characteristic.StatusActive)
                .updateValue(true);

			if (that.humidityAlert || that.lowLightAlert || that.fertilityAlert) {
				var alarmState1, alarmState2, alarmState3;
				var alarmState = alarmState1 = alarmState2 = alarmState3 = Characteristic.ContactSensorState.CONTACT_DETECTED;

				if (that.humidityAlert)
					alarmState1 = data.moisture <= that.humidityAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;

				if (that.lowLightAlert)
					alarmState2 = data.lux <= that.lowLightAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;

				if (that.fertilityAlert)
					alarmState3 = data.fertility <= that.fertilityAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;

				if (alarmState1 == Characteristic.ContactSensorState.CONTACT_NOT_DETECTED || alarmState2 == Characteristic.ContactSensorState.CONTACT_NOT_DETECTED || alarmState3 == Characteristic.ContactSensorState.CONTACT_NOT_DETECTED)
					alarmState = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;

				that.alertService.getCharacteristic(Characteristic.ContactSensorState)
					.updateValue(alarmState);
				that.alertService.getCharacteristic(Characteristic.StatusActive)
					.updateValue(true);
            }
            
            // that.plantSensorService.getCharacteristic(Characteristic.
        }
    });

    this.flora.on('firmware', function (data) {
        if (data.deviceId = that.deviceId) {
            that.log("Firmware: %s, Battery level: %s", data.firmwareVersion, data.batteryLevel);
            that.storedData.firmware = data;

            // Update values
            that.informationService.getCharacteristic(Characteristic.FirmwareRevision)
                .updateValue(data.firmwareVersion);

            that.batteryService.getCharacteristic(Characteristic.BatteryLevel)
                .updateValue(data.batteryLevel);
            that.batteryService.getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(data.batteryLevel <= 10 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);

            that.lightService.getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(data.batteryLevel <= 10 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);

            that.tempService.getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(data.batteryLevel <= 10 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);

            that.humidityService.getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(data.batteryLevel <= 10 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);

            if (that.humidityAlert || that.lowLightAlert || that.fertilityAlert) {
                that.alertService.getCharacteristic(Characteristic.StatusLowBattery)
                    .updateValue(data.batteryLevel <= 10 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
            }
        }
    });

    setInterval(function () {
        // Start scanning for updates, these will arrive in the corresponding callbacks
        that.flora.startScanning();

        // Stop scanning 100ms before we start a new scan
        setTimeout(function () {
            that.flora.stopScanning();
        }, (that.interval - 0.1) * 1000)
    }, this.interval * 1000);
}


MiFlowerCarePlugin.prototype.getFirmwareRevision = function (callback) {
    callback(null, this.storedData.firmware ? this.storedData.firmware.firmwareVersion : '0.0.0');
};

MiFlowerCarePlugin.prototype.getBatteryLevel = function (callback) {
    callback(null, this.storedData.firmware ? this.storedData.firmware.batteryLevel : 0);
};

MiFlowerCarePlugin.prototype.getStatusActive = function (callback) {
    callback(null, this.storedData.data ? true : false);
};

MiFlowerCarePlugin.prototype.getStatusLowBattery = function (callback) {
    if (this.storedData.firmware) {
        callback(null, this.storedData.firmware.batteryLevel <= 20 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    } else {
        callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }
};

MiFlowerCarePlugin.prototype.getStatusLowMoisture = function (callback) {
    if (this.storedData.data) {
        callback(null, this.storedData.data.moisture <= this.humidityAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
    } else {
        callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
};

MiFlowerCarePlugin.prototype.getStatusLowLight = function (callback) {
    if (this.storedData.data) {
        callback(null, this.storedData.data.lux <= this.lowLightAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
    } else {
        callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
};

MiFlowerCarePlugin.prototype.getStatusLowFertility = function (callback) {
    if (this.storedData.data) {
        callback(null, this.storedData.data.fertility <= this.fertilityAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
    } else {
        callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
};

MiFlowerCarePlugin.prototype.getCurrentAmbientLightLevel = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.lux : 0);
};

MiFlowerCarePlugin.prototype.getLightLevel = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.lux : 0);
};

MiFlowerCarePlugin.prototype.getCurrentTemperature = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.temperature : 0);
};

MiFlowerCarePlugin.prototype.getTemp = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.temperature : 0);
};

MiFlowerCarePlugin.prototype.getCurrentMoisture = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.moisture : 0);
};

MiFlowerCarePlugin.prototype.getCurrentFertility = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.fertility : 0);
};

MiFlowerCarePlugin.prototype.getInfo = function (callback) {

	var status;
	var h2o = false;
	var lux = false;
	var fertility = false;

	if (this.humidityAlert)
		if (this.storedData.data)
			h2o = this.storedData.data.moisture <= this.humidityAlertLevel;
	if (this.lowLightAlert)
		if (this.storedData.data)
			lux = this.storedData.data.lux <= this.lowLightAlertLevel;
	if (this.fertilityAlert)
		if (this.storedData.data)
			fertility = this.storedData.data.fertility <= this.fertilityAlertLevel;
			
	if (h2o) status = "WASSER";
	if (fertility) {
		if (h2o) status += ",";
		status += "DÜNGER";
	}
	if (lux) {
		if (h2o || fertility) status += ",";
		status += "LICHT";
	}
	
	if (this.storedData) {
		if (!h2o && !lux && !fertility) status = "OK";
	} else status = "";
			
    callback(null, status);
};


MiFlowerCarePlugin.prototype.setUpServices = function () {
    // info service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, this.config.manufacturer || "Xiaomi")
        .setCharacteristic(Characteristic.Model, this.config.model || "Flower Care")
        .setCharacteristic(Characteristic.SerialNumber, this.config.serial || hostname + "-" + this.name);
    this.informationService.getCharacteristic(Characteristic.FirmwareRevision)
        .on('get', this.getFirmwareRevision.bind(this));

    this.batteryService = new Service.BatteryService(this.name);
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevel.bind(this));
    this.batteryService.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGEABLE);
    this.batteryService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));

    this.tempService = new Service.TemperatureSensor(this.name);
    this.tempService.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    this.lightService = new Service.LightSensor(this.name);
    this.lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getCurrentAmbientLightLevel.bind(this));
    this.lightService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.lightService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    this.humidityService = new Service.HumiditySensor(this.name);
    this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getCurrentMoisture.bind(this));
    this.humidityService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.humidityService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    if (this.humidityAlert || this.lowLightAlert || this.fertilityAlert) {
        this.alertService = new Service.ContactSensor(this.name, "alert");
        this.alertService.getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getStatusLowMoisture.bind(this));
//        this.alertService.getCharacteristic(Characteristic.ContactSensorState)
//            .on('get', this.getStatusLowFertility.bind(this));
        this.alertService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getStatusLowBattery.bind(this));
        this.alertService.getCharacteristic(Characteristic.StatusActive)
            .on('get', this.getStatusActive.bind(this));
    }


    this.fakeGatoHistoryService = new FakeGatoHistoryService("room", this, { storage: 'fs' });

    /*
        own characteristics and services
    */
    
    Light = function () {
		Characteristic.call(this, 'Licht', '0000006B-0000-1000-8000-0026BB765291');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            unit: "lux",
            maxValue: 1000000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(Light, Characteristic);

    Light.UUID = '0000006B-0000-1000-8000-0026BB765291';
    

    // moisture characteristic
    SoilMoisture = function () {
        Characteristic.call(this, 'Erdfeuchte',   '00000010-0000-1000-8000-0026BB765291');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            unit: Characteristic.Units.PERCENTAGE,
            maxValue: 100,
            minValue: 0,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(SoilMoisture, Characteristic);

    SoilMoisture.UUID = '00000010-0000-1000-8000-0026BB765291';


    // temp characteristic
    Temp = function () {
        Characteristic.call(this, 'Temperatur',   '00000011-0000-1000-8000-0026BB765291');
        this.setProps({
            format: Characteristic.Formats.UINT8,
			unit: "°C",
            maxValue: 100,
            minValue: 0,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(Temp, Characteristic);

    Temp.UUID = '00000011-0000-1000-8000-0026BB765291';


    // fertility characteristic
    SoilFertility = function () {
        Characteristic.call(this, 'Düngung', '0029260E-B09C-4FD7-9E60-2C60F1250618');
        this.setProps({
            format: Characteristic.Formats.UINT8,
			unit: "µs/cm",
            maxValue: 10000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(SoilFertility, Characteristic);

    SoilFertility.UUID = '0029260E-B09C-4FD7-9E60-2C60F1250618';


    // alarm info characteristic
    Info = function () {
        Characteristic.call(this, 'Status', '0029260E-B09C-4FD7-9E60-2C60F1250619');
        this.setProps({
            format: Characteristic.Formats.STRING,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(Info, Characteristic);

    Info.UUID = '0029260E-B09C-4FD7-9E60-2C60F1250619';


    // moisture sensor
    PlantSensor = function (displayName, subtype) {
        Service.call(this, displayName, '3C233958-B5C4-4218-A0CD-60B8B971AA0A', subtype);

        // Required Characteristics
        this.addCharacteristic(SoilMoisture);
        this.addCharacteristic(Light);

        // Optional Characteristics
        this.addOptionalCharacteristic(SoilFertility);
        this.addOptionalCharacteristic(Characteristic.CurrentTemperature);
    };

    inherits(PlantSensor, Service);

    PlantSensor.UUID = '3C233958-B5C4-4218-A0CD-60B8B971AA0A';

    this.plantSensorService = new PlantSensor(this.name);
        
    this.plantSensorService.getCharacteristic(SoilFertility)
        .on('get', this.getCurrentFertility.bind(this));

    this.plantSensorService.getCharacteristic(Light)
        .on('get', this.getLightLevel.bind(this));

    this.plantSensorService.getCharacteristic(Temp)
        .on('get', this.getTemp.bind(this));

    this.plantSensorService.getCharacteristic(SoilMoisture)
        .on('get', this.getCurrentMoisture.bind(this));

    this.plantSensorService.getCharacteristic(Info)
        .on('get', this.getInfo.bind(this));
};


MiFlowerCarePlugin.prototype.getServices = function () {
	
    var services = [this.informationService, this.batteryService, this.plantSensorService, this.fakeGatoHistoryService];

    if (this.humidityAlert || this.lowLightAlert) {
        services[services.length] = this.alertService;
    }
    return services;
};
