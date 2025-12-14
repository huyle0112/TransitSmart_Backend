const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';
const EMAIL = 'test_reviewer@example.com';
const PASSWORD = 'password123';

async function run() {
  try {
    // 1. Register (ignore error if exists)
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        name: 'Test Reviewer',
        email: EMAIL,
        password: PASSWORD,
      });
      console.log('Registered user');
    } catch (e) {
      if (e.response && e.response.status === 400) {
        console.log('User already exists');
      } else {
        console.error('Registration failed:', e.message);
      }
    }

    // 2. Login
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    });
    const token = loginRes.data.token;
    console.log('Logged in, token obtained');

    // 3. Post Review
    try {
      const reviewRes = await axios.post(
        `${BASE_URL}/reviews`,
        {
          targetType: 'route',
          targetId: '01',
          rating: 5,
          comment: 'Verified working!',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Posted review:', reviewRes.status);
    } catch (e) {
      console.log('Post review failed (might already exist or error):', e.response?.data || e.message);
    }

    // 4. Get Reviews
    const getRes = await axios.get(`${BASE_URL}/reviews?targetType=route&targetId=01`);
    console.log('Get reviews success. Total:', getRes.data.totalReviews);
    console.log('Reviews:', getRes.data.reviews.length);

  } catch (error) {
    console.error('Verification failed:', error.response ? error.response.data : error.message);
  }
}

run();
