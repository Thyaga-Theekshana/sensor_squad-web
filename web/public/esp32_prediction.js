const sendBtn = document.getElementById('sendBtn');
const apiUrlInput = document.getElementById('apiUrl');
const inputData = document.getElementById('inputData');
const responseBox = document.getElementById('response');

sendBtn.addEventListener('click', async () => {
  const url = apiUrlInput.value.trim();
  let payload;

  try {
    payload = JSON.parse(inputData.value);
  } catch (error) {
    responseBox.textContent = 'Invalid JSON: ' + error.message;
    return;
  }

  responseBox.textContent = 'Sending request...';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    responseBox.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    responseBox.textContent = 'Request failed: ' + error.message;
  }
});
