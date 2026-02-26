const axios = require('axios');
const cheerio = require('cheerio');

async function trackIndiaPost(trackingNumber) {
  const BASE_URL = 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx';

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Referer': 'https://www.indiapost.gov.in/',
  };

  const getResp = await axios.get(BASE_URL, { headers, timeout: 15000 });
  const cookies = (getResp.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const $ = cheerio.load(getResp.data);

  const viewState = $('input[name="__VIEWSTATE"]').val() || '';
  const viewStateGen = $('input[name="__VIEWSTATEGENERATOR"]').val() || '';
  const eventValidation = $('input[name="__EVENTVALIDATION"]').val() || '';
  const requestDigest = $('#__REQUESTDIGEST').val() || '';

  const postData = new URLSearchParams({
    '__EVENTTARGET': '',
    '__EVENTARGUMENT': '',
    '__VIEWSTATE': viewState,
    '__VIEWSTATEGENERATOR': viewStateGen,
    '__EVENTVALIDATION': eventValidation,
    '__REQUESTDIGEST': requestDigest,
    'ctl00$PlaceHolderMain$ucOERControl$txtTrackNum': trackingNumber,
    'ctl00$PlaceHolderMain$ucOERControl$btnSearch': 'Track Now',
  });

  const postResp = await axios.post(BASE_URL, postData.toString(), {
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'X-RequestDigest': requestDigest,
    },
    timeout: 20000,
  });

  const $r = cheerio.load(postResp.data);
  const events = [];

  $r('table').each((_, table) => {
    $r(table).find('tr').each((i, row) => {
      if (i === 0) return;
      const cells = $r(row).find('td');
      if (cells.length >= 3) {
        const date = $r(cells[0]).text().trim();
        const event = $r(cells[1]).text().trim();
        const location = $r(cells[2]).text().trim();
        if (date && event) {
          events.push({ date, event, location });
        }
      }
    });
  });

  if (!events.length) {
    return { success: false, error: 'No tracking data found. Check the tracking number.' };
  }

  const latest = events[0];
  const status = detectStatus(latest.event);

  return {
    success: true,
    courier: 'India Post',
    trackingNumber,
    status,
    events,
  };
}

function detectStatus(eventText) {
  const t = (eventText || '').toLowerCase();
  if (t.includes('deliver')) return 'Delivered';
  if (t.includes('out for delivery')) return 'Out for Delivery';
  if (t.includes('transit') || t.includes('despatch') || t.includes('dispatch')) return 'In Transit';
  if (t.includes('booked') || t.includes('accept')) return 'Booked';
  if (t.includes('return')) return 'Returned';
  if (t.includes('undeliver') || t.includes('failed')) return 'Delivery Failed';
  return 'In Transit';
}

module.exports = { trackIndiaPost };
