const axios = require('axios');
const cheerio = require('cheerio');

async function trackIndiaPost(trackingNumber) {

  // Method 1: Try India Post internal JSON API
  try {
    const resp = await axios.post(
      'https://www.indiapost.gov.in/VAS/DOP_PDFViewer/GetArticleDetails',
      { articleNumber: trackingNumber },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': 'https://www.indiapost.gov.in/',
          'Origin': 'https://www.indiapost.gov.in',
        },
        timeout: 15000,
      }
    );

    const data = resp.data;
    if (data && Array.isArray(data) && data.length > 0) {
      const events = data.map(e => ({
        date: (e.EventDate || '') + ' ' + (e.EventTime || ''),
        event: e.Event || e.Description || '',
        location: e.Office || e.Location || '',
      })).filter(e => e.event);

      if (events.length > 0) {
        return {
          success: true,
          courier: 'India Post',
          trackingNumber,
          status: detectStatus(events[0].event),
          events,
        };
      }
    }
    throw new Error('Empty response');
  } catch (e1) {

    // Method 2: Try alternate India Post API endpoint
    try {
      const resp = await axios.get(
        `https://www.indiapost.gov.in/VAS/DOP_PDFViewer/TrackConsignment?consignmentNo=${trackingNumber}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.indiapost.gov.in/',
          },
          timeout: 15000,
        }
      );

      const data = resp.data;
      if (data && Array.isArray(data) && data.length > 0) {
        const events = data.map(e => ({
          date: e.EventDate || e.date || '',
          event: e.Event || e.event || e.Description || '',
          location: e.Office || e.location || '',
        })).filter(e => e.event);

        if (events.length > 0) {
          return {
            success: true,
            courier: 'India Post',
            trackingNumber,
            status: detectStatus(events[0].event),
            events,
          };
        }
      }
      throw new Error('Empty');
    } catch (e2) {

      // Method 3: Scrape the tracking page directly
      try {
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

        const postData = new URLSearchParams({
          '__EVENTTARGET': '',
          '__EVENTARGUMENT': '',
          '__VIEWSTATE': viewState,
          '__VIEWSTATEGENERATOR': viewStateGen,
          '__EVENTVALIDATION': eventValidation,
          'ctl00$PlaceHolderMain$ucOERControl$txtTrackNum': trackingNumber,
          'ctl00$PlaceHolderMain$ucOERControl$btnSearch': 'Track Now',
        });

        const postResp = await axios.post(BASE_URL, postData.toString(), {
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies,
          },
          timeout: 20000,
        });

        const $r = cheerio.load(postResp.data);
        const events = [];

        $r('table tr').each((i, row) => {
          if (i === 0) return;
          const cells = $r(row).find('td');
          if (cells.length >= 2) {
            const date = $r(cells[0]).text().trim();
            const event = $r(cells[1]).text().trim();
            const location = cells[2] ? $r(cells[2]).text().trim() : '';
            if (date && event) events.push({ date, event, location });
          }
        });

        if (events.length > 0) {
          return {
            success: true,
            courier: 'India Post',
            trackingNumber,
            status: detectStatus(events[0].event),
            events,
          };
        }
        throw new Error('No data in page');
      } catch (e3) {
        return {
          success: false,
          error: 'India Post tracking is currently unavailable. Their website may be blocking requests. Please try again in a few minutes or visit indiapost.gov.in directly.',
        };
      }
    }
  }
}

function detectStatus(eventText) {
  const t = (eventText || '').toLowerCase();
  if (t.includes('deliver') && !t.includes('undeliver') && !t.includes('out for') && !t.includes('failed')) return 'Delivered';
  if (t.includes('out for delivery')) return 'Out for Delivery';
  if (t.includes('return')) return 'Returned';
  if (t.includes('fail') || t.includes('undeliver') || t.includes('rto')) return 'Delivery Failed';
  if (t.includes('transit') || t.includes('despatch') || t.includes('dispatch') || t.includes('depart')) return 'In Transit';
  if (t.includes('booked') || t.includes('accept') || t.includes('pickup')) return 'Booked';
  return 'In Transit';
}

module.exports = { trackIndiaPost };
