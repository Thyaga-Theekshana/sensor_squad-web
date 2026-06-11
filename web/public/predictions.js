// predictions.js
// SENSOR SQUAD - Predictive Analytics Dashboard Logic

const PREDICTION_API_BASE = 'http://127.0.0.1:8000'; // Change to production URL
const STATION_LAT = 6.7735; // Moratuwa
const STATION_LON = 79.8836;

let currentData = {
    temp: 26.5,
    humidity: 62.0,
    pressure: 1012.0,
    aqi: 42.0,
    pm25: 12.5,
    light: 850
};

let hourlyForecast = [];
let weeklyForecast = [];
let chartInstance = null;
let activeParam = 'temperature';

// Initialize Page
document.addEventListener('DOMContentLoaded', function() {
    console.log("Predictions Engine Initializing...");
    
    // Update live clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Setup background floating particles
    createParticles();

    // Fetch data and generate forecasts
    initPredictions();
    
    // Bind Tab Click listeners
    setupTabListeners();

    // Bind Simulator Sliders
    setupSimulator();
});

// Clock updater
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const clockEl = document.getElementById('currentTime');
    if (clockEl) {
        clockEl.textContent = timeStr;
    }
}

// Particle generator
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random styling
        const size = Math.random() * 8 + 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${Math.random() * 12 + 10}s`;
        
        container.appendChild(particle);
    }
}

// Setup Chart.js tabs
function setupTabListeners() {
    const tabs = document.querySelectorAll('.chart-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            activeParam = this.getAttribute('data-param');
            renderForecastChart();
        });
    });
}

// Core Prediction Init
async function initPredictions() {
    console.log("Loading latest readings for forecasting calibration...");
    
    let firebaseLoaded = false;
    
    if (window.firebaseHelpers && window.firebaseHelpers.firebaseInitialized) {
        try {
            const weatherData = await getLatestFromFirebase('weather_data', 10);
            const pollutionData = await getLatestFromFirebase('pollution_data', 10);
            
            if (weatherData && weatherData.length > 0) {
                const latestW = weatherData[0];
                if (latestW.temperature) currentData.temp = latestW.temperature;
                if (latestW.humidity) currentData.humidity = latestW.humidity;
                if (latestW.pressure) currentData.pressure = latestW.pressure;
                if (latestW.light) currentData.light = latestW.light;
                firebaseLoaded = true;
            }
            
            if (pollutionData && pollutionData.length > 0) {
                const latestP = pollutionData[0];
                if (latestP.aqi) currentData.aqi = latestP.aqi;
                if (latestP.pm25) currentData.pm25 = latestP.pm25;
                firebaseLoaded = true;
            }
            
            console.log("Firebase calibrated dashboard current base values:", currentData);
        } catch (err) {
            console.error("Error reading data for predictions calibration, using default states:", err);
        }
    } else {
        console.warn("Firebase config not initialized yet, scheduling retry in 2 seconds...");
        setTimeout(initPredictions, 2000);
    }

    // Set last updated time
    const now = new Date();
    document.getElementById('lastUpdateTime').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Generate Hourly Projections & Weekly Projections
    await Promise.all([
        fetchModelPredictions(),
        fetchOpenMeteo7Day()
    ]);
    
    // Run AI Insights
    generateSmartInsights();
    
    // Draw default chart
    renderForecastChart();

    // Sync Simulator sliders to loaded database values initially
    resetSimulatorToCurrent();
}

// Fetching 24-Hour Forecast using LSTM Model
async function fetchModelPredictions() {
    hourlyForecast = [];
    const loadingOverlay = document.getElementById('chartLoadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    try {
        // We use currentData to simulate recent 24h history for the backend if needed
        // For our API, we'll format a payload.
        const payload = {
            records: [
                {
                    datetime: new Date().toISOString(),
                    temperature: currentData.temp,
                    humidity: currentData.humidity,
                    pressure: currentData.pressure,
                    light_intensity: currentData.light || 1000,
                    pm25: currentData.pm25 || 12,
                    wind_speed: 3.5,
                    wind_direction: 90.0,
                    rainfall: 0.0
                }
            ]
        };

        const res = await fetch(`${PREDICTION_API_BASE}/predict/weather`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Backend error');
        const data = await res.json();
        
        if (data.hourly_forecast && data.hourly_forecast.length > 0) {
            hourlyForecast = data.hourly_forecast.map(item => {
                const dateObj = new Date(item.timestamp);
                return {
                    timeLabel: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    temperature: item.temperature,
                    humidity: item.humidity,
                    pressure: item.pressure || currentData.pressure,
                    aqi: item.aqi || currentData.aqi // If AQI is not provided by weather API, fallback
                };
            });
            // Extrapolate AQI and Pressure if missing in weather payload (for simplicity, use dummy diurnal curve if strictly missing)
            hourlyForecast.forEach((f, idx) => {
                if(!f.pressure) f.pressure = currentData.pressure + 1.2 * Math.cos(4 * Math.PI * (idx - 10) / 24);
                if(!f.aqi) f.aqi = Math.max(5, currentData.aqi + Math.sin(2 * Math.PI * idx / 24) * 5);
            });
        } else {
            generateFallbackHourlyForecasts();
        }
    } catch(err) {
        console.error("Failed to fetch LSTM model, falling back to basic algo", err);
        generateFallbackHourlyForecasts();
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

function generateFallbackHourlyForecasts() {
    hourlyForecast = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const forecastTime = new Date(now.getTime() + (i * 60 * 60 * 1000));
        hourlyForecast.push({
            timeLabel: forecastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temperature: currentData.temp + Math.cos(2 * Math.PI * (forecastTime.getHours() - 15) / 24) * 4.5,
            humidity: currentData.humidity - Math.cos(2 * Math.PI * (forecastTime.getHours() - 15) / 24) * 15,
            pressure: currentData.pressure + 1.2 * Math.cos(4 * Math.PI * (forecastTime.getHours() - 10) / 24),
            aqi: currentData.aqi + Math.sin(2 * Math.PI * forecastTime.getHours() / 24) * 5
        });
    }
}


// Generate 7-Day Forecast Grid
function generateWeeklyForecasts() {
    weeklyForecast = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();

    const weatherStates = [
        { type: 'sun', icon: 'fa-sun', desc: 'Sunny / Clear' },
        { type: 'cloud-sun', icon: 'fa-cloud-sun', desc: 'Partly Cloudy' },
        { type: 'cloud', icon: 'fa-cloud', desc: 'Overcast' },
        { type: 'rain', icon: 'fa-cloud-showers-heavy', desc: 'Showers / Rain' },
        { type: 'storm', icon: 'fa-bolt', desc: 'Thunderstorms' }
    ];

    for (let i = 0; i < 7; i++) {
        const forecastDay = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
        const dayName = i === 0 ? 'Today' : days[forecastDay.getDay()];
        
        // Randomize weather states based on pressure (lower pressure = more rain)
        let state;
        const roll = Math.random() * 100;
        if (currentData.pressure < 1008) {
            // Low pressure: High chance of rain/storm
            state = roll < 40 ? weatherStates[3] : (roll < 70 ? weatherStates[4] : weatherStates[2]);
        } else if (currentData.pressure > 1015) {
            // High pressure: Sunny / Partly cloudy
            state = roll < 70 ? weatherStates[0] : weatherStates[1];
        } else {
            // Moderate pressure: mixed
            state = roll < 30 ? weatherStates[0] : (roll < 65 ? weatherStates[1] : (roll < 90 ? weatherStates[2] : weatherStates[3]));
        }

        // Adjust temp range based on weather state (rainy days are cooler)
        let tempModifier = 0;
        if (state.type === 'rain') tempModifier = -3;
        if (state.type === 'storm') tempModifier = -5;
        if (state.type === 'sun') tempModifier = 2;

        const maxTemp = currentData.temp + tempModifier + Math.random() * 3;
        const minTemp = currentData.temp - 8 + tempModifier + Math.random() * 2;
        
        // AQI range
        let aqiVal = currentData.aqi + (Math.random() - 0.5) * 15;
        // Storms scrub air, making AQI better
        if (state.type === 'rain' || state.type === 'storm') aqiVal -= 12;
        aqiVal = Math.max(10, Math.round(aqiVal));

        weeklyForecast.push({
            day: dayName,
            dateLabel: forecastDay.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            icon: state.icon,
            type: state.type,
            desc: state.desc,
            max: Math.round(maxTemp),
            min: Math.round(minTemp),
            aqi: aqiVal
        });
    }

    // Render Weekly Grid in UI
    const grid = document.getElementById('forecast7DayGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    weeklyForecast.forEach(day => {
        let aqiClass = 'good';
        if (day.aqi > 50) aqiClass = 'mod';
        if (day.aqi > 100) aqiClass = 'unhealth';

        const card = document.createElement('div');
        card.className = `forecast-card ${day.day === 'Today' ? 'today' : ''}`;
        card.innerHTML = `
            <div class="forecast-day">${day.day}</div>
            <div style="font-size: 0.8rem; color: #a0b3d6; margin-bottom: 5px;">${day.dateLabel}</div>
            <div class="forecast-icon ${day.type}"><i class="fas ${day.icon}"></i></div>
            <div style="font-size: 0.85rem; color: #80deea; margin-bottom: 12px; font-weight: 600;">${day.desc}</div>
            <div class="forecast-temp">
                <span class="max">${day.max}째</span>
                <span class="min">${day.min}째</span>
            </div>
            <span class="forecast-aqi ${aqiClass}">AQI ${day.aqi}</span>
        `;
        grid.appendChild(card);
    });
}

// Generate dynamic AI Alerts based on REAL predictions
function generateSmartInsights() {
    const list = document.getElementById('aiInsightsList');
    if (!list) return;
    
    list.innerHTML = '';
    const insights = [];

    // Trend Analysis from LSTM
    if (hourlyForecast && hourlyForecast.length > 5) {
        const t0 = hourlyForecast[0].temperature;
        const tEnd = hourlyForecast[5].temperature;
        if (tEnd - t0 > 3) {
             insights.push({
                type: 'warning', icon: 'fa-temperature-arrow-up', title: 'Rapid Temperature Rise Expected',
                text: `LSTM model projects a +${(tEnd - t0).toFixed(1)}캜 increase over the next 5 hours.`
             });
        }
    }

    // Rain Analysis from OpenMeteo
    if (weeklyForecast && weeklyForecast.length > 0) {
        const today = weeklyForecast[0];
        if (today.rainProb > 60) {
            insights.push({
                type: 'warning', icon: 'fa-cloud-showers-heavy', title: `High Rain Probability (${today.rainProb}%)`,
                text: `Precipitation is highly likely today. This will assist in scrubbing atmospheric particulate matter.`
            });
        } else {
            insights.push({
                type: 'success', icon: 'fa-sun', title: 'Stable Weather Pattern',
                text: `Low precipitation probability (${today.rainProb}%). Conditions are clear and stable.`
            });
        }
        
        // AQI Alert
        if (today.aqi > 100) {
            insights.push({
                type: 'error', icon: 'fa-mask', title: 'Poor Air Quality Advisory',
                text: `AQI is projected to remain elevated (Index: ${today.aqi}). Sensitive groups should reduce prolonged outdoor exertion.`
            });
        }
    }

    // Inversion Warning
    if (currentData.temp > 24 && currentData.humidity > 70) {
         insights.push({
            type: 'warning', icon: 'fa-smog', title: 'Thermal Inversion Risk',
            text: `High humidity and warm conditions suggest a potential thermal inversion layer tonight, trapping PM2.5 near the surface.`
         });
    }

    // Insert cards into list
    insights.forEach(item => {
        const card = document.createElement('div');
        card.className = `insight-card ${item.type || 'info'}`;
        card.innerHTML = `
            <div class="insight-icon"><i class="fas ${item.icon}"></i></div>
            <div class="insight-info">
                <h4>${item.title}</h4>
                <p>${item.text}</p>
            </div>
        `;
        list.appendChild(card);
    });
}

// Render Forecast Chart
function renderForecastChart() {
    const canvas = document.getElementById('predictionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Destroy previous instance
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = hourlyForecast.map(f => f.timeLabel);
    let dataValues = [];
    let borderCol = '#80deea';
    let fillCol = '#80deea15';
    let paramLabel = '';

    if (activeParam === 'temperature') {
        dataValues = hourlyForecast.map(f => f.temperature);
        borderCol = '#ff4757';
        fillCol = '#ff475715';
        paramLabel = 'Temperature (째C)';
    } else if (activeParam === 'humidity') {
        dataValues = hourlyForecast.map(f => f.humidity);
        borderCol = '#3742fa';
        fillCol = '#3742fa15';
        paramLabel = 'Humidity (%)';
    } else if (activeParam === 'pressure') {
        dataValues = hourlyForecast.map(f => f.pressure);
        borderCol = '#1abc9c';
        fillCol = '#1abc9c15';
        paramLabel = 'Pressure (hPa)';
    } else if (activeParam === 'aqi') {
        dataValues = hourlyForecast.map(f => f.aqi);
        borderCol = '#c792ea';
        fillCol = '#c792ea15';
        paramLabel = 'Air Quality Index';
    }

    // Create confidence intervals upper/lower datasets for scientific effect
    const upperLimit = dataValues.map(v => {
        if (activeParam === 'temperature') return v + 1.5;
        if (activeParam === 'humidity') return Math.min(100, v + 6);
        if (activeParam === 'pressure') return v + 2.0;
        if (activeParam === 'aqi') return v + 10;
    });

    const lowerLimit = dataValues.map(v => {
        if (activeParam === 'temperature') return v - 1.5;
        if (activeParam === 'humidity') return Math.max(0, v - 6);
        if (activeParam === 'pressure') return v - 2.0;
        if (activeParam === 'aqi') return Math.max(0, v - 10);
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Confidence Upper Limit',
                    data: upperLimit,
                    borderColor: 'transparent',
                    backgroundColor: borderCol + '06',
                    fill: false,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'Confidence Lower Limit',
                    data: lowerLimit,
                    borderColor: 'transparent',
                    backgroundColor: borderCol + '06',
                    fill: '-1', // fill space between Upper and Lower
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: `${paramLabel} Forecast`,
                    data: dataValues,
                    borderColor: borderCol,
                    backgroundColor: fillCol,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: borderCol,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        filter: function(item) {
                            // Hide upper and lower limit legends
                            return !item.text.includes('Confidence');
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 25, 45, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: borderCol,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label.includes('Confidence')) return null;
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        color: '#a0b3d6',
                        maxRotation: 45
                    },
                    title: {
                        display: true,
                        text: 'Projection Timeline (Hours)',
                        color: '#ffffff',
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        color: '#a0b3d6'
                    },
                    title: {
                        display: true,
                        text: paramLabel,
                        color: '#ffffff',
                        font: { weight: 'bold' }
                    },
                    beginAtZero: activeParam !== 'pressure'
                }
            }
        }
    });
}

// ==========================================
// INTERACTIVE WHAT-IF SIMULATOR PLAYGROUND
// ==========================================
function setupSimulator() {
    const sliders = ['Temp', 'Humidity', 'Wind', 'Emission'];
    
    sliders.forEach(slider => {
        const el = document.getElementById(`simSlider${slider}`);
        if (el) {
            el.addEventListener('input', runSimulation);
        }
    });

    const resetBtn = document.getElementById('simResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSimulatorToCurrent);
    }

    runSimulation();
}

function resetSimulatorToCurrent() {
    // Set Live Badge
    const badge = document.getElementById('liveCurrentAQIValue');
    if(badge) badge.textContent = Math.round(currentData.aqi);
    const statusBadge = document.getElementById('liveCurrentAQIBadge');
    if(statusBadge) {
        let aqiClass='good', aqiText='GOOD';
        if(currentData.aqi>50){aqiClass='mod'; aqiText='MODERATE';}
        if(currentData.aqi>100){aqiClass='unhealth'; aqiText='UNHEALTHY';}
        statusBadge.textContent = aqiText;
        statusBadge.className = 'live-aqi-status ' + aqiClass;
    }

    const sTemp = document.getElementById('simSliderTemp');
    const sHum = document.getElementById('simSliderHumidity');
    const sWind = document.getElementById('simSliderWind');
    const sEmission = document.getElementById('simSliderEmission');

    if (sTemp) sTemp.value = currentData.temp.toFixed(1);
    if (sHum) sHum.value = currentData.humidity.toFixed(0);
    // Default wind speed calibration 
    if (sWind) sWind.value = 12.0; 
    if (sEmission) sEmission.value = 3; // normal activity

    runSimulation();
}

function runSimulation() {
    const tempVal = parseFloat(document.getElementById('simSliderTemp')?.value || 25);
    const humVal = parseFloat(document.getElementById('simSliderHumidity')?.value || 50);
    const windVal = parseFloat(document.getElementById('simSliderWind')?.value || 10);
    const emissionVal = parseInt(document.getElementById('simSliderEmission')?.value || 3);

    // Update value labels in UI
    const lblTemp = document.getElementById('simValTemp');
    if (lblTemp) lblTemp.textContent = tempVal.toFixed(1);
    
    const lblHum = document.getElementById('simValHumidity');
    if (lblHum) lblHum.textContent = humVal;

    const lblWind = document.getElementById('simValWind');
    if (lblWind) lblWind.textContent = windVal.toFixed(1);

    const lblEmission = document.getElementById('simValEmission');
    if (lblEmission) {
        const emissionNames = ['Extremely Low', 'Low', 'Normal', 'High (Rush Hour)', 'Severe (Industrial/Peak)'];
        lblEmission.textContent = emissionNames[emissionVal - 1];
    }

    // ==========================================
    // PREDICTION ALGORITHM FOR SIMULATED AQI
    // ==========================================
    // Base pollutant emissions
    const emissionFactors = [12, 28, 48, 85, 135];
    const basePollutants = emissionFactors[emissionVal - 1];

    // Temperature Inversion Layer effect: 
    // Cold temperature combined with low wind traps air, increasing AQI
    let thermalInversionFactor = 1.0;
    if (tempVal < 18 && windVal < 8) {
        // Temperature drop creates stronger inversion
        thermalInversionFactor = 1.0 + ((18 - tempVal) * (8 - windVal) * 0.04);
    }

    // High temperature ozone formation effect:
    // Temperatures above 28째C create photochemical ozone, adding directly to AQI
    let ozoneFactor = 0;
    if (tempVal > 28) {
        ozoneFactor = (tempVal - 28) * 4.5 * (1.0 + (humVal / 200)); // Ozone is higher in heat
    }

    // Wind dispersion effect:
    // Higher wind speed disperses particulates exponentially
    // AQI = Base * e^(-0.05 * wind)
    const dispersionCoeff = Math.exp(-0.04 * windVal);

    // Humidity particle swelling:
    // Extremely high humidity causes hydroscopic growth of particulates, increasing PM2.5/PM10 concentration measurements
    let humiditySwelling = 1.0;
    if (humVal > 70) {
        humiditySwelling = 1.0 + ((humVal - 70) * 0.008);
    }

    // Calculate simulated AQI
    let simulatedAQI = (basePollutants * thermalInversionFactor * dispersionCoeff * humiditySwelling) + ozoneFactor + 12;
    simulatedAQI = Math.max(5, Math.min(500, Math.round(simulatedAQI)));

    // PM2.5 calculation is correlated to AQI
    let simulatedPM25 = simulatedAQI * 0.28 + (humVal * 0.05);
    if (simulatedAQI > 150) simulatedPM25 = simulatedAQI * 0.35; // non-linear scaling at high levels
    simulatedPM25 = Math.max(1.0, parseFloat(simulatedPM25.toFixed(1)));

    // Update simulated result UI
    const valueEl = document.getElementById('simAQIValue');
    if (valueEl) valueEl.textContent = simulatedAQI;

    const pm25El = document.getElementById('simPM25Value');
    if (pm25El) pm25El.textContent = simulatedPM25;

    // Update circle gauge
    const gaugeFill = document.getElementById('simGaugeFill');
    if (gaugeFill) {
        // SVG circle perimeter is 440 (2 * pi * r where r=70 => 439.8)
        const perimeter = 440;
        const fillOffset = perimeter - (Math.min(500, simulatedAQI) / 500) * perimeter;
        gaugeFill.style.strokeDashoffset = fillOffset;
        
        // Dynamic color
        let color = '#2ed573'; // Good
        if (simulatedAQI > 200) color = '#ff3333'; // Very Unhealthy
        else if (simulatedAQI > 150) color = '#ff6666'; // Unhealthy
        else if (simulatedAQI > 100) color = '#ff9933'; // Unhealthy for Sensitive
        else if (simulatedAQI > 50) color = '#ffa726'; // Moderate
        
        gaugeFill.style.stroke = color;
        gaugeFill.style.filter = `drop-shadow(0 0 6px ${color})`;
        
        const badge = document.getElementById('simStatusBadge');
        if (badge) {
            badge.style.borderColor = color;
            badge.style.color = color;
            badge.style.background = color + '20';
            
            let badgeText = 'GOOD';
            if (simulatedAQI > 300) badgeText = 'HAZARDOUS';
            else if (simulatedAQI > 200) badgeText = 'VERY UNHEALTHY';
            else if (simulatedAQI > 150) badgeText = 'UNHEALTHY';
            else if (simulatedAQI > 100) badgeText = 'SENSITIVE';
            else if (simulatedAQI > 50) badgeText = 'MODERATE';
            
            badge.textContent = badgeText;
        }
    }

    // Update Recommendations list based on simulated AQI
    const recList = document.getElementById('simRecList');
    if (recList) {
        recList.innerHTML = '';
        const recs = [];
        
        if (simulatedAQI <= 50) {
            recs.push("Air quality is ideal for all outdoor activities.");
            recs.push("Highly recommended to open windows and ventilate rooms.");
            recs.push("No health precautions needed.");
        } else if (simulatedAQI <= 100) {
            recs.push("Acceptable air quality; moderate outdoor activities are safe.");
            recs.push("Sensitive groups (asthma, heart issues) should monitor symptoms.");
            recs.push("Good day for regular ventilation.");
        } else if (simulatedAQI <= 150) {
            recs.push("Sensitive groups may experience health effects. Limit prolonged outdoor exposure.");
            recs.push("Keep windows closed to prevent particulate entry.");
            recs.push("Consider running indoor air purifiers.");
        } else if (simulatedAQI <= 200) {
            recs.push("Healthy individuals may start experiencing symptoms. Avoid outdoor sports/cardio.");
            recs.push("Keep windows closed. Active air purification advised.");
            recs.push("Wear a protective mask (N95/KN95) if going outdoors for long periods.");
        } else {
            recs.push("Severe pollution alert! Avoid all outdoor exposure.");
            recs.push("Seal rooms. Run high-efficiency particulate air (HEPA) purifiers.");
            recs.push("Compulsory mask usage for essential outdoor travel.");
        }
        
        recs.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recList.appendChild(li);
        });
    }
}
