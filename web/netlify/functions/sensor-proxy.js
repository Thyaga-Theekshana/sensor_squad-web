// netlify/functions/sensor-proxy.js
const https = require('https');

exports.handler = async (event) => {
  // ✅ ESP32 sends POST, so accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const sensorData = JSON.parse(event.body);
    console.log('Received:', sensorData);

    sensorData.server_timestamp = Date.now();

    const firebaseHost = 'weather-prediction-6c2c8-default-rtdb.asia-southeast1.firebasedatabase.app';
    const firebaseSecret = process.env.FIREBASE_SECRET;
    
    if (!firebaseSecret) {
      console.error('Missing FIREBASE_SECRET env var');
      return { statusCode: 500, body: 'Server config error' };
    }

    const path = `/ground_test_data/${Date.now()}.json`;
    const firebaseUrl = `https://${firebaseHost}${path}?auth=${firebaseSecret}`;

    await forwardToFirebase(firebaseUrl, sensorData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, path: path })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err.message };
  }
};

function forwardToFirebase(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'PUT',   // ✅ Use PUT for writing to a specific key
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => resolve(resp));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}