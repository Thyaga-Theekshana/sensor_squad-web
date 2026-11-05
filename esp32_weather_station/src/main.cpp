#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <ArduinoJson.h>

// Sensor Libraries
#include <Adafruit_AHTX0.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <MHZ19.h>
#include <PMS.h>
#include <Adafruit_SGP40.h>

#include "config.h"

// Sensor Objects
Adafruit_AHTX0 aht10;
Adafruit_BME280 bme280;
BH1750 lightMeter;
MHZ19 mhz19;
PMS pms(Serial2);
Adafruit_SGP40 sgp40;

// Firebase Objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Serial for MH-Z19C
HardwareSerial mhzSerial(1);

// Timing
unsigned long lastSampleTime = 0;
bool firebaseReady = false;

// Sensor Data Structure
struct SensorData {
    // Weather data
    float temperature;
    float humidity;
    float pressure;
    float rainfall;
    float lightIntensity;
    float windSpeed;
    float windDirection;
    
    // Air quality data
    uint16_t voc;
    uint16_t nox;
    uint16_t pm1_0;
    uint16_t pm2_5;
    uint16_t pm10;
    int co2;
    float coGas;
    
    // Metadata
    unsigned long timestamp;
    bool valid;
};

SensorData currentData;

// Function Prototypes
void initWiFi();
void initSensors();
void initFirebase();
void readAllSensors();
void sendToFirebase();
float readRainGauge();
float readAnemometer();
float readWindVane();
float readCOSensor();

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("ESP32 Weather Station Starting...");
    
    // Initialize I2C
    Wire.begin(I2C_SDA, I2C_SCL);
    
    // Initialize Serial for PMS5003
    Serial2.begin(9600, SERIAL_8N1, PMS5003_RX_PIN, PMS5003_TX_PIN);
    
    // Initialize Serial for MH-Z19C
    mhzSerial.begin(9600, SERIAL_8N1, MHZ19_RX_PIN, MHZ19_TX_PIN);
    mhz19.begin(mhzSerial);
    
    // Initialize analog pins
    pinMode(RAIN_GAUGE_PIN, INPUT);
    pinMode(ANEMOMETER_PIN, INPUT);
    pinMode(WIND_VANE_PIN, INPUT);
    pinMode(CO_SENSOR_PIN, INPUT);
    
    // Connect to WiFi
    initWiFi();
    
    // Initialize sensors
    initSensors();
    
    // Initialize Firebase
    initFirebase();
    
    Serial.println("Setup Complete!");
}

void loop() {
    unsigned long currentTime = millis();
    
    // Check if it's time to sample
    if (currentTime - lastSampleTime >= SAMPLING_INTERVAL) {
        lastSampleTime = currentTime;
        
        Serial.println("\n=== Reading Sensors ===");
        readAllSensors();
        
        if (currentData.valid && firebaseReady) {
            Serial.println("=== Sending to Firebase ===");
            sendToFirebase();
        } else {
            Serial.println("Data invalid or Firebase not ready");
        }
    }
    
    // Small delay to prevent watchdog issues
    delay(10);
}

void initWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi Connected!");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi Connection Failed!");
    }
}

void initSensors() {
    Serial.println("Initializing Sensors...");
    
    // Initialize AHT10
    if (aht10.begin()) {
        Serial.println("✓ AHT10 initialized");
    } else {
        Serial.println("✗ AHT10 failed");
    }
    
    // Initialize BME280
    if (bme280.begin(0x76)) {
        Serial.println("✓ BME280 initialized");
    } else {
        Serial.println("✗ BME280 failed");
    }
    
    // Initialize BH1750
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
        Serial.println("✓ BH1750 initialized");
    } else {
        Serial.println("✗ BH1750 failed");
    }
    
    // Initialize SGP40
    if (sgp40.begin()) {
        Serial.println("✓ SGP40 initialized");
    } else {
        Serial.println("✗ SGP40 failed");
    }
    
    // Initialize PMS5003
    pms.passiveMode();
    Serial.println("✓ PMS5003 initialized");
    
    // MH-Z19C auto-calibration off
    mhz19.autoCalibration(false);
    Serial.println("✓ MH-Z19C initialized");
    
    Serial.println("Sensor initialization complete!");
}

void initFirebase() {
    Serial.println("Initializing Firebase...");
    
    config.api_key = API_KEY;
    config.database_url = FIREBASE_HOST;
    
    // Sign in anonymously or use auth token
    if (Firebase.signUp(&config, &auth, "", "")) {
        Serial.println("✓ Firebase authentication successful");
        firebaseReady = true;
    } else {
        Serial.printf("✗ Firebase auth failed: %s\n", config.signer.signupError.message.c_str());
    }
    
    config.token_status_callback = tokenStatusCallback;
    
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
}

void readAllSensors() {
    currentData.timestamp = millis() / 1000;
    currentData.valid = true;
    
    // Read AHT10 - Temperature & Humidity
    sensors_event_t humidity_event, temp_event;
    aht10.getEvent(&humidity_event, &temp_event);
    currentData.temperature = temp_event.temperature;
    currentData.humidity = humidity_event.relative_humidity;
    Serial.printf("Temperature: %.2f°C, Humidity: %.2f%%\n", 
                  currentData.temperature, currentData.humidity);
    
    // Read BME280 - Atmospheric Pressure
    currentData.pressure = bme280.readPressure() / 100.0F;
    Serial.printf("Pressure: %.2f hPa\n", currentData.pressure);
    
    // Read BH1750 - Light Intensity
    currentData.lightIntensity = lightMeter.readLightLevel();
    Serial.printf("Light: %.2f lux\n", currentData.lightIntensity);
    
    // Read Rain Gauge
    currentData.rainfall = readRainGauge();
    Serial.printf("Rainfall: %.2f mm\n", currentData.rainfall);
    
    // Read Anemometer - Wind Speed
    currentData.windSpeed = readAnemometer();
    Serial.printf("Wind Speed: %.2f m/s\n", currentData.windSpeed);
    
    // Read Wind Vane - Wind Direction
    currentData.windDirection = readWindVane();
    Serial.printf("Wind Direction: %.2f°\n", currentData.windDirection);
    
    // Read SGP40 - VOC
    currentData.voc = sgp40.measureVocIndex(currentData.temperature, currentData.humidity);
    currentData.nox = 0;
    Serial.printf("VOC Index: %d\n", currentData.voc);
    
    // Read PMS5003 - Particulate Matter
    pms.requestRead();
    delay(1000);
    PMS::DATA pmsData;
    if (pms.readUntil(pmsData)) {
        currentData.pm1_0 = pmsData.PM_AE_UG_1_0;
        currentData.pm2_5 = pmsData.PM_AE_UG_2_5;
        currentData.pm10 = pmsData.PM_AE_UG_10_0;
        Serial.printf("PM1.0: %d, PM2.5: %d, PM10: %d µg/m³\n", 
                      currentData.pm1_0, currentData.pm2_5, currentData.pm10);
    } else {
        Serial.println("PMS5003 read failed");
        currentData.pm1_0 = currentData.pm2_5 = currentData.pm10 = 0;
    }
    
    // Read MH-Z19C - CO2
    currentData.co2 = mhz19.getCO2();
    Serial.printf("CO2: %d ppm\n", currentData.co2);
    
    // Read MICS5524 - CO Gas
    currentData.coGas = readCOSensor();
    Serial.printf("CO Gas: %.2f ppm\n", currentData.coGas);
}

void sendToFirebase() {
    if (!Firebase.ready()) {
        Serial.println("Firebase not ready");
        return;
    }
    
    FirebaseJson json;
    
    json.set("weather/temperature", currentData.temperature);
    json.set("weather/humidity", currentData.humidity);
    json.set("weather/pressure", currentData.pressure);
    json.set("weather/rainfall", currentData.rainfall);
    json.set("weather/light_intensity", currentData.lightIntensity);
    json.set("weather/wind_speed", currentData.windSpeed);
    json.set("weather/wind_direction", currentData.windDirection);
    
    json.set("air_quality/voc", currentData.voc);
    json.set("air_quality/nox", currentData.nox);
    json.set("air_quality/pm1_0", currentData.pm1_0);
    json.set("air_quality/pm2_5", currentData.pm2_5);
    json.set("air_quality/pm10", currentData.pm10);
    json.set("air_quality/co2", currentData.co2);
    json.set("air_quality/co", currentData.coGas);
    
    json.set("timestamp", currentData.timestamp);
    json.set("device_id", "ESP32_WEATHER_001");
    
    String path = String(DATABASE_PATH) + "/" + String(currentData.timestamp);
    
    if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
        Serial.println("✓ Data sent to Firebase successfully");
    } else {
        Serial.println("✗ Firebase send failed");
        Serial.println("Reason: " + fbdo.errorReason());
    }
}

float readRainGauge() {
    int rawValue = analogRead(RAIN_GAUGE_PIN);
    float voltage = rawValue * (3.3 / 4095.0);
    float rainfall = voltage * 10.0;
    return rainfall;
}

float readAnemometer() {
    int rawValue = analogRead(ANEMOMETER_PIN);
    float voltage = rawValue * (3.3 / 4095.0);
    float windSpeed = (voltage - 0.4) * 32.4 / 1.6;
    return max(0.0f, windSpeed);
}

float readWindVane() {
    int rawValue = analogRead(WIND_VANE_PIN);
    float voltage = rawValue * (3.3 / 4095.0);
    float direction = (voltage / 3.3) * 360.0;
    return direction;
}

float readCOSensor() {
    int rawValue = analogRead(CO_SENSOR_PIN);
    float voltage = rawValue * (3.3 / 4095.0);
    float rs = (3.3 - voltage) / voltage;
    float ratio = rs / 1.0;
    float ppm = pow(10, ((log10(ratio) - 0.76) / -0.52));
    return ppm;
}
