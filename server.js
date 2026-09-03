require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const GA4_PROPERTY = 'properties/497921278';
const GSC_SITE = 'https://centexasphalt.com/';
const WC_PROFILE = '';
const SHEET_ID = '';
const SHEET_TAB = 'dashboard_data';
const REVIEW_COOKIE = 'pp_reviewer';
const DASH_COOKIE = 'centex-asphalt-dashboard';

// ── Google auth (service account) ─────────────────────────────────────────
const serviceAccountCreds = {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

const gauth = new GoogleAuth({
  credentials: serviceAccountCreds,
  scopes: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ]
});

async function getGAToken() {
  const client = await gauth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

// ── Reviewer session helpers ───────────────────────────────────────────────
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function signSession(data) {
  return jwt.sign(data, process.env.SESSION_SECRET || 'pennpain-secret', { expiresIn: '7d' });
}

function readSession(req) {
  try {
    const token = req.cookies?.[REVIEW_COOKIE];
    if (!token) return null;
    return jwt.verify(token, process.env.SESSION_SECRET || 'pennpain-secret');
  } catch {
    return null;
  }
}

// ── GA4 proxy ──────────────────────────────────────────────────────────────
app.post('/api/ga4', async (req, res) => {
  try {
    const token = await getGAToken();
    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/${GA4_PROPERTY}:runReport`,
      req.body,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json({
      error: e.response?.data?.error?.message || e.message
    });
  }
});

// ── GSC proxy ──────────────────────────────────────────────────────────────
app.post('/api/gsc', async (req, res) => {
  try {
    const token = await getGAToken();
    const response = await axios.post(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
      req.body,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json({
      error: e.response?.data?.error?.message || e.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n✅ Centex Asphalt Dashboard running at http://localhost:${PORT}\n`);
});

module.exports = app;