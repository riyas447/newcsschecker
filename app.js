const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serving Static HTML Page
app.use(express.static(path.join(__dirname, 'public')));

// 🔴 YOUR SPAMHAUS CREDENTIALS
const SPAMHAUS_CREDENTIALS = {
  username: "rnlhyavy@92190379",
  password: "qmyaPA1n>=eF8p6C", // 👈 உங்கள் உண்மையான Spamhaus Password-ஐ போடவும்
  realm: "intel"
};

let authToken = null;
let tokenExpiry = null;

// Function to Authenticate & Fetch Bearer Token Automatically
async function getSpamhausToken() {
  const now = new Date();
  if (authToken && tokenExpiry && now < tokenExpiry) {
    return authToken;
  }

  try {
    const response = await axios.post('https://api.spamhaus.org/api/v1/login', {
      username: SPAMHAUS_CREDENTIALS.username,
      password: SPAMHAUS_CREDENTIALS.password,
      realm: SPAMHAUS_CREDENTIALS.realm
    });

    authToken = response.data.token || response.data.access_token;
    // Set token expiration to 50 minutes
    tokenExpiry = new Date(now.getTime() + 50 * 60 * 1000);
    console.log("✅ Spamhaus Bearer Token Generated Successfully!");
    return authToken;
  } catch (error) {
    console.error("❌ Authentication Error:", error.response?.data || error.message);
    throw new Error("Spamhaus Login Failed");
  }
}

// Bulk IP / CIDR Checker API Route
app.post('/api/check-intel', async (req, res) => {
  const { ips } = req.body;
  if (!ips || !Array.isArray(ips)) {
    return res.status(400).json({ error: "IPs array required" });
  }

  try {
    const token = await getSpamhausToken();

    const results = await Promise.all(ips.map(async (item) => {
      const cleanItem = item.trim();
      if (!cleanItem) return null;

      try {
        const isCidr = cleanItem.includes('/');
        const objType = isCidr ? 'cidr' : 'ip';

        // Querying Official Spamhaus Intel REST API
        const apiRes = await axios.get(
          `https://api.spamhaus.org/api/intel/v1/byobject/${objType}/XBL/listed/history/${cleanItem}?limit=5`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        const isListed = apiRes.data && apiRes.data.length > 0;
        return {
          ip: cleanItem,
          isListed: isListed,
          status: isListed ? 'Listed' : 'Not listed',
          raw: apiRes.data
        };

      } catch (err) {
        // 404 from Spamhaus REST API means Clean / Not Listed
        if (err.response && err.response.status === 404) {
          return {
            ip: cleanItem,
            isListed: false,
            status: 'Not listed',
            raw: []
          };
        }
        return {
          ip: cleanItem,
          isListed: false,
          status: 'Not listed',
          raw: []
        };
      }
    }));

    res.json({ results: results.filter(r => r !== null) });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});