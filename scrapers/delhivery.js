const axios = require('axios');
const cheerio = require('cheerio');

async function trackDelhivery(trackingNumber) {
  // Delhivery has a public-facing JSON tracking endpoint used by their own website
  const url = `https://www.delhivery.com/track/package/${trackingNumber}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.delhivery.com/',
  };

  // Try the internal JSON endpoint first (used by their own tracker page)
  try {
    const jsonResp = await axios.get(
      `https://www.delhivery.com/api/v1/packages/json/?waybill=${trackingNumber}&verbose=true`,
      {
        headers: {
          ...headers,
          'Accept': 'application/json',
        },
        timeout: 15000,
      }
    );

    const data = jsonResp.data;
    if (data && data.ShipmentData && data.ShipmentData.length > 0) {
      return parseDelhiveryJSON(data.ShipmentData[0], trackingNumber);
    }
  } catch (e) {
    // fall through to HTML scrape
  }

  // Fallback: scrape the HTML page
  const resp = await axios.get(url, { headers, timeout: 15000 });
  const $ = cheerio.load(resp.data);

  const events = [];
  // Delhivery tracking events in their page
  $('.tracking-events li, .track-detail li, [class*="event"], [class*="checkpoint"]').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 5) {
      events.push({ date: '', event: text, location: '' });
    }
  });

  if (!events.length) {
    return { success: false, error: 'Could not retrieve tracking data for this number.' };
  }

  return {
    success: true,
    courier: 'Delhivery',
    trackingNumber,
    status: detectStatus(events[0].event),
    events,
  };
}

function parseDelhiveryJSON(shipment, trackingNumber) {
  const s = shipment.Shipment;
  const scans = (s.Scans || []).map(scan => ({
    date: scan.ScanDetail?.ScanDateTime || '',
    event: scan.ScanDetail?.Instructions || scan.ScanDetail?.Scan || '',
    location: scan.ScanDetail?.ScannedLocation || '',
  }));

  const status = s.Status?.Status || detectStatus(scans[0]?.event || '');

  return {
    success: true,
    courier: 'Delhivery',
    trackingNumber,
    status: normalizeStatus(status),
    estimatedDelivery: s.ExpectedDeliveryDate || null,
    events: scans,
  };
}

function normalizeStatus(s) {
  const t = (s || '').toLowerCase();
  if (t.includes('deliver') && !t.includes('undeliver') && !t.includes('out')) return 'Delivered';
  if (t.includes('out for delivery')) return 'Out for Delivery';
  if (t.includes('transit') || t.includes('dispatch')) return 'In Transit';
  if (t.includes('return')) return 'Returned';
  if (t.includes('fail') || t.includes('undeliver')) return 'Delivery Failed';
  return 'In Transit';
}

function detectStatus(eventText) {
  return normalizeStatus(eventText);
}

module.exports = { trackDelhivery };
