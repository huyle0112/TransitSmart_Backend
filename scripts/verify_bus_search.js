const axios = require('axios');

async function run() {
  try {
    // Try searching for "Tuyến 39" (from logs)
    console.log('Testing /api/bus-lines/details?name=Tuyến 39');
    try {
      const res39 = await axios.get('http://localhost:4000/api/bus-lines/details?name=Tuyến 39');
      console.log('Status 39:', res39.status);
    } catch (e) { console.log('39 result:', e.response?.status || e.message); }

    // Try "01" (common test)
    console.log('Testing /api/bus-lines/details?name=01');
    const res = await axios.get('http://localhost:4000/api/bus-lines/details?name=01');
    console.log('Status:', res.status);
    console.log('Data found:', !!res.data);
    if (res.data) console.log('Route name:', res.data.name);

  } catch (error) {
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

run();
