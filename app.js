const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// EDIT HERE: wedding details. Anything left as a placeholder is shown as such.
//
//  * weddingDate  - ISO string, e.g. '2027-02-14T11:00:00+05:30'. Leave null
//                   until confirmed; the scratch card then shows
//                   "Wedding Date to Be Announced". The weekday is calculated
//                   from the date, never typed by hand.
//  * Placeholders - any text starting with "[" is treated as "not confirmed yet".
//  * Images       - put files in /public/images/... . A missing file is replaced
//                   by a tasteful placeholder, so nothing breaks.
// ---------------------------------------------------------------------------
const wedding = {
  bride: { name: 'Aarti Kumari', parents: 'Ramesh Kumar and Kiran Devi' },
  groom: { name: 'Rajan Thakur', parents: 'Jai Thakur and Renu Thakur' },

  weddingDate: null,
  timeZone: 'Asia/Kolkata',
  dateText: '24th November 2026', // shown under the scratch layer when no date is set

  // Opening sequence assets. Each entry is a list of candidate files; the first
  // one that exists in /public is used. The mobile (portrait) set is optional:
  // if it is missing, the desktop file is used everywhere.
  assets: {
    // Your current file names come first; the "-desktop" names are accepted as alternatives.
    gate:  { desktop: ['/images/initialbg.png', '/images/initialbg-desktop.png'],
             mobile:  ['/images/initialbg-mobile.png'] },
    video: { desktop: ['/video/Full video.mp4', '/video/Full-video-desktop2026.mp4'],
             mobile:  ['/video/Full-video-mobile2026.mp4', '/video/Full video mobile.mp4'] },
    final: { desktop: ['/images/finalbg.png', '/images/finalbg-desktop.png'],
             mobile:  ['/images/finalbg-mobile.png'] }
  },

  // Background song (one <audio> element in index.ejs). Controls only appear if the file exists.
  music: { src: '/audio/wedding-song.mp3' },

  // Our Story - replace the [bracketed] text with your own words and dates.
  story: [
    { title: 'Families Introduced', date: '1st December 2025', text: 'Our story began when our families came together with the hope of finding a beautiful match. What started as a family introduction became the first step towards a bond that would soon bring two hearts closer.' },
    { title: 'First Meeting',       date: '1st December 2025', text: 'A little nervousness, a few smiles, and countless unspoken thoughts. Our first meeting was the beginning of getting to know each other, discovering little things, and feeling the possibility of something beautiful.' },
    { title: 'A New Beginning',     date: '26th April 2026', text: 'With the blessings of our families and happiness in our hearts, we decided to take this beautiful journey together. Two strangers became partners, ready to build a lifetime of love, trust, and togetherness.' },
    { title: 'Wedding Day',         date: '24th November 2026', text: 'The day our forever began! Surrounded by the love and blessings of our families, we promised to stand by each other through every season of life. A beautiful beginning to our happily ever after.' }
  ],

  // Gallery - drop photos into /public/images/gallery/ and edit alt/caption.
  // Entries whose file does not exist are shown as labelled placeholders.
  gallery: [
    { src: '/images/gallery/photo-1.png', alt: '[Describe photograph 1]', caption: '' },
    { src: '/images/gallery/photo-2.png', alt: '[Describe photograph 2]', caption: '' },
    { src: '/images/gallery/photo-3.png', alt: '[Describe photograph 3]', caption: '' },
    { src: '/images/gallery/photo-4.png', alt: '[Describe photograph 4]', caption: '' },
    { src: '/images/gallery/photo-5.png', alt: '[Describe photograph 5]', caption: '' },
    { src: '/images/gallery/photo-6.png', alt: '[Describe photograph 6]', caption: '' }
  ],

  // The four ceremonies, in display order. Fields left as '' are simply hidden.
  events: [
    { title: 'Matkor',   image: '/images/events/matkor.png',   date: '22/11/2026', day: 'Sunday', time: '7:00 PM', endTime: '', venue: 'Sai Vihar Colony Road NO. 1-D Jaganpura Patna', address: 'Sai Vihar Colony Road NO. 1-D Jaganpura Patna', caption: '', description: '', mapsUrl: '' },
    { title: 'Mehndi',   image: '/images/events/mehndi2026.png',   date: '23/11/2026', day: 'Monday', time: '7:00 PM', endTime: '', venue: 'Sai Vihar Colony Road NO. 1-D Jaganpura Patna', address: 'Sai Vihar Colony Road NO. 1-D Jaganpura Patna', caption: '', description: '[', mapsUrl: '' },
    { title: 'Haldi',    image: '/images/events/haldi2026.png',    date: '24/11/2026', day: 'Tuesday', time: '10:00 Am', endTime: '', venue: 'Sita Ram Utsav Hall(Krisan Vihar Colony near Open Mind School)', address: 'Sita Ram Utsav Hall(Krisan Vihar Colony near Open Mind School)', caption: '', description: '', mapsUrl: '' },
    { title: 'Marriage', image: '/images/events/marraige2026.png', date: '24/11/2026', day: 'Tuesday', time: '10:00 PM', endTime: '', venue: 'Sita Ram Utsav Hall(Krisan Vihar Colony near Open Mind School)', address: 'Sita Ram Utsav Hall(Krisan Vihar Colony near Open Mind School)', caption: '', description: '', mapsUrl: '' }
  ],

  // Venue section. dateFromEvent pulls date/time from the event with that title.
  venue: {
    name: 'Sita Ram Utsav Hall',
    address: 'Krisan Vihar Colony near Open Mind School',
    dateFromEvent: 'Marriage',
    photo: '/images/venue2026.png',  // optional
    embedUrl: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3599.069759385478!2d85.14770779678956!3d25.569345799999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f2a777377840e7%3A0xfbc1b1b3c436b27!2sShri%20Ram%20Utsav%20Hall!5e0!3m2!1sen!2sin!4v1793545486153!5m2!1sen!2sin" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe> '  // optional: the src from Google Maps > Share > Embed a map
  },
  mapUrl: 'https://maps.app.goo.gl/unvvwM8LXjM4Ht6F8',            // optional: Google Maps directions link for the venue
  contact: 'Ramesh Kumar 9631785504',
  rsvpEnabled: true
};

// ---------------------------------------------------------------------------
// Helpers (no need to edit)
// ---------------------------------------------------------------------------
const isPlaceholder = (s) => !s || /^\s*\[/.test(String(s));

function fileExists(url) {
  if (!url) return false;
  try {
    const rel = decodeURIComponent(String(url).split('?')[0]).replace(/^\/+/, '');
    const full = path.resolve(PUBLIC_DIR, rel);
    if (!full.startsWith(PUBLIC_DIR + path.sep)) return false; // stay inside /public
    return fs.statSync(full).isFile();
  } catch (e) {
    return false;
  }
}

// First existing candidate, URL-encoded (file names may contain spaces).
function firstExisting(list) {
  const found = [].concat(list || []).find(fileExists);
  return found ? encodeURI(found) : null;
}

function resolvePair(pair) {
  const desktop = firstExisting(pair.desktop) || encodeURI([].concat(pair.desktop)[0]); // keep a URL even if missing
  const mobile = firstExisting(pair.mobile);
  return { desktop, mobile: mobile && mobile !== desktop ? mobile : null };
}

function describeDate(iso, timeZone) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'long', timeZone }),
    long: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone })
  };
}

function directionsLink(address) {
  return isPlaceholder(address)
    ? ''
    : 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address);
}

function buildView() {
  const a = wedding.assets;
  const events = wedding.events.map((ev) => {
    const imageUrl = fileExists(ev.image) ? encodeURI(ev.image) : null;
    const alt = isPlaceholder(ev.caption) ? `${ev.title} ceremony photograph` : `${ev.title}: ${ev.caption}`;
    return Object.assign({}, ev, { imageUrl, imageAlt: alt });
  });

  const gallery = wedding.gallery.map((g, i) => {
    const available = fileExists(g.src);
    return {
      src: encodeURI(g.src),
      available,
      alt: isPlaceholder(g.alt) ? `Wedding gallery photograph ${i + 1}` : g.alt,
      caption: g.caption || '',
      number: i + 1,
      expected: g.src
    };
  });

  const venueEvent = events.find((e) => e.title === wedding.venue.dateFromEvent) || null;
  const embed = wedding.venue.embedUrl;
  const embedOk = /^https:\/\/www\.google\.com\/maps\/embed/.test(embed || '');

  return Object.assign({}, wedding, {
    assets: { gate: resolvePair(a.gate), video: resolvePair(a.video), final: resolvePair(a.final) },
    music: { src: wedding.music.src, available: fileExists(wedding.music.src) },
    dateInfo: describeDate(wedding.weddingDate, wedding.timeZone),
    events,
    gallery,
    venue: Object.assign({}, wedding.venue, {
      photoUrl: fileExists(wedding.venue.photo) ? encodeURI(wedding.venue.photo) : null,
      embedUrl: embedOk ? embed : '',
      event: venueEvent,
      directionsUrl: wedding.mapUrl || directionsLink(wedding.venue.address)
    }),
    isPlaceholder
  });
}

app.use(express.static(PUBLIC_DIR, { maxAge: '7d' }));
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.render('index', { wedding: buildView() });
});

// Simple RSVP endpoint: logs to the server console and shows a thank-you.
// Replace with a database or email service when you are ready.
app.post('/rsvp', (req, res) => {
  const { name, guests, attending, message } = req.body;
  console.log('RSVP:', { name, guests, attending, message, at: new Date().toISOString() });
  res.redirect('/?rsvp=thanks#rsvp');
});

app.listen(PORT, () => {
  console.log(`Wedding invitation running at http://localhost:${PORT}`);
  if (!fileExists(wedding.music.src)) console.log(`Note: ${wedding.music.src} not found - the music controls stay hidden until you add it.`);
});
