# 🚀 India Courier Tracker — Self-Hosted, Free Forever

Real-time tracking for all major Indian couriers. No API key. No limits. Just run it on any server or free hosting.

## Couriers Supported
- 🏛️ India Post
- 🔵 Blue Dart
- 🚚 Delhivery
- 🟠 DTDC
- 🛒 Ekart Logistics
- 🐝 XpressBees
- ⚡ Shadowfax
- 📬 Ecom Express
- 📦 Amazon Logistics

---

## ⚡ Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
# http://localhost:3000
```

---

## 🌐 Deploy Free on Railway (Recommended)

Railway gives you free hosting with a public URL. No credit card needed.

1. Go to https://railway.app and sign in with GitHub
2. Click **"New Project" → "Deploy from GitHub repo"**
3. Push this folder to a GitHub repo first, then connect it
4. Railway auto-detects Node.js and deploys it
5. You get a public URL like `https://your-app.up.railway.app`

### Alternative Free Hosts
- **Render.com** — Free tier, sleeps after 15min of inactivity
- **Fly.io** — Free tier available
- **Cyclic.sh** — Free Node.js hosting
- **Your own VPS/Raspberry Pi** — runs 24/7

---

## 🔗 Embed on Your Website

Once your server is deployed, embed the tracker as an iframe on any website:

```html
<!-- Replace the URL with your actual server URL -->
<iframe 
  src="https://your-app.up.railway.app"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius: 24px; max-width: 600px;"
></iframe>
```

Or if you want it as a standalone page, just host the whole Node.js app and link to it.

---

## 📁 Project Structure

```
courier-tracker/
├── server.js              ← Express server + API routes
├── package.json
├── scrapers/
│   ├── indiapost.js       ← India Post scraper
│   ├── delhivery.js       ← Delhivery scraper
│   └── others.js          ← BlueDart, DTDC, Ekart, XpressBees, Shadowfax, Ecom, Amazon
└── public/
    └── index.html         ← The tracking widget UI
```

## 🔧 API Usage

You can also use the tracking API directly:

```
GET /api/track?courier=indiapost&number=EE123456789IN
GET /api/track?courier=delhivery&number=1234567890
GET /api/track?courier=bluedart&number=12345678901
```

**Courier codes:** `indiapost`, `bluedart`, `delhivery`, `dtdc`, `ekart`, `xpressbees`, `shadowfax`, `ecom`, `amazon`

**Response:**
```json
{
  "success": true,
  "courier": "India Post",
  "trackingNumber": "EE123456789IN",
  "status": "In Transit",
  "estimatedDelivery": null,
  "events": [
    { "date": "25 Feb 2026 14:32", "event": "Arrived at Delhi NSH", "location": "Delhi" },
    { "date": "24 Feb 2026 09:10", "event": "Booked", "location": "Mumbai" }
  ]
}
```

---

## ⚠️ Notes

- **Scraping disclaimer:** This app scrapes public tracking pages. Courier websites may change their HTML structure over time, which could break specific scrapers. If a courier stops working, open an issue.
- **India Post:** Their site has CAPTCHA protection that may intermittently block scraping. If India Post fails, it may work again after a few minutes.
- **Rate limiting:** The server limits to 30 requests/minute per IP to prevent abuse.
- This is for personal/small business use. For high-volume commercial use, consider paying for an official API.
