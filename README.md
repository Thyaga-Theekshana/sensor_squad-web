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

## Run Locally

Start the prediction API first. In PowerShell:

```powershell
cd "D:\weather and air quality prediction\weather_prediction_model_backend"
..\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

The API listens on `http://localhost:8000` and provides the 24-hour forecast.

In a second terminal, serve the static frontend:

```powershell
cd "D:\weather and air quality prediction\whether_and_airquality_prediction\web"
python -m http.server 5500 --directory public
```

Open `http://localhost:5500` and keep both terminals running. The home dashboard
shows current Firebase readings and a 24-hour forecast summary; the
Predictions page provides the full forecast charts and insights.

For a deployed frontend, set `window.PREDICTION_API_URL` in
`web/public/prediction-api-config.js` to the HTTPS origin of the deployed Flask
API (without a trailing slash). The backend must be publicly reachable and allow
requests from the frontend origin. The dashboard and Predictions page use
`/forecast/24h`; the API can serve the 24-hour forecast with Open-Meteo when the
LSTM model is unavailable.

## Notes

- The repository is initialized for source control with a root-level `package.json` and `.gitignore`.
- The web app is a static frontend and can be hosted as-is via Netlify or other static hosts.
