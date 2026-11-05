// predictions.js — ML-powered 24-hour forecasting

const PREDICTION_API_CANDIDATES = [
    window.PREDICTION_API_URL,
    'http://127.0.0.1:8000',
    'http://localhost:8000'
].filter(Boolean);

let PREDICTION_API_BASE = PREDICTION_API_CANDIDATES[0] || 'http://127.0.0.1:8000';

let currentData = {
    temp: 26.5,
    humidity: 62.0,
    pressure: 1012.0,
    aqi: 42.0,
    pm25: 12.5,
    pm10: 18.0,
    light: 850,
    rainfall: 0,
    windSpeed: 2.5
};

let hourlyForecast = [];
let chartInstance = null;
let activeParam = 'temperature';
let mlPredictions = null;
let apiMeta = { modelLoaded: false, source: 'fallback', hourlySource: 'fallback' };
let initRetryCount = 0;

document.addEventListener('DOMContentLoaded', function () {
    updateClock();
    setInterval(updateClock, 1000);
    createParticles();
    setupTabListeners();
    setupSimulator();
    initPredictions();
});

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('currentTime');
    if (clockEl) {
        clockEl.textContent = `${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | ${now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
}

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 8 + 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${Math.random() * 12 + 10}s`;
        container.appendChild(particle);
    }
}

function setupTabListeners() {
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            activeParam = this.getAttribute('data-param');
            renderForecastChart();
        });
    });
}

// ─── AQI helpers ───────────────────────────────────────────────

function getAQICategory(aqi) {
    if (aqi <= 50) return { level: 'GOOD', label: 'Good', color: '#00cc66', advice: 'Air quality is satisfactory. Ideal for outdoor activities.' };
    if (aqi <= 100) return { level: 'MODERATE', label: 'Moderate', color: '#ffcc00', advice: 'Acceptable for most people. Sensitive groups should limit prolonged exertion.' };
    if (aqi <= 150) return { level: 'SENSITIVE', label: 'Unhealthy for Sensitive Groups', color: '#ff9933', advice: 'Children, elderly, and those with respiratory issues should reduce outdoor activity.' };
    if (aqi <= 200) return { level: 'UNHEALTHY', label: 'Unhealthy', color: '#ff6666', advice: 'Everyone may experience health effects. Limit outdoor exposure.' };
    if (aqi <= 300) return { level: 'VERY UNHEALTHY', label: 'Very Unhealthy', color: '#cc3333', advice: 'Health alert — avoid outdoor activities. Use air purifiers indoors.' };
    return { level: 'HAZARDOUS', label: 'Hazardous', color: '#990099', advice: 'Emergency conditions. Stay indoors with sealed windows.' };
}

function pm25FromAQI(aqi) {
    return Math.max(1, parseFloat((aqi * 0.28).toFixed(1)));
}

function updateCurrentAQIDisplay() {
    const aqi = Math.round(currentData.aqi);
    const cat = getAQICategory(aqi);
    const pm25 = currentData.pm25 || pm25FromAQI(aqi);
    const pm10 = currentData.pm10 || parseFloat((pm25 * 1.6).toFixed(1));

    const valueEl = document.getElementById('currentAqiValue');
    const badgeEl = document.getElementById('currentAqiBadge');
    const labelEl = document.getElementById('currentAqiLabel');
    const pm25El = document.getElementById('currentPm25');
    const pm10El = document.getElementById('currentPm10');
    const adviceEl = document.getElementById('currentAqiAdvice');
    const ringEl = document.getElementById('currentAqiRing');
    const cardEl = document.getElementById('currentAqiCard');

    if (valueEl) valueEl.textContent = aqi;
    if (badgeEl) {
        badgeEl.textContent = cat.level;
        badgeEl.style.background = cat.color + '22';
        badgeEl.style.borderColor = cat.color;
        badgeEl.style.color = cat.color;
    }
    if (labelEl) labelEl.textContent = cat.label;
    if (pm25El) pm25El.textContent = pm25.toFixed(1);
    if (pm10El) pm10El.textContent = pm10.toFixed(1);
    if (adviceEl) adviceEl.textContent = cat.advice;
    if (ringEl) {
        const pct = Math.min(aqi / 300, 1);
        ringEl.style.strokeDashoffset = 502 - pct * 502;
        ringEl.style.stroke = cat.color;
        ringEl.style.filter = `drop-shadow(0 0 8px ${cat.color})`;
    }
    if (cardEl) cardEl.style.borderColor = cat.color + '55';

    const tempEl = document.getElementById('currentAqiTemp');
    const humEl = document.getElementById('currentAqiHum');
    if (tempEl) tempEl.textContent = `${currentData.temp.toFixed(1)} °C`;
    if (humEl) humEl.textContent = `${currentData.humidity.toFixed(0)} %`;

    document.querySelectorAll('.aqi-scale-item').forEach(item => {
        const max = parseInt(item.dataset.max, 10);
        const min = parseInt(item.dataset.min, 10);
        item.classList.toggle('active', aqi >= min && aqi <= max);
    });

    const trendEl = document.getElementById('aqiTrendText');
    if (trendEl && hourlyForecast.length > 6) {
        const later = hourlyForecast[6].aqi;
        const diff = later - aqi;
        if (diff > 8) trendEl.innerHTML = `<i class="fas fa-arrow-trend-up"></i> Rising +${Math.round(diff)} by 6h (watch evening traffic)`;
        else if (diff < -8) trendEl.innerHTML = `<i class="fas fa-arrow-trend-down"></i> Improving ${Math.round(diff)} by 6h`;
        else trendEl.innerHTML = `<i class="fas fa-minus"></i> Stable over next 6 hours`;
    }
}

function updateDataSourceBadge() {
    const badge = document.getElementById('forecastSourceBadge');
    if (!badge) return;
    const hourlyLabel = apiMeta.hourlySource === 'lstm'
        ? '✅ LSTM 24h'
        : apiMeta.hourlySource === 'open-meteo-fallback'
        ? '⚡ Open-Meteo 24h'
        : '📊 Statistical 24h';
    badge.className = apiMeta.hourlySource === 'lstm' ? 'source-badge ml' : 'source-badge fallback';
    badge.innerHTML = `<i class="fas fa-satellite"></i> ${hourlyLabel} · Moratuwa`;
}

// ─── Firebase data ─────────────────────────────────────────────

function applyHistoryRecord(record) {
    if (!record) return;
    if (record.temperature != null) currentData.temp = Number(record.temperature);
    if (record.humidity != null) currentData.humidity = Number(record.humidity);
    if (record.pressure != null) currentData.pressure = Number(record.pressure);
    if (record.light != null) currentData.light = Number(record.light);
    if (record.light_intensity != null) currentData.light = Number(record.light_intensity);
    if (record.rainfall != null) currentData.rainfall = Number(record.rainfall);
    if (record.wind_speed != null) currentData.windSpeed = Number(record.wind_speed);
    if (record.aqi != null) currentData.aqi = Number(record.aqi);
    if (record.pm25 != null) currentData.pm25 = Number(record.pm25);
    if (record.pm2_5 != null) currentData.pm25 = Number(record.pm2_5);
    if (record.pm10 != null) currentData.pm10 = Number(record.pm10);
    if (record.pm1_0 != null) currentData.pm10 = Number(record.pm1_0);
}

async function loadCsvFallbackData() {
    try {
        const base = await resolvePredictionApiBase();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${base}/sensor-data/fallback?limit=48`, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) return [];

        const json = await res.json();
        if (json.success && Array.isArray(json.records) && json.records.length) {
            const records = json.records.map(row => ({ ...row }));
            if (records.length) {
                applyHistoryRecord(records[records.length - 1]);
            }
            return records;
        }
    } catch (err) {
        console.warn('CSV fallback sensor history unavailable:', err.message);
    }

    return [];
}

async function loadFirebaseData() {
    if (window.firebaseHelpers?.firebaseInitialized) {
        try {
            const weatherData = await getLatestFromFirebase('weather_data', 48);
            const pollutionData = await getLatestFromFirebase('pollution_data', 48);

            if (weatherData?.length || pollutionData?.length) {
                if (weatherData?.length) {
                    const latestW = weatherData[0];
                    if (latestW.temperature != null) currentData.temp = latestW.temperature;
                    if (latestW.humidity != null) currentData.humidity = latestW.humidity;
                    if (latestW.pressure != null) currentData.pressure = latestW.pressure;
                    if (latestW.light != null) currentData.light = latestW.light;
                    if (latestW.rainfall != null) currentData.rainfall = latestW.rainfall;
                }

                if (pollutionData?.length) {
                    const latestP = pollutionData[0];
                    if (latestP.aqi != null) currentData.aqi = latestP.aqi;
                    if (latestP.pm25 != null) currentData.pm25 = latestP.pm25;
                    if (latestP.pm10 != null) currentData.pm10 = latestP.pm10;
                }

                const merged = mergeHistoryRecords(weatherData || [], pollutionData || []);
                if (merged.length) {
                    applyHistoryRecord(merged[merged.length - 1]);
                    return merged;
                }
            }
        } catch (err) {
            console.warn('Firebase history fetch failed; falling back to CSV.', err.message);
        }
    } else {
        console.warn('Firebase is unavailable; loading CSV fallback sensor history.');
    }

    const fallbackHistory = await loadCsvFallbackData();
    if (fallbackHistory.length) {
        console.log('✅ Using local CSV fallback sensor history for the dashboard.');
        return fallbackHistory;
    }

    console.warn('No sensor history available from Firebase or CSV fallback.');
    return [];
}

function mergeHistoryRecords(weatherRows, pollutionRows) {
    const byTs = {};

    weatherRows.forEach(row => {
        const ts = row.timestamp || row.id;
        if (!ts) return;
        byTs[ts] = {
            datetime: new Date(ts).toISOString(),
            timestamp: ts,
            temperature: row.temperature ?? currentData.temp,
            humidity: row.humidity ?? currentData.humidity,
            pressure: row.pressure ?? currentData.pressure,
            rainfall: row.rainfall ?? 0,
            light_intensity: row.light ?? currentData.light,
            wind_speed: row.wind_speed ?? currentData.windSpeed,
            wind_direction: row.wind_direction ?? 180,
            voc: 100,
            pm2_5: currentData.pm25,
            co2: 400
        };
    });

    pollutionRows.forEach(row => {
        const ts = row.timestamp || row.id;
        if (!ts) return;
        if (!byTs[ts]) {
            byTs[ts] = {
                datetime: new Date(ts).toISOString(),
                timestamp: ts,
                temperature: currentData.temp,
                humidity: currentData.humidity,
                pressure: currentData.pressure,
                rainfall: 0,
                light_intensity: currentData.light,
                wind_speed: currentData.windSpeed,
                wind_direction: 180,
                voc: 100,
                pm2_5: row.pm25 ?? currentData.pm25,
                co2: 400
            };
        }
        if (row.pm25 != null) byTs[ts].pm2_5 = row.pm25;
        if (row.aqi != null) byTs[ts].aqi = row.aqi;
    });

    return Object.values(byTs).sort((a, b) => a.timestamp - b.timestamp);
}

// ─── ML API ────────────────────────────────────────────────────

async function resolvePredictionApiBase() {
    for (const candidate of PREDICTION_API_CANDIDATES) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`${candidate}/health`, { signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
                PREDICTION_API_BASE = candidate;
                return candidate;
            }
        } catch {
            // Try the next candidate.
        }
    }
    return PREDICTION_API_BASE;
}

async function fetchApiHealth() {
    const base = await resolvePredictionApiBase();
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${base}/health`, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

async function postPredictionApi(path, body) {
    const base = await resolvePredictionApiBase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
        signal: controller.signal
    });
    clearTimeout(timer);
    return res.json();
}

async function fetchMLPrediction(historyRecords) {
    const health = await fetchApiHealth();
    if (!health?.model_loaded) {
        apiMeta = { ...apiMeta, modelLoaded: false, source: 'fallback' };
        return null;
    }

    try {
        let json;
        if (historyRecords?.length >= 3) {
            json = await postPredictionApi('/predict', { data: historyRecords });
        } else {
            json = await postPredictionApi('/predict-from-firebase', {});
        }
        if (json.success && json.predictions) {
            apiMeta = { ...apiMeta, modelLoaded: true, source: 'ml', horizon: json.predictions.forecast_horizon_hours || 48 };
            return json.predictions;
        }
    } catch (err) {
        console.warn('ML API unavailable:', err.message);
    }

    apiMeta = { ...apiMeta, modelLoaded: false, source: 'fallback' };
    return null;
}

// ─── 24-Hour Hourly Forecast (real API-driven) ────────────────────────────────

async function fetchHourly24h() {
    hourlyForecast = [];

    // ── Path 1: Try /forecast/24h on our backend (LSTM or Open-Meteo fallback) ──
    try {
        const base = await resolvePredictionApiBase();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(`${base}/forecast/24h`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.hours?.length >= 1) {
                hourlyForecast = json.hours.map(h => ({
                    timeLabel:   h.timeLabel,
                    datetime:    h.datetime,
                    temperature: h.temperature ?? currentData.temp,
                    humidity:    h.humidity    ?? currentData.humidity,
                    pressure:    h.pressure    ?? currentData.pressure,
                    wind_speed:  h.wind_speed  ?? currentData.windSpeed,
                    rainfall:    h.rainfall    ?? 0,
                    aqi:         h.aqi         ?? currentData.aqi,
                    source:      json.source   || 'lstm',
                }));
                const isMl = json.source === 'lstm';
                apiMeta = {
                    ...apiMeta,
                    modelLoaded: isMl,
                    hourlySource: json.source || 'open-meteo-fallback',
                };
                console.log(`✅ 24h forecast loaded (${json.source}) — ${hourlyForecast.length} hours`);
                return;
            }
        }
    } catch (err) {
        console.warn('Backend /forecast/24h unreachable:', err.message);
    }

    // ── Path 2: Call Open-Meteo hourly forecast directly from the browser ──
    console.log('⚡ Falling back to direct Open-Meteo hourly forecast...');
    try {
        const METEO_URL = 'https://api.open-meteo.com/v1/forecast';
        const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
        const LAT = 6.7956, LON = 79.9009;

        const [weatherResp, aqResp] = await Promise.allSettled([
            fetch(`${METEO_URL}?latitude=${LAT}&longitude=${LON}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,rain,wind_speed_10m&wind_speed_unit=ms&forecast_hours=24&timezone=Asia%2FColombo`),
            fetch(`${AQ_URL}?latitude=${LAT}&longitude=${LON}&hourly=us_aqi&forecast_hours=24&timezone=Asia%2FColombo`)
        ]);

        let weatherJson = null, aqJson = null;
        if (weatherResp.status === 'fulfilled' && weatherResp.value.ok) {
            weatherJson = await weatherResp.value.json();
        }
        if (aqResp.status === 'fulfilled' && aqResp.value.ok) {
            aqJson = await aqResp.value.json();
        }

        if (weatherJson?.hourly?.time?.length) {
            const wh = weatherJson.hourly;
            const aqiArr = aqJson?.hourly?.us_aqi || [];
            hourlyForecast = wh.time.slice(0, 24).map((t, i) => {
                const dt = new Date(t);
                return {
                    timeLabel:   dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    datetime:    t,
                    temperature: parseFloat((wh.temperature_2m?.[i] ?? currentData.temp).toFixed(1)),
                    humidity:    parseFloat((wh.relative_humidity_2m?.[i] ?? currentData.humidity).toFixed(1)),
                    pressure:    parseFloat((wh.surface_pressure?.[i] ?? currentData.pressure).toFixed(1)),
                    wind_speed:  parseFloat((wh.wind_speed_10m?.[i] ?? currentData.windSpeed).toFixed(1)),
                    rainfall:    parseFloat((wh.rain?.[i] ?? 0).toFixed(2)),
                    aqi:         aqiArr[i] != null ? Math.round(aqiArr[i]) : estimateAQIFromHour(dt.getHours(), wh.wind_speed_10m?.[i] ?? 5, wh.rain?.[i] ?? 0),
                    source:      'open-meteo-direct',
                };
            });
            apiMeta = { ...apiMeta, modelLoaded: false, hourlySource: 'open-meteo-fallback' };
            console.log(`✅ Open-Meteo direct 24h forecast loaded — ${hourlyForecast.length} hours`);
            return;
        }
    } catch (err) {
        console.warn('Open-Meteo direct fetch failed:', err.message);
    }

    // ── Path 3: Pure statistical diurnal fallback ──
    console.warn('Using statistical diurnal fallback for 24h forecast');
    buildHourlyStatisticalFallback();
    apiMeta = { ...apiMeta, modelLoaded: false, hourlySource: 'statistical' };
}

function estimateAQIFromHour(hour, wind = 5, rain = 0) {
    const traffic = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19) ? 15
                  : (hour >= 21 || hour <= 4) ? 8 : -5;
    const dispersion = Math.exp(-0.03 * Math.max(wind, 0.1));
    const rainWash = rain > 0.5 ? -12 : 0;
    return Math.max(5, Math.round(45 * dispersion + traffic * dispersion + rainWash + 4 * Math.sin(2 * Math.PI * hour / 24)));
}

function buildHourlyStatisticalFallback() {
    hourlyForecast = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const forecastTime = new Date(now.getTime() + i * 3600000);
        const hour = forecastTime.getHours();
        const diurnalTemp = 4.5 * Math.cos(2 * Math.PI * (hour - 15) / 24);
        const diurnalHum = -15 * Math.cos(2 * Math.PI * (hour - 15) / 24);
        hourlyForecast.push({
            timeLabel:   forecastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            datetime:    forecastTime.toISOString(),
            temperature: parseFloat((currentData.temp + diurnalTemp).toFixed(1)),
            humidity:    parseFloat(Math.max(10, Math.min(100, currentData.humidity + diurnalHum)).toFixed(1)),
            pressure:    parseFloat((currentData.pressure + 1.2 * Math.cos(4 * Math.PI * (hour - 10) / 24)).toFixed(1)),
            wind_speed:  currentData.windSpeed,
            rainfall:    0,
            aqi:         estimateAQIFromHour(hour, currentData.windSpeed, 0),
            source:      'statistical',
        });
    }
}

// ─── AI Insights (prediction-driven) ───────────────────────────

function generateAIInsights() {
    const list = document.getElementById('aiInsightsList');
    if (!list) return;
    list.innerHTML = '';
    const insights = [];

    const maxAqiHour = hourlyForecast.reduce((best, h, i) => h.aqi > hourlyForecast[best].aqi ? i : best, 0);
    const minAqiHour = hourlyForecast.reduce((best, h, i) => h.aqi < hourlyForecast[best].aqi ? i : best, 0);
    const peakAqi = hourlyForecast[maxAqiHour]?.aqi ?? currentData.aqi;
    const bestAqi = hourlyForecast[minAqiHour]?.aqi ?? currentData.aqi;
    const avgTemp = hourlyForecast.reduce((s, h) => s + h.temperature, 0) / (hourlyForecast.length || 1);
    if (apiMeta.modelLoaded || apiMeta.hourlySource === 'lstm') {
        insights.push({
            type: 'success',
            icon: 'fa-robot',
            title: 'LSTM Model Active (24h Autoregressive)',
            text: `True hourly projections from your Moratuwa-trained LSTM — 24 autoregressive steps using real Open-Meteo seed data.`
        });
    } else if (apiMeta.hourlySource === 'open-meteo-fallback' || apiMeta.hourlySource === 'open-meteo-direct') {
        insights.push({
            type: 'info',
            icon: 'fa-satellite-dish',
            title: 'Open-Meteo 24h Forecast (Fallback)',
            text: `LSTM backend unavailable. Using live Open-Meteo hourly weather forecast for Moratuwa (6.796°N, 79.901°E). Data is real — not statistical.`
        });
    } else {
        insights.push({
            type: 'info',
            icon: 'fa-chart-line',
            title: 'Statistical Diurnal Forecast (Offline)',
            text: `Both ML backend and Open-Meteo are unreachable. Showing diurnal pattern estimate based on current sensor readings.`
        });
    }

    if (peakAqi > 100) {
        insights.push({
            type: 'warning',
            icon: 'fa-lungs',
            title: `AQI Peak Forecast: ${peakAqi} at ${hourlyForecast[maxAqiHour]?.timeLabel}`,
            text: `Air quality may reach "${getAQICategory(peakAqi).label}" levels. Sensitive groups should avoid outdoor exertion around this window. Best air expected at ${hourlyForecast[minAqiHour]?.timeLabel} (AQI ${bestAqi}).`
        });
    } else if (peakAqi <= 50) {
        insights.push({
            type: 'success',
            icon: 'fa-leaf',
            title: 'Excellent Air Quality Expected',
            text: `All 24 projected hours stay in the Good range (peak AQI ${peakAqi}). Safe for outdoor sports and ventilation.`
        });
    } else {
        insights.push({
            type: 'info',
            icon: 'fa-wind',
            title: `Moderate Air — Peak AQI ${peakAqi}`,
            text: `Peak at ${hourlyForecast[maxAqiHour]?.timeLabel}, improving to ${bestAqi} by ${hourlyForecast[minAqiHour]?.timeLabel}. Generally acceptable for healthy adults.`
        });
    }

    if (avgTemp > currentData.temp + 2) {
        insights.push({
            type: 'warning',
            icon: 'fa-temperature-high',
            title: 'Warming Trend Detected',
            text: `Average projected temperature (${avgTemp.toFixed(1)}°C) is above current (${currentData.temp.toFixed(1)}°C). Heat may increase ozone formation — watch AQI in afternoon hours.`
        });
    } else if (avgTemp < currentData.temp - 2) {
        insights.push({
            type: 'info',
            icon: 'fa-temperature-low',
            title: 'Cooling Trend Ahead',
            text: `Temperatures trending down to ~${avgTemp.toFixed(1)}°C average. Nighttime thermal inversions possible — particulates may accumulate before dawn.`
        });
    }

    if (currentData.pressure < 1010 || mlPredictions?.rainfall > 0.3) {
        insights.push({
            type: 'info',
            icon: 'fa-cloud-rain',
            title: 'Precipitation Signal in Model',
            text: `Pressure at ${currentData.pressure.toFixed(1)} hPa${mlPredictions?.rainfall > 0 ? ` with ${mlPredictions.rainfall.toFixed(1)} mm rain forecast` : ''}. Rain typically washes particulates — expect temporary AQI improvement after showers.`
        });
    }

    insights.forEach(item => {
        const card = document.createElement('div');
        card.className = `insight-card ${item.type}`;
        card.innerHTML = `
            <div class="insight-icon"><i class="fas ${item.icon}"></i></div>
            <div class="insight-info"><h4>${item.title}</h4><p>${item.text}</p></div>
        `;
        list.appendChild(card);
    });
}

// ─── Init orchestration ──────────────────────────────────────────

async function initPredictions() {
    const history = await loadFirebaseData();

    // Fetch 24h hourly forecast (LSTM → Open-Meteo fallback → statistical)
    await fetchHourly24h();

    // Also kick off the single-step legacy prediction (for the insights context)
    mlPredictions = await fetchMLPrediction(history);

    const now = new Date();
    const lastUpdate = document.getElementById('lastUpdateTime');
    if (lastUpdate) lastUpdate.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    updateCurrentAQIDisplay();
    updateDataSourceBadge();
    generateAIInsights();
    renderForecastChart();
    resetSimulatorToCurrent();
}

// ─── Chart ───────────────────────────────────────────────────────

function renderForecastChart() {
    const canvas = document.getElementById('predictionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = hourlyForecast.map(f => f.timeLabel);
    const configs = {
        temperature: { values: hourlyForecast.map(f => f.temperature), color: '#ff4757', label: 'Temperature (°C)', zero: false },
        humidity:    { values: hourlyForecast.map(f => f.humidity),    color: '#3742fa', label: 'Humidity (%)',       zero: false },
        pressure:    { values: hourlyForecast.map(f => f.pressure),    color: '#1abc9c', label: 'Pressure (hPa)',     zero: false },
        wind_speed:  { values: hourlyForecast.map(f => f.wind_speed),  color: '#f39c12', label: 'Wind Speed (m/s)', zero: true  },
        aqi:         { values: hourlyForecast.map(f => f.aqi),         color: '#c792ea', label: 'Air Quality Index', zero: true  }
    };
    const cfg = configs[activeParam] || configs.temperature;
    const dataValues = cfg.values;

    const margin = activeParam === 'pressure' ? 2 : activeParam === 'aqi' ? 10 : activeParam === 'humidity' ? 6 : 1.5;
    const upperLimit = dataValues.map(v => activeParam === 'humidity' ? Math.min(100, v + margin) : v + margin);
    const lowerLimit = dataValues.map(v => activeParam === 'humidity' ? Math.max(0, v - margin) : Math.max(0, v - margin));

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Upper', data: upperLimit, borderColor: 'transparent', backgroundColor: cfg.color + '06', fill: false, pointRadius: 0, tension: 0.4 },
                { label: 'Lower', data: lowerLimit, borderColor: 'transparent', backgroundColor: cfg.color + '06', fill: '-1', pointRadius: 0, tension: 0.4 },
                {
                    label: `${cfg.label} Forecast`,
                    data: dataValues,
                    borderColor: cfg.color,
                    backgroundColor: cfg.color + '15',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: cfg.color,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#fff', filter: item => !item.text.includes('Upper') && !item.text.includes('Lower') }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 25, 45, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: cfg.color,
                    borderWidth: 1,
                    callbacks: { label: ctx => ctx.dataset.label.includes('Forecast') ? `${ctx.dataset.label}: ${ctx.parsed.y}` : null }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                    ticks: { color: '#a0b3d6', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
                    title: { display: true, text: 'Next 24 Hours', color: '#fff', font: { weight: 'bold' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] },
                    ticks: { color: '#a0b3d6' },
                    title: { display: true, text: cfg.label, color: '#fff', font: { weight: 'bold' } },
                    beginAtZero: cfg.zero
                }
            }
        }
    });
}

// ─── Simulator (unchanged logic) ─────────────────────────────────

function setupSimulator() {
    ['Temp', 'Humidity', 'Wind', 'Emission'].forEach(slider => {
        const el = document.getElementById(`simSlider${slider}`);
        if (el) el.addEventListener('input', runSimulation);
    });
    document.getElementById('simResetBtn')?.addEventListener('click', resetSimulatorToCurrent);
    runSimulation();
}

function resetSimulatorToCurrent() {
    const sTemp = document.getElementById('simSliderTemp');
    const sHum = document.getElementById('simSliderHumidity');
    const sWind = document.getElementById('simSliderWind');
    const sEmission = document.getElementById('simSliderEmission');
    if (sTemp) sTemp.value = currentData.temp.toFixed(1);
    if (sHum) sHum.value = currentData.humidity.toFixed(0);
    if (sWind) sWind.value = 12.0;
    if (sEmission) sEmission.value = 3;
    runSimulation();
}

function runSimulation() {
    const tempVal = parseFloat(document.getElementById('simSliderTemp')?.value || 25);
    const humVal = parseFloat(document.getElementById('simSliderHumidity')?.value || 50);
    const windVal = parseFloat(document.getElementById('simSliderWind')?.value || 10);
    const emissionVal = parseInt(document.getElementById('simSliderEmission')?.value || 3);

    document.getElementById('simValTemp').textContent = tempVal.toFixed(1);
    document.getElementById('simValHumidity').textContent = humVal;
    document.getElementById('simValWind').textContent = windVal.toFixed(1);
    const emissionNames = ['Extremely Low', 'Low', 'Normal', 'High (Rush Hour)', 'Severe (Industrial/Peak)'];
    document.getElementById('simValEmission').textContent = emissionNames[emissionVal - 1];

    const emissionFactors = [12, 28, 48, 85, 135];
    const basePollutants = emissionFactors[emissionVal - 1];
    let thermalInversionFactor = (tempVal < 18 && windVal < 8) ? 1.0 + ((18 - tempVal) * (8 - windVal) * 0.04) : 1.0;
    let ozoneFactor = tempVal > 28 ? (tempVal - 28) * 4.5 * (1.0 + humVal / 200) : 0;
    const dispersionCoeff = Math.exp(-0.04 * windVal);
    let humiditySwelling = humVal > 70 ? 1.0 + ((humVal - 70) * 0.008) : 1.0;

    let simulatedAQI = Math.max(5, Math.min(500, Math.round((basePollutants * thermalInversionFactor * dispersionCoeff * humiditySwelling) + ozoneFactor + 12)));
    let simulatedPM25 = Math.max(1.0, parseFloat((simulatedAQI * (simulatedAQI > 150 ? 0.35 : 0.28) + humVal * 0.05).toFixed(1)));

    document.getElementById('simAQIValue').textContent = simulatedAQI;
    document.getElementById('simPM25Value').textContent = simulatedPM25;

    const cat = getAQICategory(simulatedAQI);
    const gaugeFill = document.getElementById('simGaugeFill');
    if (gaugeFill) {
        gaugeFill.style.strokeDashoffset = 440 - (Math.min(500, simulatedAQI) / 500) * 440;
        gaugeFill.style.stroke = cat.color;
        gaugeFill.style.filter = `drop-shadow(0 0 6px ${cat.color})`;
    }
    const badge = document.getElementById('simStatusBadge');
    if (badge) {
        badge.textContent = cat.level;
        badge.style.borderColor = cat.color;
        badge.style.color = cat.color;
        badge.style.background = cat.color + '20';
    }

    const recList = document.getElementById('simRecList');
    if (recList) {
        recList.innerHTML = '';
        const recs = simulatedAQI <= 50
            ? ['Air quality is ideal for all outdoor activities.', 'Open windows for ventilation.', 'No health precautions needed.']
            : simulatedAQI <= 100
            ? ['Moderate air — sensitive groups monitor symptoms.', 'Regular outdoor activity OK for healthy adults.']
            : simulatedAQI <= 150
            ? ['Sensitive groups limit prolonged outdoor exposure.', 'Keep windows closed. Consider air purifiers.']
            : simulatedAQI <= 200
            ? ['Avoid outdoor sports. Wear N95 if outdoors.', 'Active air purification advised.']
            : ['Severe alert — stay indoors. Seal rooms. HEPA purifiers required.'];
        recs.forEach(rec => { const li = document.createElement('li'); li.textContent = rec; recList.appendChild(li); });
    }
}
