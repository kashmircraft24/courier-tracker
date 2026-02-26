const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { trackIndiaPost } = require('./scrapers/indiapost');
const { trackDelhivery } = require('./scrapers/delhivery');
const {
  trackBlueDart,
  trackDTDC,
  trackEkart,
  trackXpressBees,
  trackShadowfax,
  trackEcomExpress,
  trackAmazon,
} = require('./scrapers/others');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://www.thekashmircraft.com',
    'https://thekashmircraft.com',
    'https://courier-tracker-gvi5.onrender.com'
  ]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit: max 30 requests per minute per IP (prevents abuse)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many requests. Please wait a moment.' },
});
app.use('/api/', limiter);

// ── Courier router ────────────────────────────────────────────
const COURIER_MAP = {
  indiapost:  trackIndiaPost,
  bluedart:   trackBlueDart,
  delhivery:  trackDelhivery,
  dtdc:       trackDTDC,
  ekart:      trackEkart,
  xpressbees: trackXpressBees,
  shadowfax:  trackShadowfax,
  ecom:       trackEcomExpress,
  amazon:     trackAmazon,
};

// ── API endpoint ──────────────────────────────────────────────
// GET /api/track?courier=indiapost&number=EE123456789IN
app.get('/api/track', async (req, res) => {
  const { courier, number } = req.query;

  if (!courier || !number) {
    return res.status(400).json({ success: false, error: 'Missing courier or number parameter.' });
  }

  const cleanNumber = number.trim().toUpperCase();
  const trackerFn = COURIER_MAP[courier.toLowerCase()];

  if (!trackerFn) {
    return res.status(400).json({ success: false, error: `Unknown courier: ${courier}` });
  }

  console.log(`[${new Date().toISOString()}] Tracking ${cleanNumber} via ${courier}`);

  try {
    const result = await trackerFn(cleanNumber);
    res.json(result);
  } catch (err) {
    console.error(`Tracking error for ${courier}/${cleanNumber}:`, err.message);
    res.status(500).json({
      success: false,
      error: 'Tracking failed. The courier website may be temporarily unavailable.',
    });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', couriers: Object.keys(COURIER_MAP) }));

// ── Serve frontend for all other routes ──────────────────────
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 India Courier Tracker running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/track?courier=indiapost&number=EE123456789IN\n`);
});
