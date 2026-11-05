// pollution-charts.js - Debug version with extra logging
let allPollutionData = null;
const POLLUTION_CHART_IDS = ['aqi', 'pm25', 'pm10', 'voc', 'nox','co','co2'];
const INACTIVE_CHART_IDS = [ 'so2', 'no2', 'o3'];

document.addEventListener('DOMContentLoaded', function() {
    console.log("Pollution charts page loaded with Firebase");
    updateTime();
    setInterval(updateTime, 1000);
    loadAllPollutionCharts(20);
    const timeRange = document.getElementById('globalTimeRange');
    if (timeRange) timeRange.addEventListener('change', () => loadAllPollutionCharts(parseInt(timeRange.value)));
    initializePollutionUI();
});

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) timeElement.textContent = timeStr;
}

function initializePollutionUI() { updateAQIGauge(0); updateHealthTips(0); updateComparisonBars({}); }

async function loadAllPollutionCharts(results) {
    if (!window.firebaseHelpers?.firebaseInitialized) {
        showDemoPollutionCharts(results);
        setTimeout(() => loadAllPollutionCharts(results), 3000);
        return;
    }
    try {
        const pollutionData = await getLatestFromFirebase('pollution_data', results);
        if (!pollutionData || pollutionData.length === 0) {
            showDemoPollutionCharts(results);
            return;
        }
        const dataMode = document.getElementById('pollutionDataMode');
        if (dataMode) dataMode.hidden = true;
        allPollutionData = pollutionData;

        // ✅ FIX: Reverse to chronological order (oldest → newest)
        pollutionData.reverse();

        const labels = pollutionData.map(item => {
            const d = new Date(item.timestamp);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        });

        let latestAQI = 0;
        const pollutants = {};

        const aqiValues = pollutionData.map(i => i.aqi || 0);
        if (aqiValues.some(v => v > 0)) {
            latestAQI = aqiValues[aqiValues.length-1];  // now newest is last
            pollutants.aqi = latestAQI;
            updateCurrentValueDisplay('aqi', latestAQI, '');
            updateChart('aqi', 'AQI', '', '#4da6ff', labels, aqiValues, latestAQI);
        }

        // PM2.5
        const pm25Values = pollutionData.map(i => i.pm2_5 || 0);
        if (pm25Values.some(v => v > 0)) {
            const cur = pm25Values[pm25Values.length-1];
            pollutants.pm25 = cur;
            updateCurrentValueDisplay('pm25', cur, 'µg/m³');
            updateChart('pm25', 'PM2.5', 'µg/m³', '#ff6b6b', labels, pm25Values, cur);
        }

        // PM10
        const pm10Values = pollutionData.map(i => i.pm10 || 0);
        if (pm10Values.some(v => v > 0)) {
            const cur = pm10Values[pm10Values.length-1];
            pollutants.pm10 = cur;
            updateCurrentValueDisplay('pm10', cur, 'µg/m³');
            updateChart('pm10', 'PM10', 'µg/m³', '#ffa726', labels, pm10Values, cur);
        }

        // VOC
        const vocValues = pollutionData.map(i => i.voc || 0);
        if (vocValues.some(v => v > 0)) {
            const cur = vocValues[vocValues.length-1];
            pollutants.voc = cur;
            updateCurrentValueDisplay('voc', cur, 'ppb');
            updateChart('voc', 'VOC', 'ppb', '#f39c12', labels, vocValues, cur);
        }

        // NOx
        const noxValues = pollutionData.map(i => i.nox || 0);
        if (noxValues.some(v => v > 0)) {
            const cur = noxValues[noxValues.length-1];
            pollutants.nox = cur;
            updateCurrentValueDisplay('nox', cur, 'ppb');
            updateChart('nox', 'NOx', 'ppb', '#e74c3c', labels, noxValues, cur);
        }

        // CO
        const coValues = pollutionData.map(i => i.co || 0);
        if (coValues.some(v => v > 0)) {
            const cur = coValues[coValues.length - 1];
            pollutants.co = cur;
            updateCurrentValueDisplay('co', cur, 'ppm');
            updateChart('co', 'CO', 'ppm', '#8e44ad', labels, coValues, cur);
        }

        // CO₂
        const co2Values = pollutionData.map(i => i.co2 || 0);
        if (co2Values.some(v => v > 0)) {
            const cur = co2Values[co2Values.length - 1];
            pollutants.co2 = cur;
            updateCurrentValueDisplay('co2', cur, 'ppm');
            updateChart('co2', 'CO₂', 'ppm', '#16a085', labels, co2Values, cur);
        }

        if (latestAQI > 0) {
            updateAQIGauge(latestAQI);
            updateHealthTips(latestAQI);
            updateAQIScaleHighlight(latestAQI);
        }
        if (Object.keys(pollutants).length > 0) updateComparisonBars(pollutants);
        INACTIVE_CHART_IDS.forEach(id => showInactiveChartDemo(id, results));

        console.log("✅ All charts updated with real data");
    } catch (error) {
        console.error(error);
        showDemoPollutionCharts(results);
    }
}
function getPollutionCanvasId(chartId) {
    const map = { aqi:'aqiChartCanvas', pm25:'pm25ChartCanvas', pm10:'pm10ChartCanvas', voc:'vocChartCanvas', nox:'noxChartCanvas', co:'coChartCanvas', so2:'so2ChartCanvas', no2:'no2ChartCanvas', o3:'o3ChartCanvas', co2:'co2ChartCanvas' };
    return map[chartId];
}

function updateCurrentValueDisplay(chartId, value, unit) {
    const el = document.getElementById(`${chartId}Current`);
    if (!el) return;
    if (value === null || isNaN(value)) { el.textContent = '--'; return; }
    const formatted = formatPollutionValue(value, chartId);
    el.textContent = chartId === 'aqi' ? formatted : `${formatted} ${unit}`;
    el.classList.add('updated');
    setTimeout(() => el.classList.remove('updated'), 500);
}

function formatPollutionValue(value, chartId) {
    if (value === null || isNaN(value)) return '--';
    if (chartId === 'aqi') return Math.round(value);
    return value.toFixed(1);
}

function updateChart(chartId, chartName, unit, color, labels, values, currentValue) {
    const canvasId = getPollutionCanvasId(chartId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas.chart) canvas.chart.destroy();

    console.log(`📈 Updating chart: ${chartName}, values:`, values.slice(0, 5));

    const chartRanges = {
        aqi:  { max: 500, step: 50 },
        pm25: { max: 500, step: 50 },
        pm10: { max: 500, step: 50 },
        voc:  { max: 500, step: 50 },
        nox:  { max: 100, step: 10 },
        co:   { max: 100, step: 10 },
        co2:  { max: 2000, step: 200 }
    };
    const range = chartRanges[chartId] || { max: 100, step: 10 };
    canvas.chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{
            label: chartName + (unit ? ` (${unit})` : ''),
            data: values,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 3
        }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#ffffff' } },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${unit ? ctx.parsed.y.toFixed(1)+' '+unit : Math.round(ctx.parsed.y)}` }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#a0b3d6', maxRotation: 45 }, title: { display: true, text: 'Time', color: '#ffffff' } },
                y: {
                    beginAtZero: true,
                    min: chartId === "nox" ? 400 : chartId === "co2" ? 400 : 0,
                    max: chartId === "pm25" ? 500 : chartId === "pm10" ? 500 : chartId === "voc"  ? 60000 : chartId === "nox"  ? 60000 : chartId === "co"   ? 1000 : chartId === "co2"  ? 50000 : chartId === "aqi"  ? 500 : undefined,
                    ticks: {
                        color: '#a0b3d6',
                        stepSize: chartId === "pm25" ? 50 : chartId === "pm10" ? 50 : chartId === "voc"  ? 5000 : chartId === "nox"  ? 50 : chartId === "co"   ? 100 : chartId === "co2"  ? 200 : chartId === "aqi"  ? 50 : undefined
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: chartName, color: '#ffffff' }
                }
            }
        }
    });
}

function showInactiveChartDemo(chartId, results) {
    const now = new Date();
    const labels = Array.from({length:results}, (_,i) => {
        const d = new Date(now.getTime() - (i * 5 * 60000));
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }).reverse();
    const zeroValues = Array(results).fill(0);
    const configs = { co:{ name:'CO', unit:'ppb', color:'#8e44ad' }, so2:{ name:'SO₂', unit:'ppb', color:'#e74c3c' }, no2:{ name:'NO₂', unit:'ppb', color:'#3498db' }, o3:{ name:'O₃', unit:'ppb', color:'#2ecc71' } };
    if (configs[chartId]) {
        updateCurrentValueDisplay(chartId, 0, configs[chartId].unit);
        updateChart(chartId, configs[chartId].name, configs[chartId].unit, configs[chartId].color, labels, zeroValues, 0);
    }
}

function showDemoPollutionCharts(results) {
    console.log("🔄 Showing demo pollution charts (fallback)");
    const dataMode = document.getElementById('pollutionDataMode');
    if (dataMode) dataMode.hidden = false;
    const now = new Date();
    const labels = Array.from({length:results}, (_,i) => {
        const d = new Date(now.getTime() - (i * 5 * 60000));
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }).reverse();
    const smoothSeries = (base, amplitude) => Array.from(
        { length: results },
        (_, index) => base + amplitude * Math.sin(index * 0.22)
    );
    const demos = [
        { id:'aqi', name:'AQI', unit:'', color:'#4da6ff', values:smoothSeries(50, 6) },
        { id:'pm25', name:'PM2.5', unit:'µg/m³', color:'#ff6b6b', values:smoothSeries(16.5, 4) },
        { id:'pm10', name:'PM10', unit:'µg/m³', color:'#ffa726', values:smoothSeries(35, 8) },
        { id:'voc', name:'VOC', unit:'ppb', color:'#f39c12', values:smoothSeries(220, 15) },
        { id:'nox', name:'NOx', unit:'ppb', color:'#e74c3c', values:smoothSeries(8, 1) },
        { id:'co2', name:'CO₂', unit:'ppm', color:'#16a085', values:smoothSeries(420, 8) },
        { id:'co', name:'CO', unit:'ppm', color:'#8e44ad', values:smoothSeries(0.5, 0.1) }
    ];
    const pollutants = {};
    let latestAQI = 0;
    demos.forEach(d => {
        d.current = d.values[d.values.length - 1];
        updateCurrentValueDisplay(d.id, d.current, d.unit);
        updateChart(d.id, d.name, d.unit, d.color, labels, d.values, d.current);
        pollutants[d.id] = d.current;
        if (d.id === 'aqi') latestAQI = d.current;
    });
    updateAQIGauge(latestAQI); updateHealthTips(latestAQI); updateComparisonBars(pollutants); updateAQIScaleHighlight(latestAQI);
    INACTIVE_CHART_IDS.forEach(id => showInactiveChartDemo(id, results));
}

function updateAQIGauge(aqi) {
    const fill = document.getElementById('gaugeFill');
    const val = document.getElementById('gaugeAQI');
    const status = document.getElementById('gaugeStatus');
    if (!fill) return;
    const circumference = 2 * Math.PI * 90;
    const pct = Math.min(aqi / 500, 1);
    fill.style.strokeDashoffset = circumference * (1 - pct);
    val.textContent = Math.round(aqi);
    let color, text;
    if (aqi <= 50) { color = '#00cc66'; text = 'Good'; }
    else if (aqi <= 100) { color = '#ffcc00'; text = 'Moderate'; }
    else if (aqi <= 150) { color = '#ff9933'; text = 'Unhealthy for Sensitive'; }
    else if (aqi <= 200) { color = '#ff6666'; text = 'Unhealthy'; }
    else if (aqi <= 300) { color = '#ff3333'; text = 'Very Unhealthy'; }
    else { color = '#990000'; text = 'Hazardous'; }
    fill.style.stroke = color;
    status.textContent = text;
}

function updateAQIScaleHighlight(aqi) {
    document.querySelectorAll('.scale-item').forEach(item => {
        item.classList.remove('active');
        const range = item.dataset.aqiRange;
        if (range) {
            const [min,max] = range.split('-').map(Number);
            if (aqi >= min && aqi <= max) item.classList.add('active');
        }
    });
}

function updateComparisonBars(pollutants) {
    const container = document.getElementById('comparisonBars');
    if (!container) return;
    container.innerHTML = "";
    const items = [
        { key: "aqi",  name: "AQI",   max: 500,  color: "#4da6ff" },
        { key: "pm25", name: "PM2.5", max: 100,  color: "#ff6b6b" },
        { key: "pm10", name: "PM10",  max: 150,  color: "#ffa726" },
        { key: "voc",  name: "VOC",   max: 500,  color: "#f39c12" },
        { key: "nox",  name: "NOx",   max: 100,  color: "#e74c3c" },
        { key: "co",   name: "CO",    max: 1000, color: "#8e44ad" },
        { key: "co2",  name: "CO₂",   max: 2000, color: "#16a085" }
    ];
    items.forEach(item => {
        const value = Number(pollutants[item.key]) || 0;
        const percent = Math.min((value / item.max) * 100, 100);
        container.innerHTML += `
            <div class="comp-bar">
                <span class="label">${item.name}</span>
                <div class="bar-container">
                    <div class="bar" style="width:${percent}%; background:${item.color};"></div>
                </div>
                <span class="value">${value.toFixed(1)}</span>
            </div>
        `;
    });
}

function updateHealthTips(aqi) {
    const container = document.getElementById('healthTips');
    if (!container) return;
    let tips = [];
    if (aqi <= 50) tips = [
        { icon:'fa-walking', title:'Perfect for outdoor activities', desc:'Air quality is good. Enjoy your outdoor activities!' },
        { icon:'fa-wind', title:'Ventilate your home', desc:'Great time to open windows for fresh air.' },
        { icon:'fa-leaf', title:'Ideal for plants', desc:'Your indoor plants will thrive in this air quality.' }
    ];
    else if (aqi <= 100) tips = [
        { icon:'fa-mask', title:'Sensitive groups', desc:'Consider reducing prolonged outdoor exertion if sensitive.' },
        { icon:'fa-home', title:'Keep windows closed', desc:'Limit outdoor air intake during peak hours.' },
        { icon:'fa-water', title:'Stay hydrated', desc:'Drink plenty of water to help your body.' }
    ];
    else if (aqi <= 150) tips = [
        { icon:'fa-head-side-mask', title:'Wear mask outdoors', desc:'Consider wearing N95 mask when outside.' },
        { icon:'fa-hand-holding-heart', title:'Limit exertion', desc:'Reduce prolonged or heavy exertion.' },
        { icon:'fa-lungs', title:'Take breaks', desc:'Take more breaks during outdoor activities.' }
    ];
    else tips = [
        { icon:'fa-home', title:'Stay indoors', desc:'Avoid outdoor activities if possible.' },
        { icon:'fa-head-side-mask', title:'Use air purifier', desc:'Run air purifiers to maintain indoor air quality.' },
        { icon:'fa-heartbeat', title:'Monitor symptoms', desc:'Watch for coughing or shortness of breath.' }
    ];
    let html = '';
    tips.forEach(t => { html += `<div class="tip-card"><i class="fas ${t.icon}"></i><h4>${t.title}</h4><p>${t.desc}</p></div>`; });
    container.innerHTML = html;
}