#ifndef CONFIG_H
#define CONFIG_H

// WiFi Credentials
#define WIFI_SSID "Thyaga"
#define WIFI_PASSWORD "thyaga2004"

// Firebase Configuration
#define FIREBASE_HOST "weather-prediction-6c2c8-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "YOUR_DATABASE_SECRET_OR_TOKEN"
#define API_KEY "AIzaSyBptvW7U80-6pgLovbYsVCaMnH96VUWAnM"

// Firebase Realtime Database path
#define DATABASE_PATH "/weather_data"

// Sensor Configuration
#define SAMPLING_INTERVAL 60000  // 60 seconds (1 minute)

// Pin Definitions
#define RAIN_GAUGE_PIN 34        // Analog pin for rain gauge
#define ANEMOMETER_PIN 35        // Analog pin for anemometer
#define WIND_VANE_PIN 32         // Analog pin for wind vane
#define CO_SENSOR_PIN 33         // Analog pin for MICS5524 CO sensor
#define MHZ19_RX_PIN 16          // MH-Z19C RX
#define MHZ19_TX_PIN 17          // MH-Z19C TX
#define PMS5003_RX_PIN 26        // PMS5003 RX
#define PMS5003_TX_PIN 27        // PMS5003 TX

// I2C pins (default for ESP32)
#define I2C_SDA 21
#define I2C_SCL 22

#endif
