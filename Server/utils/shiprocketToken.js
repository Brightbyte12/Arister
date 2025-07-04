const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, 'shiprocket_token.json');
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_API_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_API_PASSWORD;

async function fetchNewToken() {
  try {
    console.log('Fetching new Shiprocket token...');
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email: SHIPROCKET_EMAIL,
      password: SHIPROCKET_PASSWORD,
    });
    const token = response.data.token;
    // Set expiry to 9.5 days to have a buffer
    const expiresAt = Date.now() + 9.5 * 24 * 60 * 60 * 1000; 
    fs.writeFileSync(TOKEN_PATH, JSON.stringify({ token, expiresAt }));
    console.log('New Shiprocket token fetched and stored.');
    return token;
  } catch (error) {
    console.error('Failed to fetch new Shiprocket token:', error.response?.data || error.message);
    throw new Error('Failed to fetch new Shiprocket token');
  }
}

function readTokenFile() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  try {
    const fileContent = fs.readFileSync(TOKEN_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading Shiprocket token file:', error);
    return null;
  }
}

async function getShiprocketToken() {
  const data = readTokenFile();
  if (data && data.token && data.expiresAt > Date.now()) {
    console.log('Using cached Shiprocket token.');
    return data.token;
  }
  return await fetchNewToken();
}

module.exports = { getShiprocketToken };