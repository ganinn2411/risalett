const CATS = [
  { key:'otel',         label:'Otel' },
  { key:'ulasim',       label:'Ulaşım' },
  { key:'rehberlik',    label:'Rehberlik' },
  { key:'yemek',        label:'Yemek' },
  { key:'organizasyon', label:'Organizasyon & Vize' }
];

let reviews = [];
let currentFilter = 0;
let firebaseReady = false;

/* ──── STAT COUNTERS (sayfa açılışında sayarak artan rakamlar) ──── */
function formatStatValue(val, format) {
  if (format === 'k' && val >= 1000) {
    const k = val / 1000;
    return (Math.abs(k % 1) < 0.05 ? Math.round(k) : k.toFixed(1)) + 'K';
  }
  return Math.round(val).toLocaleString('tr-TR');
}

function animateStatCounters() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = Number(el.dataset.target || 0);
    const suffix = el.dataset.suffix || '';
    const format = el.dataset.format || '';
    const duration = 1500;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatStatValue(target * eased, format) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = formatStatValue(target, format) + suffix;
    }
    requestAnimationFrame(tick);
  });
}

/* ──── SAYI YUMUŞAK GEÇİŞ (genel puan mührü için) ──── */
function tweenNumber(el, to, decimals = 1, duration = 900) {
  const from = parseFloat((el.textContent || '0').replace(',', '.')) || 0;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (from + (to - from) * eased).toFixed(decimals);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = to.toFixed(decimals);
  }
  requestAnimationFrame(step);
}

/* ──── FIREBASE CHECK ──── */
function checkFirebaseConfig() {
  const { db } = window._firestore || {};
  if (!db) return false;
  try {
    const app = db.app;
    const cfg = app.options;
    if (cfg.apiKey === 'YOUR_API_KEY') {
      document.getElementById('config-warn').classList.add('show');
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/* ──── LOAD FROM FIREBASE ──── */
async function loadReviews() {
  firebaseReady = checkFirebaseConfig();

  if (!firebaseReady) {
    reviews = [];
    renderWall();
    return;
  }

  try {
    const { db, collection, getDocs, query, orderBy } = window._firestore;
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    reviews = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Firebase yükleme hatası:', e);
    reviews = [];
  }
  renderWall();
}

/* ──── SAVE TO FIREBASE ──── */
async function saveReview(reviewData) {
  if (!firebaseReady) throw new Error('Firebase yapılandırılmadı');
  const { db, collection, addDoc, serverTimestamp } = window._firestore;
  const docRef = await addDoc(collection(db, 'reviews'), {
    ...reviewData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/* ──── ROUTING ──── */
function showView(name) {
  const outgoing = document.querySelector('.view.active');
  const incoming = document.getElementById(name === 'wall' ? 'view-wall' : 'view-form');

  document.getElementById('nav-wall').classList.toggle('active', name === 'wall');
  document.getElementById('nav-form').classList.toggle('active', name === 'form');

  if (!outgoing || outgoing === incoming) {
    incoming.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (name === 'wall') renderWall();
    return;
  }

  // Fade-slide out
  outgoing.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  outgoing.style.opacity = '0';
  outgoing.style.transform = 'translateY(10px)';

  setTimeout(() => {
    outgoing.classList.remove('active');
    outgoing.style.transition = '';
    outgoing.style.opacity = '';
    outgoing.style.transform = '';

    if (name === 'wall') renderWall();

    incoming.style.opacity = '0';
    incoming.style.transform = 'translateY(-10px)';
    incoming.classList.add('active');

    // Force reflow
    incoming.getBoundingClientRect();

    incoming.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
    incoming.style.opacity = '1';
    incoming.style.transform = 'translateY(0)';
    window.scrollTo({ top: 0, behavior: 'instant' });

    setTimeout(() => {
      incoming.style.transition = '';
      incoming.style.opacity = '';
      incoming.style.transform = '';
    }, 300);
  }, 220);
}

document.getElementById('nav-wall').addEventListener('click', () => showView('wall'));
document.getElementById('nav-form').addEventListener('click', () => showView('form'));
document.getElementById('go-to-wall').addEventListener('click', () => {
  document.getElementById('review-form').style.display = 'block';
  document.getElementById('success-card').style.display = 'none';
  showView('wall');
});

/* ──── WALL RENDER ──── */
function avg(arr) {
  const v = arr.filter(x => typeof x === 'number' && x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function starsText(score) {
  const n = Math.round(score);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function renderWall() {
  const overallVals = reviews.map(r => r.ratings?.genel).filter(Boolean);
  const oa = avg(overallVals);

  if (reviews.length) {
    tweenNumber(document.getElementById('overall-score'), oa, 1);
  } else {
    document.getElementById('overall-score').textContent = '—';
  }
  document.getElementById('overall-stars').textContent = reviews.length ? starsText(oa) : '☆☆☆☆☆';
  document.getElementById('overall-count').textContent = reviews.length + ' YORUM';

  const gaugesEl = document.getElementById('gauges');
  gaugesEl.innerHTML = CATS.map(c => {
    const a = avg(reviews.map(r => r.ratings?.[c.key]).filter(Boolean));
    const pct = a ? (a / 5 * 100).toFixed(0) : 0;
    return `<div class="gauge">
      <div class="gauge-top">
        <span class="lbl">${c.label}</span>
        <span class="val">${a ? a.toFixed(1) : '—'}</span>
      </div>
      <div class="gauge-bar"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join('');
  attachTilt(gaugesEl.querySelectorAll('.gauge'), 6);

  const filtered = reviews.filter(r => (r.ratings?.genel || 0) >= currentFilter);
  const area = document.getElementById('review-area');

  if (!filtered.length) {
    area.innerHTML = `<div class="empty-state">
      <div class="ghost"></div>
      <p>${reviews.length ? 'Bu filtreye uyan yorum yok.' : 'Henüz değerlendirme yok. İlk yorumu siz bırakın!'}</p>
      <button class="btn green" onclick="showView('form')">Değerlendirme Yap</button>
    </div>`;
    return;
  }

  area.innerHTML = `<div class="review-grid">` + filtered.map(r => {
    const genel = r.ratings?.genel || 0;
    const dateStr = r.createdAt?.toDate
      ? r.createdAt.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : (r.date ? new Date(r.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

    return `<div class="review-card">
      <div class="glare"></div>
      <div class="mini-seal">${genel}.0</div>
      <div class="who">${esc(r.name || 'Anonim Misafir')}</div>
      <div class="when">${esc(r.trip || '')}${dateStr ? (r.trip ? ' · ' : '') + dateStr : ''}</div>
      <div class="text">${esc(r.text)}</div>
      <div class="subratings">
        ${CATS.filter(c => (r.ratings?.[c.key] || 0) > 0)
          .map(c => `<span>${c.label} <b>${r.ratings[c.key]}/5</b></span>`).join('')}
      </div>
    </div>`;
  }).join('') + `</div>`;

  attachTilt(area.querySelectorAll('.review-card'), 9);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/* ──── 3D TILT EFFECT ──── */
function attachTilt(elements, maxDeg = 8) {
  elements.forEach(el => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -maxDeg * 2;
      const ry = (px - 0.5) * maxDeg * 2;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(2px)`;
      el.style.setProperty('--mx', (px * 100) + '%');
      el.style.setProperty('--my', (py * 100) + '%');
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

/* ──── HERO PARALLAX ──── */
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const scene = document.getElementById('hero-scene');
  if (!hero || !scene) return;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    scene.style.transform = `translate(-50%, -50%) rotateX(${(-py * 16).toFixed(2)}deg) rotateY(${(px * 16).toFixed(2)}deg)`;
  });
  hero.addEventListener('pointerleave', () => {
    scene.style.transform = 'translate(-50%, -50%)';
  });
}

/* ──── FILTERS ──── */
document.querySelectorAll('#filters button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = Number(btn.dataset.min);
    renderWall();
  });
});

/* ──── FORM SUBMIT ──── */
document.getElementById('review-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const getVal = (name) => {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? Number(el.value) : 0;
  };

  const genel = getVal('genel');
  const text = document.getElementById('f-text').value.trim();
  const trip = document.getElementById('f-trip').value.trim();

  let valid = true;
  document.getElementById('field-genel').classList.toggle('has-error', genel === 0);
  if (genel === 0) valid = false;
  document.getElementById('field-text').classList.remove('has-error');
  document.getElementById('field-trip').classList.toggle('has-error', trip.length === 0);
  if (trip.length === 0) valid = false;
  if (!valid) return;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor…';

  const newReview = {
    name: document.getElementById('f-name').value.trim(),
    trip: document.getElementById('f-trip').value.trim(),
    ratings: {
      genel,
      otel: getVal('otel'),
      ulasim: getVal('ulasim'),
      rehberlik: getVal('rehberlik'),
      yemek: getVal('yemek'),
      organizasyon: getVal('organizasyon')
    },
    text,
    date: new Date().toISOString()
  };

  try {
    const docId = await saveReview(newReview);
    newReview.id = docId;
    reviews.unshift(newReview);
  } catch (err) {
    console.error('Kayıt hatası:', err);
    newReview.id = Date.now() + '';
    reviews.unshift(newReview);
  }

  btn.disabled = false;
  btn.textContent = 'Değerlendirmeyi Gönder';
  document.getElementById('review-form').reset();
  document.getElementById('review-form').style.display = 'none';
  document.getElementById('success-card').style.display = 'block';
});

/* ──── INIT ──── */
window.addEventListener('load', () => {
  initHeroParallax();
  animateStatCounters();
  setTimeout(loadReviews, 400);
});