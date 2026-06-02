# Weather and Air Quality Prediction

This repository contains a weather and air quality prediction project using an ESP32 weather station, Firebase backend, and a static web application.

## Structure

- `esp32_weather_station/` - PlatformIO firmware and ESP32 project files.
- `firebase_config/` - Firebase setup and export utilities.
- `web/` - Static web frontend and Netlify deployment configuration.

## Model backend repository

The machine learning backend has been separated into a dedicated repository: `weather_prediction_model_backend/`.
This repository contains training, prediction API, live prediction service, and automated retraining logic.

## Web Application

The web frontend is located in `web/public` and is configured for deployment using Netlify via `web/netlify.toml`.

## Project Setup

From the repository root:

```bash
npm install
```

This installs dependencies for the `web` workspace.

## Notes

- No UI or backend logic is modified by this project initialization.
- The repository is initialized for source control with a root-level `package.json` and `.gitignore`.
- The web app is a static frontend and can be hosted as-is via Netlify or other static hosts.
