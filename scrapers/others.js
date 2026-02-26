const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'en-IN,en;q=0.9',
};

// ─── BLUE DART ───────────────────────────────────────────────
async function trackBlueDart(trackingNumber) {
  try {
    const resp = await axios.get(
      `https://www.bluedart.com/tracking?trackFor=0&No=${trackingNumber}`,
      { headers: HEADERS, timeout: 15000 }
    );
    const $ = cheerio.load(resp.data);
    const events = [];

    $('table tr').each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find('td');
      if (cells.length >= 3) {
        const date = $(cells[0]).text().trim();
        const event = $(cells[1]).text().trim();
        const location = $(cells[2]).text().trim();
        if (date && event) events.push({ date, event, location });
      }
    });

    if (!events.length) return { success: false, error: 'No data found for this AWB.' };

    return {
      success: true,
      courier: 'Blue Dart',
      trackingNumber,
      status: detectStatus(events[0].event),
      events,
    };
  } catch (e) {
    return { success: false, error: 'Blue Dart tracking failed. Try again.' };
  }
}

// ─── DTDC ────────────────────────────────────────────────────
async function trackDTDC(trackingNumber) {
  try {
    const resp = await axios.get(
      `https://www.dtdc.in/trace-result.asp?TrkNo=${trackingNumber}`,
      { headers: HEADERS, timeout: 15000 }
    );
    const $ = cheerio.load(resp.data);
    const events = [];

    $('table tr').each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const date = $(cells[0]).text().trim();
        const event = $(cells[1]).text().trim();
        const location = cells[2] ? $(cells[2]).text().trim() : '';
        if (date && event) events.push({ date, event, location });
      }
    });

    if (!events.length) return { success: false, error: 'No data found for this DTDC number.' };

    return {
      success: true,
      courier: 'DTDC',
      trackingNumber,
      status: detectStatus(events[0].event),
      events,
    };
  } catch (e) {
    return { success: false, error: 'DTDC tracking failed. Try again.' };
  }
}

// ─── EKART ───────────────────────────────────────────────────
async function trackEkart(trackingNumber) {
  try {
    // Ekart has a JSON API endpoint
    const resp = await axios.get(
      `https://ekartlogistics.com/api/trackdetail?trackingId=${trackingNumber}`,
      {
        headers: { ...HEADERS, 'Accept': 'application/json' },
        timeout: 15000,
      }
    );
    const data = resp.data;

    if (data && data.trackDetails) {
      const events = (data.trackDetails || []).map(e => ({
        date: e.statusDateTime || '',
        event: e.status || '',
        location: e.location || '',
      }));
      return {
        success: true,
        courier: 'Ekart Logistics',
        trackingNumber,
        status: detectStatus(events[0]?.event || ''),
        events,
      };
    }
    return { success: false, error: 'No tracking data from Ekart.' };
  } catch (e) {
    // Fallback HTML scrape
    try {
      const resp = await axios.get(
        `https://ekartlogistics.com/shipmenttrack/${trackingNumber}`,
        { headers: HEADERS, timeout: 15000 }
      );
      const $ = cheerio.load(resp.data);
      const events = [];
      $('.tracking-detail li, .timeline li, [class*="track"] li').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text) events.push({ date: '', event: text, location: '' });
      });
      if (!events.length) return { success: false, error: 'No Ekart data found.' };
      return { success: true, courier: 'Ekart Logistics', trackingNumber, status: detectStatus(events[0].event), events };
    } catch (_) {
      return { success: false, error: 'Ekart tracking failed.' };
    }
  }
}

// ─── XPRESSBEES ──────────────────────────────────────────────
async function trackXpressBees(trackingNumber) {
  try {
    const resp = await axios.get(
      `https://www.xpressbees.com/track?awb=${trackingNumber}`,
      { headers: HEADERS, timeout: 15000 }
    );
    const $ = cheerio.load(resp.data);
    const events = [];

    $('[class*="track"] li, [class*="step"], [class*="event"]').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length > 4) events.push({ date: '', event: text, location: '' });
    });

    if (!events.length) return { success: false, error: 'No XpressBees data found.' };

    return {
      success: true,
      courier: 'XpressBees',
      trackingNumber,
      status: detectStatus(events[0].event),
      events,
    };
  } catch (e) {
    return { success: false, error: 'XpressBees tracking failed.' };
  }
}

// ─── SHADOWFAX ───────────────────────────────────────────────
async function trackShadowfax(trackingNumber) {
  try {
    const resp = await axios.get(
      `https://tracker.shadowfax.in/api/track/?order_id=${trackingNumber}`,
      {
        headers: { ...HEADERS, 'Accept': 'application/json' },
        timeout: 15000,
      }
    );
    const data = resp.data;

    if (data && (data.status || data.events || data.data)) {
      const raw = data.data || data;
      const events = (raw.events || raw.tracking_events || []).map(e => ({
        date: e.timestamp || e.time || '',
        event: e.status || e.description || '',
        location: e.location || '',
      }));
      return {
        success: true,
        courier: 'Shadowfax',
        trackingNumber,
        status: detectStatus(events[0]?.event || raw.current_status || ''),
        events: events.length ? events : [{ date: '', event: raw.current_status || 'Status unknown', location: '' }],
      };
    }
    return { success: false, error: 'No Shadowfax data found.' };
  } catch (e) {
    return { success: false, error: 'Shadowfax tracking failed.' };
  }
}

// ─── ECOM EXPRESS ────────────────────────────────────────────
async function trackEcomExpress(trackingNumber) {
  try {
    const resp = await axios.get(
      `https://ecomexpress.in/tracking/?awb_field=${trackingNumber}`,
      { headers: HEADERS, timeout: 15000 }
    );
    const $ = cheerio.load(resp.data);
    const events = [];

    $('table tr').each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        events.push({
          date: $(cells[0]).text().trim(),
          event: $(cells[1]).text().trim(),
          location: cells[2] ? $(cells[2]).text().trim() : '',
        });
      }
    });

    if (!events.length) return { success: false, error: 'No Ecom Express data found.' };

    return {
      success: true,
      courier: 'Ecom Express',
      trackingNumber,
      status: detectStatus(events[0].event),
      events,
    };
  } catch (e) {
    return { success: false, error: 'Ecom Express tracking failed.' };
  }
}

// ─── AMAZON LOGISTICS ────────────────────────────────────────
async function trackAmazon(trackingNumber) {
  try {
    const resp = await axios.get(
      `https://track.amazon.in/tracking/${trackingNumber}`,
      { headers: HEADERS, timeout: 15000 }
    );
    const $ = cheerio.load(resp.data);

    // Amazon embeds tracking data in a __NEXT_DATA__ script tag
    let events = [];
    const scriptContent = $('script#__NEXT_DATA__').html();
    if (scriptContent) {
      const json = JSON.parse(scriptContent);
      const props = json?.props?.pageProps;
      const packages = props?.packageDetails || props?.trackingDetails?.packages || [];
      (packages[0]?.trackingEvents || []).forEach(e => {
        events.push({
          date: e.eventTime || '',
          event: e.eventDescription || '',
          location: e.location || '',
        });
      });
    }

    if (!events.length) {
      $('[class*="track"] li, [class*="event"] li').each((_, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ');
        if (t.length > 4) events.push({ date: '', event: t, location: '' });
      });
    }

    if (!events.length) return { success: false, error: 'No Amazon tracking data found.' };

    return {
      success: true,
      courier: 'Amazon Logistics',
      trackingNumber,
      status: detectStatus(events[0].event),
      events,
    };
  } catch (e) {
    return { success: false, error: 'Amazon tracking failed.' };
  }
}

// ─── SHARED STATUS DETECTION ─────────────────────────────────
function detectStatus(eventText) {
  const t = (eventText || '').toLowerCase();
  if ((t.includes('deliver') && !t.includes('undeliver') && !t.includes('out for') && !t.includes('failed'))) return 'Delivered';
  if (t.includes('out for delivery')) return 'Out for Delivery';
  if (t.includes('return')) return 'Returned';
  if (t.includes('fail') || t.includes('undeliver') || t.includes('rto')) return 'Delivery Failed';
  if (t.includes('transit') || t.includes('dispatch') || t.includes('shipped') || t.includes('depart')) return 'In Transit';
  if (t.includes('book') || t.includes('accept') || t.includes('pickup') || t.includes('pick up')) return 'Booked';
  return 'In Transit';
}

module.exports = {
  trackBlueDart,
  trackDTDC,
  trackEkart,
  trackXpressBees,
  trackShadowfax,
  trackEcomExpress,
  trackAmazon,
};
