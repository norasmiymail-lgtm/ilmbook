// ── FIREBASE SETUP ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBFQ-gzPWT8jcbApbHUDRhGcc5QJ3p38T0",
  authDomain: "ilmbook-b6768.firebaseapp.com",
  projectId: "ilmbook-b6768",
  storageBucket: "ilmbook-b6768.firebasestorage.app",
  messagingSenderId: "647778084804",
  appId: "1:647778084804:web:6bc56822ee6e18f93f6691"
};
firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();

// ── SUPABASE SETUP ────────────────────────────────────────
const SUPABASE_URL = 'https://fvzyiuytlwhorrzhpbmy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PDwuvzCES0VCJ7jNZHd_9Q_TfcQmDpm';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const { useState, useEffect, useRef } = React;

// ── QUOTES ────────────────────────────────────────────────
const Quotes = {
  save: (bookName, text) => {
    const all = Quotes.getAll();
    all.push({
      id: Date.now(),
      bookName,
      bookTitle: bookName.replace(/\.[^/.]+$/, ''),
      text: text.trim(),
      savedAt: new Date().toLocaleDateString(),
    });
    localStorage.setItem('quotes', JSON.stringify(all));
  },
  getAll: () => {
    try { return JSON.parse(localStorage.getItem('quotes') || '[]'); } catch { return []; }
  },
  getByBook: (bookName) => Quotes.getAll().filter(q => q.bookName === bookName),
  delete: (id) => {
    localStorage.setItem('quotes', JSON.stringify(Quotes.getAll().filter(q => q.id !== id)));
  }
};

// ── TRANSLATIONS ──────────────────────────────────────────
const T = {
  en: {
    discover:"Discover", welcome:"Welcome back 👋", search:"Search books or authors...",
    bestsellers:"Bestsellers", topAudio:"Top Audiobooks", seeAll:"See all",
    myBooks:"My Books", nowReading:"Now Reading", continueBtn:"Continue",
    completed:"completed", finished:"Finished",
    cats:["All","Finished","Favorites","Quotes"],
    uploadBtn:"Upload Book",
    profile:"Profile", readingTime:"Reading time", booksRead:"Books read", rating:"Rating",
    menu:["My Cards","Order History","Favorites","Rate Us","Send Feedback"],
    cancel:"Cancel", noBooks:"No books in this section",
    emptyTitle:"No books yet.", emptySub:"Upload a PDF, EPUB or TXT file to get started.",
    home:"Home", detail:"Details",
    loading:"Loading...", errorFile:"Could not read this file.",
    prevPage:"← Prev", nextPage:"Next →", backToLibrary:"← Back",
    highlights:"Highlights", highlightsEmpty:"No highlights yet", highlightsSub:"Select text while reading to save highlights",
  },
};

// ── GUTENDEX (Project Gutenberg) ─────────────────────────
const GUTENDEX = 'https://gutendex.com/books/';

const fetchGutendex = async (params) => {
  const res = await fetch(GUTENDEX + '?' + params);
  const data = await res.json();
  return (data.results || []).map(b => ({
    id: b.id,
    title: b.title,
    author: b.authors[0]?.name || 'Unknown',
    cover: b.formats['image/jpeg'] || '',
    txtUrl: b.formats['text/plain; charset=utf-8']
      || b.formats['text/plain; charset=us-ascii']
      || b.formats['text/plain'] || '',
    downloads: b.download_count || 0,
    subjects: b.subjects?.slice(0, 2).join(', ') || '',
    hasMore: !!data.next,
  })).filter(b => b.txtUrl);
};

// ── FALLBACK HERO BOOKS ───────────────────────────────────
const MOCK = {
  featured: [
    { id:1342, title:"Pride and Prejudice",       author:"Jane Austen",         cover:"https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg", txtUrl:"https://www.gutenberg.org/files/1342/1342-0.txt",  tag:"Classic" },
    { id:174,  title:"The Picture of Dorian Gray", author:"Oscar Wilde",         cover:"https://www.gutenberg.org/cache/epub/174/pg174.cover.medium.jpg",  txtUrl:"https://www.gutenberg.org/files/174/174-0.txt",    tag:"Gothic"  },
    { id:84,   title:"Frankenstein",               author:"Mary Shelley",        cover:"https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg",    txtUrl:"https://www.gutenberg.org/files/84/84-0.txt",      tag:"Gothic"  },
    { id:98,   title:"A Tale of Two Cities",       author:"Charles Dickens",     cover:"https://www.gutenberg.org/cache/epub/98/pg98.cover.medium.jpg",    txtUrl:"https://www.gutenberg.org/files/98/98-0.txt",      tag:"Classic" },
    { id:345,  title:"Dracula",                    author:"Bram Stoker",         cover:"https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg",  txtUrl:"https://www.gutenberg.org/files/345/345-0.txt",    tag:"Horror"  },
  ]
};

const COVER_COLORS = ['#1a3a5c','#2d1b4e','#3b1f00','#0f3460','#1b3a2d','#2d0f1a','#0f1a2d','#1a0f2d','#3b0f2d','#0f2d3b'];
const coverColor = name => {
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COVER_COLORS[Math.abs(h) % COVER_COLORS.length];
};
const PARAS_PER_PAGE = 5;

// ── FILE PARSERS ──────────────────────────────────────────
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function parseEpub(buffer) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const zip = await JSZip.loadAsync(buffer);
  const containerXml = await zip.file('META-INF/container.xml').async('text');
  const opfMatch = containerXml.match(/full-path="([^"]+\.opf)"/);
  if (!opfMatch) throw new Error('No OPF');
  const opfPath = opfMatch[1];
  const base = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfText = await zip.file(opfPath).async('text');
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfText, 'application/xml');
  const manifest = {};
  opfDoc.querySelectorAll('manifest item').forEach(i => { manifest[i.getAttribute('id')] = i.getAttribute('href'); });
  const spine = [...opfDoc.querySelectorAll('spine itemref')].map(r => manifest[r.getAttribute('idref')]).filter(Boolean);
  let paras = [];
  for (const href of spine) {
    const fullPath = base + href.split('#')[0];
    const file = zip.file(fullPath) || zip.file(href.split('#')[0]);
    if (!file) continue;
    const html = await file.async('text');
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,nav').forEach(el => el.remove());
    doc.querySelectorAll('p,h1,h2,h3,blockquote').forEach(el => {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (text.length > 20) paras.push(text);
    });
  }
  return paras;
}

async function parsePdf(buffer) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let paras = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    if (lines.length > 20) paras.push(lines);
  }
  return paras;
}

function parseTxt(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let paras = normalized.split(/\n[ \t]*\n+/)
    .map(b => b.split('\n').map(l => l.trim()).filter(l => l.length > 0).join(' '))
    .filter(p => p.length > 30);
  if (paras.length < 5) {
    const sentences = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["']?\s*/g) || [];
    paras = [];
    for (let i = 0; i < sentences.length; i += 4) paras.push(sentences.slice(i, i + 4).join('').trim());
  }
  return paras;
}

function buildPages(paras) {
  const pages = [];
  for (let i = 0; i < paras.length; i += PARAS_PER_PAGE) pages.push(paras.slice(i, i + PARAS_PER_PAGE));
  return pages;
}

// ── LOCAL STORAGE ─────────────────────────────────────────
const LS = {
  // Books now use IndexedDB — no size limit
  saveBook:   async (name, paras) => await IDB.saveBook(name, paras),
  loadBook:   async (name) => await IDB.loadBook(name),
  removeBook: async (name) => {
    await IDB.removeBook(name);
    ['page_','pct_','finished_','fav_','ann_'].forEach(p => localStorage.removeItem(p + name));
  },
  // Everything else stays in localStorage (tiny data)
  savePage:   (name, page) => localStorage.setItem('page_' + name, page),
  loadPage:   name => parseInt(localStorage.getItem('page_' + name) || '0'),
  savePct:    (name, pct) => localStorage.setItem('pct_' + name, pct),
  loadPct:    name => parseInt(localStorage.getItem('pct_' + name) || '0'),
  getAllBooks: async () => await IDB.getAllBookNames(),
};

// ── INDEXED DB (replaces localStorage for books) ──────────
const IDB = {
  db: null,

  init: () => new Promise((resolve) => {
    if (IDB.db) { resolve(); return; }
    const req = indexedDB.open('ilmbooks_db', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'name' });
      }
    };
    req.onsuccess = (e) => { IDB.db = e.target.result; resolve(); };
    req.onerror = () => resolve(); // fallback gracefully
  }),

  saveBook: async (name, paras) => {
    await IDB.init();
    return new Promise((resolve) => {
      try {
        const tx = IDB.db.transaction('books', 'readwrite');
        tx.objectStore('books').put({ name, paras });
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      } catch { resolve(); }
    });
  },

  loadBook: async (name) => {
    await IDB.init();
    return new Promise((resolve) => {
      try {
        const tx = IDB.db.transaction('books', 'readonly');
        const req = tx.objectStore('books').get(name);
        req.onsuccess = () => resolve(req.result?.paras || null);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  },

  removeBook: async (name) => {
    await IDB.init();
    return new Promise((resolve) => {
      try {
        const tx = IDB.db.transaction('books', 'readwrite');
        tx.objectStore('books').delete(name);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      } catch { resolve(); }
    });
  },

  getAllBookNames: async () => {
    await IDB.init();
    return new Promise((resolve) => {
      try {
        const tx = IDB.db.transaction('books', 'readonly');
        const req = tx.objectStore('books').getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  },
};

// ── STATS ─────────────────────────────────────────────────
const Stats = {
  getReadingTime: () => parseInt(localStorage.getItem('stat_readingTime') || '0'),
  addReadingTime: (seconds) => {
    const current = Stats.getReadingTime();
    localStorage.setItem('stat_readingTime', current + seconds);
  },
  formatTime: (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  },
  getBooksRead: () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('finished_')) keys.push(k);
    }
    return keys.length;
  },
  getRating: () => parseFloat(localStorage.getItem('stat_rating') || '0'),
  setRating: (r) => localStorage.setItem('stat_rating', r),

  getStreak: () => parseInt(localStorage.getItem('stat_streak') || '0'),
  getLastRead: () => localStorage.getItem('stat_lastread') || null,

  updateStreak: () => {
    const today = new Date().toDateString();
    const lastRead = Stats.getLastRead();
    if (lastRead === today) return Stats.getStreak(); // already updated today
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const current = Stats.getStreak();
    const newStreak = lastRead === yesterday ? current + 1 : 1;
    localStorage.setItem('stat_streak', newStreak);
    localStorage.setItem('stat_lastread', today);
    return newStreak;
  },
};

// ── RECOMMENDATIONS ───────────────────────────────────────
const getRecommendations = async (bookTitle) => {
  try {
    const keywords = bookTitle.replace(/\.[^/.]+$/, '').split(' ').filter(w => w.length > 3).slice(0, 2).join(' ');
    const query = keywords || bookTitle;
    const books = await fetchGutendex('search=' + encodeURIComponent(query) + '&mime_type=text%2Fplain');
    return books.filter(b => b.title !== bookTitle).slice(0, 3);
  } catch { return []; }
};

// ── CLOUD SYNC ────────────────────────────────────────────
const Cloud = {
  uid: () => firebase.auth().currentUser?.uid || null,

  syncProgress: async (bookName, page, pct, finished, favorite) => {
    const uid = Cloud.uid();
    if (!uid) return;
    try {
      await sb.from('libraries').upsert({
        user_id: uid, book_name: bookName,
        page, pct, finished: finished || false, favorite: favorite || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,book_name' });
    } catch(e) { console.log('Sync error:', e); }
  },

  loadLibrary: async () => {
    const uid = Cloud.uid();
    if (!uid) return [];
    try {
      const { data } = await sb.from('libraries').select('*').eq('user_id', uid);
      return data || [];
    } catch(e) { return []; }
  },

  saveAnnotation: async (bookName, annotation) => {
    const uid = Cloud.uid();
    if (!uid) return;
    try {
      await sb.from('annotations').insert({
        user_id: uid, book_name: bookName,
        type: annotation.type, text: annotation.text,
        comment: annotation.comment || null, page: annotation.page || 0,
      });
    } catch(e) {}
  },

  loadAnnotations: async (bookName) => {
    const uid = Cloud.uid();
    if (!uid) return [];
    try {
      const { data } = await sb.from('annotations').select('*')
        .eq('user_id', uid).eq('book_name', bookName);
      return data || [];
    } catch(e) { return []; }
  },

  saveQuote: async (quote) => {
    const uid = Cloud.uid();
    if (!uid) return;
    try {
      await sb.from('quotes').insert({
        user_id: uid, book_name: quote.bookName,
        book_title: quote.bookTitle, text: quote.text, saved_at: quote.savedAt,
      });
    } catch(e) {}
  },

  loadQuotes: async () => {
    const uid = Cloud.uid();
    if (!uid) return [];
    try {
      const { data } = await sb.from('quotes').select('*')
        .eq('user_id', uid).order('created_at', { ascending: false });
      return data || [];
    } catch(e) { return []; }
  },

  deleteQuote: async (id) => {
    const uid = Cloud.uid();
    if (!uid) return;
    try {
      await sb.from('quotes').delete().eq('id', id).eq('user_id', uid);
    } catch(e) {}
  },

  removeBook: async (bookName) => {
    const uid = Cloud.uid();
    if (!uid) return;
    try {
      await sb.from('libraries').delete().eq('user_id', uid).eq('book_name', bookName);
      await sb.from('annotations').delete().eq('user_id', uid).eq('book_name', bookName);
    } catch(e) {}
  },

  fullSync: async () => {
    const uid = Cloud.uid();
    if (!uid) return;
    try {
      const library = await Cloud.loadLibrary();
      library.forEach(item => {
        localStorage.setItem('page_' + item.book_name, item.page);
        localStorage.setItem('pct_' + item.book_name, item.pct);
        if (item.finished) localStorage.setItem('finished_' + item.book_name, 'true');
        if (item.favorite) localStorage.setItem('fav_' + item.book_name, 'true');
      });
    } catch(e) {}
  },
};

// ── AUTH ──────────────────────────────────────────────────
const Auth = {
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('auth_user') || 'null'); } catch { return null; }
  },
  saveUser: (user) => localStorage.setItem('auth_user', JSON.stringify(user)),
  logout: async () => {
    await fbAuth.signOut();
    localStorage.removeItem('auth_user');
  },
  savePic: (dataUrl) => localStorage.setItem('auth_pic', dataUrl),
  getPic: () => localStorage.getItem('auth_pic') || null,
};

// ── ICONS ─────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const p = {
    home:          <><rect x="3" y="11" width="7" height="10" rx="1"/><rect x="14" y="7" width="7" height="14" rx="1"/><path d="M1 11l10-8 10 8"/></>,
    book:          <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    user:          <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    search:        <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    heart:         <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
    star:          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
    upload:        <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    check:         <polyline points="20 6 9 17 4 12"/>,
    quote:         <><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></>,
    card:          <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    settings:      <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/></>,
    history:       <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></>,
    chevron_right: <polyline points="9 18 15 12 9 6"/>,
    arrow_left:    <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    trash:         <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    bookmark: <><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>,
highlighter: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {p[name]}
    </svg>
  );
};

// ── SHARED COMPONENTS ─────────────────────────────────────
const Cover = ({ book, w = 96, h = 136 }) => (
  <div style={{ width:w, height:h, minWidth:w, borderRadius:8, background:book.cover || coverColor(book.title), display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:8, position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.72))" }}/>
    <span style={{ position:"relative", fontSize:10, fontWeight:600, color:"#fff", lineHeight:1.3 }}>{book.title}</span>
  </div>
);

const ProgressBar = ({ pct, h = 3 }) => (
  <div style={{ height:h, background:"#445257", borderRadius:h, overflow:"hidden" }}>
    <div style={{ width:`${pct}%`, height:"100%", background:"#8B3A52", borderRadius:h, transition:"width 0.4s" }}/>
  </div>
);

const SectionHeader = ({ title, seeAll }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
    <h3 style={{ fontSize:16, fontWeight:600 }}>{title}</h3>
    <span style={{ fontSize:12, color:"#8B3A52", cursor:"pointer" }}>{seeAll}</span>
  </div>
);

  const BG = () => (
    <>
      <div style={{ position:'fixed', inset:0, backgroundImage:'url(booklib.jpeg)', backgroundSize:'cover', backgroundPosition:'center center', zIndex:0 }}/>
      <div style={{ position:'fixed', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.4) 40%, rgba(5,10,25,0.82) 75%, rgba(5,10,25,0.97) 100%)', zIndex:1 }}/>
    </>
  );

// ── AUTH SCREEN ───────────────────────────────────────────
const AuthBG = () => (
  <>
    <div style={{ position:'fixed', inset:0, backgroundImage:'url(booklib.jpeg)', backgroundSize:'cover', backgroundPosition:'center center', zIndex:0 }}/>
    <div style={{ position:'fixed', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.4) 40%, rgba(5,10,25,0.82) 75%, rgba(5,10,25,0.97) 100%)', zIndex:1 }}/>
  </>
);

const AuthScreen = ({ onLogin }) => {
  const [mode, setMode] = useState('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('saved_accounts') || '[]'); } catch { return []; }
  });

  const inputStyle = {
    width:'100%', background:'rgba(255,255,255,0.07)',
    border:'1px solid rgba(255,255,255,0.15)', borderRadius:2,
    padding:'13px 16px', color:'#C8D8DC', fontSize:14,
    fontFamily:'Inter, sans-serif', outline:'none', marginBottom:12,
  };

  const saveToAccounts = (user) => {
    const existing = JSON.parse(localStorage.getItem('saved_accounts') || '[]');
    if (!existing.find(a => a.email === user.email)) {
      existing.push({ name: user.name, email: user.email });
      localStorage.setItem('saved_accounts', JSON.stringify(existing));
      setSavedAccounts(existing);
    }
  };

  const handleSignup = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      const result = await fbAuth.createUserWithEmailAndPassword(email, password);
      await result.user.updateProfile({ displayName: name.trim() });
      const user = { name: name.trim(), email: result.user.email, uid: result.user.uid };
      Auth.saveUser(user);
      saveToAccounts(user);
      onLogin(user);
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Account already exists. Please log in.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password is too weak.',
      };
      setError(msgs[err.code] || err.message);
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!email.includes('@')) { setError('Please enter a valid email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      const result = await fbAuth.signInWithEmailAndPassword(email, password);
      const user = {
        name: result.user.displayName || email.split('@')[0],
        email: result.user.email,
        uid: result.user.uid
      };
      Auth.saveUser(user);
      saveToAccounts(user);
      onLogin(user);
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'No account found. Please sign up.',
        'auth/wrong-password': 'Wrong password. Try again.',
        'auth/invalid-credential': 'Wrong email or password.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
      };
      setError(msgs[err.code] || err.message);
    }
    setLoading(false);
  };

  const loginWithSaved = async (acc) => {
    setLoading(true);
    // Just restore session from saved — user stays logged in via Firebase
    const currentUser = fbAuth.currentUser;
    if (currentUser && currentUser.email === acc.email) {
      Auth.saveUser({ name: acc.name, email: acc.email, uid: currentUser.uid });
      onLogin({ name: acc.name, email: acc.email, uid: currentUser.uid });
      setLoading(false);
      return;
    }
    // Switch to login form pre-filled
    setEmail(acc.email);
    setPassword('');
    setMode('login');
    setLoading(false);
  };

  const removeSavedAccount = (e, emailToRemove) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.email !== emailToRemove);
    localStorage.setItem('saved_accounts', JSON.stringify(updated));
    setSavedAccounts(updated);
  };

  // ── WELCOME ──
  if (mode === 'welcome') return (
    <div style={{ minHeight:'100vh', position:'relative', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:'0 1.5rem 3rem' }}>
      <AuthBG/>
      <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:420, textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,107,53,0.15)', border:'1px solid rgba(255,107,53,0.35)', borderRadius:2, padding:'6px 16px', marginBottom:24 }}>
          <span style={{ fontSize:16 }}>📚</span>
          <span style={{ fontSize:12, color:'#8B3A52', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>Ilm Read Books</span>
        </div>
        <h1 style={{ fontSize:34, fontWeight:700, lineHeight:1.2, marginBottom:12, color:'#C8D8DC', textShadow:'0 2px 20px rgba(0,0,0,0.8)' }}>
          Unlock Worlds,<br/>
          <span style={{ color:'#8B3A52' }}>One Page at a Time.</span>
        </h1>
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.65)', marginBottom:40, lineHeight:1.6 }}>
          Your personal reading companion.<br/>Thousands of free books await.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <button onClick={() => setMode('signup')} style={{ width:'100%', padding:16, borderRadius:2, border:'none', background:'#8B3A52', color:'#C8D8DC', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 24px rgba(255,107,53,0.5)' }}>
            Create Account
          </button>
          <button onClick={() => setMode('login')} style={{ width:'100%', padding:16, borderRadius:2, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.08)', backdropFilter:'blur(10px)', color:'#C8D8DC', fontSize:15, fontWeight:500, cursor:'pointer' }}>
            Log In
          </button>
        </div>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:24 }}>
          Free forever · No ads · Your data stays private
        </p>
      </div>
    </div>
  );

  // ── LOGIN / SIGNUP ──
  return (
    <div style={{ minHeight:'100vh', position:'relative', display:'flex', flexDirection:'column', padding:'2rem' }}>
      <AuthBG/>
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column' }}>
        <button onClick={() => { setMode('welcome'); setError(''); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#8B3A52', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6, marginBottom:32, alignSelf:'flex-start' }}>
          <Icon name="arrow_left" size={16} color="#8B3A52"/> Back
        </button>
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', maxWidth:380, width:'100%', margin:'0 auto' }}>
          <h2 style={{ fontSize:26, fontWeight:700, marginBottom:6, color:'#C8D8DC', textShadow:'0 2px 10px rgba(0,0,0,0.5)' }}>
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom: savedAccounts.length > 0 && mode === 'login' ? 16 : 28 }}>
            {mode === 'signup' ? 'Join and start reading today' : 'Log in to continue reading'}
          </p>

          {/* Saved accounts */}
          {mode === 'login' && savedAccounts.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:0.8, fontWeight:500, marginBottom:10 }}>Your accounts</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {savedAccounts.map((acc, i) => (
                  <div key={i} onClick={() => loginWithSaved(acc)}
                    style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:2, padding:'10px 14px', cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#8B3A52', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, flexShrink:0 }}>
                      {acc.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'#C8D8DC' }}>{acc.name}</p>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acc.email}</p>
                    </div>
                    <button onClick={e => removeSavedAccount(e, acc.email)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.25)', fontSize:16, padding:4 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0' }}>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>or log in manually</span>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <input type="text" placeholder="Your name" value={name}
              onChange={e => { setName(e.target.value); setError(''); }} style={inputStyle}/>
          )}
          <input type="email" placeholder="Email address" value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }} style={inputStyle}/>
          <input type="password" placeholder="Password (min 6 chars)" value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            style={{ ...inputStyle, marginBottom:20 }}
            onKeyDown={e => e.key === 'Enter' && (mode === 'signup' ? handleSignup() : handleLogin())}
          />

          {error && (
            <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
              <p style={{ color:'#6B2D3A', fontSize:13 }}>{error}</p>
            </div>
          )}

          <button onClick={mode === 'signup' ? handleSignup : handleLogin} disabled={loading}
            style={{ width:'100%', padding:15, borderRadius:2, border:'none', background:'#8B3A52', color:'#C8D8DC', fontSize:15, fontWeight:600, cursor:loading?'default':'pointer', opacity:loading?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 20px rgba(255,107,53,0.4)' }}>
            {loading ? <><span className="spin">⟳</span> Please wait...</> : mode === 'signup' ? 'Create Account' : 'Log In'}
          </button>

          <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'rgba(255,255,255,0.4)' }}>
            {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            <span onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}
              style={{ color:'#8B3A52', cursor:'pointer', fontWeight:500 }}>
              {mode === 'signup' ? 'Log In' : 'Sign Up'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

// ── READER SCREEN ─────────────────────────────────────────
const ReaderScreen = ({ book, onBack, t }) => {
  const [pages] = useState(() => buildPages(book.paras));
  const [currentPage, setCurrentPage] = useState(() => LS.loadPage(book.name));
  const [fontSize, setFontSize] = useState(17);
  const [theme, setTheme] = useState('dark');
  const [toolbar, setToolbar] = useState(null);
  const [quoteToast, setQuoteToast] = useState('');
  const [commentModal, setCommentModal] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [annotations, setAnnotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ann_' + book.name) || '[]'); } catch { return []; }
  });

  const saveAnnotations = (updated, newAnnotation) => {
    setAnnotations(updated);
    localStorage.setItem('ann_' + book.name, JSON.stringify(updated));
    if (newAnnotation) Cloud.saveAnnotation(book.name, newAnnotation);
  };

  const pct = pages.length > 1 ? Math.round((currentPage / (pages.length - 1)) * 100) : 100;

  const [showFinished, setShowFinished] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    LS.savePage(book.name, currentPage);
    LS.savePct(book.name, pct);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const finished = currentPage === pages.length - 1;
    if (finished) {
      LS.savePct(book.name, 100);
      localStorage.setItem('finished_' + book.name, 'true');
      // Show finished modal with recommendations
      setShowFinished(true);
      setLoadingRecs(true);
      getRecommendations(book.title).then(recs => {
        setRecommendations(recs);
        setLoadingRecs(false);
      });
    }
    if (currentPage % 5 === 0 || finished) {
      const isFav = localStorage.getItem('fav_' + book.name) === 'true';
      Cloud.syncProgress(book.name, currentPage, pct, finished, isFav);
    }
  }, [currentPage]);
  
  // Track reading time and update streak
  const [streakToast, setStreakToast] = useState('');

  useEffect(() => {
    const newStreak = Stats.updateStreak();
    const lastRead = localStorage.getItem('stat_lastread_prev');
    const today = new Date().toDateString();
    if (lastRead !== today) {
      localStorage.setItem('stat_lastread_prev', today);
      if (newStreak === 1) setStreakToast('Reading streak started! 🔥');
      else if (newStreak % 7 === 0) setStreakToast(`${newStreak} day streak! You're on fire! 🔥`);
      else if (newStreak > 1) setStreakToast(`${newStreak} day streak! Keep it up! 🔥`);
      if (newStreak > 0) setTimeout(() => setStreakToast(''), 3000);
    }
    const timer = setInterval(() => {
      Stats.addReadingTime(1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const themes = {
    dark:  { bg:'#0B0D11', text:'#C8D8DC', toolbar:'#0B0D11', border:'#445257' },
    sepia: { bg:'#EFF3F4', text:'#1A2428', toolbar:'#D8E4E8', border:'rgba(26,36,40,0.15)' },
    white: { bg:'#F5F8F9', text:'#1A2428', toolbar:'#E8EEF0', border:'rgba(26,36,40,0.1)' },
  };
  const th = themes[theme];

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    if (selected && selected.length > 2) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbar({ text: selected, x: rect.left + rect.width / 2, y: rect.top + window.scrollY - 10 });
    } else {
      setToolbar(null);
    }
  };

  const closeToolbar = () => {
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  };

  const applyAnnotation = (type) => {
    const newAnn = { type, text: toolbar.text, page: currentPage, id: Date.now() };
    const updated = [...annotations, newAnn];
    saveAnnotations(updated, newAnn);
    closeToolbar();
    setQuoteToast(type === 'highlight' ? 'Highlighted! ✓' : type === 'underline' ? 'Underlined! ✓' : 'Strikethrough! ✓');
    setTimeout(() => setQuoteToast(''), 2000);
  };

  const handleSaveQuote = () => {
    Quotes.save(book.name, toolbar.text);
    setQuoteToast('Quote saved! ✓');
    setTimeout(() => setQuoteToast(''), 2500);
    closeToolbar();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(toolbar.text);
    setQuoteToast('Copied! ✓');
    setTimeout(() => setQuoteToast(''), 2000);
    closeToolbar();
  };

  const handleComment = () => {
    setCommentModal(toolbar.text);
    setCommentText('');
    closeToolbar();
  };

  const saveComment = () => {
    if (commentText.trim()) {
      Quotes.save(book.name, `"${commentModal}" — 💬 ${commentText.trim()}`);
      const updated = [...annotations, { type:'comment', text:commentModal, comment:commentText.trim(), page:currentPage, id:Date.now() }];
      saveAnnotations(updated);
      setQuoteToast('Comment saved! ✓');
      setTimeout(() => setQuoteToast(''), 2500);
    }
    setCommentModal(null);
  };

  const renderPara = (para, i) => {
    const pageAnnotations = annotations.filter(a => a.page === currentPage && a.text && para.includes(a.text));
    if (pageAnnotations.length === 0) {
      return (
        <p key={i} style={{ fontSize, lineHeight:1.95, color:th.text, marginBottom:'1.4em', fontFamily:"'EB Garamond', 'Lora', Georgia, serif" }}>
          {para}
        </p>
      );
    }
    let parts = [{ text: para, annotated: false }];
    pageAnnotations.forEach(ann => {
      parts = parts.flatMap(part => {
        if (part.annotated || !part.text.includes(ann.text)) return [part];
        const idx = part.text.indexOf(ann.text);
        const before = part.text.slice(0, idx);
        const match = part.text.slice(idx, idx + ann.text.length);
        const after = part.text.slice(idx + ann.text.length);
        return [
          ...(before ? [{ text: before, annotated: false }] : []),
          { text: match, annotated: true, ann },
          ...(after ? [{ text: after, annotated: false }] : []),
        ];
      });
    });
    return (
      <p key={i} style={{ fontSize, lineHeight:1.95, color:th.text, marginBottom:'1.4em', fontFamily:"'EB Garamond', 'Lora', Georgia, serif" }}>
        {parts.map((part, j) => {
          if (!part.annotated) return <span key={j}>{part.text}</span>;
          const { ann } = part;
          return (
            <span key={j} title={ann.type === 'comment' ? `💬 ${ann.comment}` : ''} style={{
              background: ann.type === 'highlight' ? 'rgba(255,107,53,0.35)' : 'transparent',
              textDecoration: ann.type === 'underline' ? 'underline' : ann.type === 'strike' ? 'line-through' : 'none',
              textDecorationColor: '#8B3A52',
              borderRadius: ann.type === 'highlight' ? 3 : 0,
              cursor: ann.type === 'comment' ? 'help' : 'default',
            }}>
              {part.text}
              {ann.type === 'comment' && <sup style={{ fontSize:9, color:'#8B3A52', marginLeft:1 }}>💬</sup>}
            </span>
          );
        })}
      </p>
    );
  };

  return (
    <div className="fade-in" style={{ minHeight:'100vh', background:th.bg, display:'flex', flexDirection:'column' }}>

      {/* Top bar */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:th.toolbar, borderBottom:`1px solid ${th.border}`, padding:'10px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'#8B3A52', fontSize:13, fontWeight:500 }}>
          <Icon name="arrow_left" size={16} color="#8B3A52"/> {t.backToLibrary}
        </button>
        <span style={{ flex:1, fontSize:12, color:'#829EA2', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{book.title}</span>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setFontSize(f => Math.max(12, f - 1))} style={{ background:'none', border:`1px solid ${th.border}`, borderRadius:6, color:th.text, padding:'3px 8px', cursor:'pointer', fontSize:12 }}>A−</button>
          <button onClick={() => setFontSize(f => Math.min(26, f + 1))} style={{ background:'none', border:`1px solid ${th.border}`, borderRadius:6, color:th.text, padding:'3px 8px', cursor:'pointer', fontSize:12 }}>A+</button>
          {['dark','sepia','white'].map(name => (
            <button key={name} onClick={() => setTheme(name)} style={{ width:20, height:20, borderRadius:'50%', border: theme===name ? '2px solid #8B3A52' : '2px solid #445257', background: name==='dark'?'#0B0D11': name==='sepia'?'#EFF3F4':'#C8D8DC', cursor:'pointer' }}/>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div style={{ height:2, background:'#222A2F' }}>
        <div style={{ width:`${pct}%`, height:2, background:'#8B3A52', transition:'width 0.3s' }}/>
      </div>

      {/* Content */}
      <div onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}
        style={{ flex:1, padding:'2rem 1.5rem', maxWidth:680, margin:'0 auto', width:'100%', userSelect:'text', position:'relative' }}>
        {pages[currentPage]?.map((para, i) => renderPara(para, i))}
      </div>

      {/* Selection toolbar */}
      {toolbar && (
        <div style={{ position:'absolute', left:toolbar.x, top:toolbar.y, transform:'translateX(-50%) translateY(-100%)', zIndex:999, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <div style={{ display:'flex', alignItems:'center', background:'#222A2F', borderRadius:2, padding:'6px 10px', gap:2, boxShadow:'0 4px 20px rgba(0,0,0,0.5)', border:'1px solid #445257' }}>
            <button onClick={handleComment} title="Comment" style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8, fontSize:16 }}>💬</button>
            <div style={{ width:1, height:20, background:'#445257' }}/>
            <button onClick={() => applyAnnotation('highlight')} title="Highlight" style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8, fontSize:16 }}>🖊</button>
            <div style={{ width:1, height:20, background:'#445257' }}/>
            <button onClick={() => applyAnnotation('underline')} title="Underline" style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8, color:'#829EA2' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
            </button>
            <div style={{ width:1, height:20, background:'#445257' }}/>
            <button onClick={() => applyAnnotation('strike')} title="Strikethrough" style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8, color:'#829EA2', fontSize:15, fontWeight:700, textDecoration:'line-through' }}>S</button>
            <div style={{ width:1, height:20, background:'#445257' }}/>
            <button onClick={handleSaveQuote} title="Save quote" style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8 }}>
              <Icon name="heart" size={14} color="#8B3A52"/>
            </button>
          </div>
          <div style={{ background:'#222A2F', borderRadius:10, padding:'6px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.5)', border:'1px solid #445257' }}>
            <button onClick={handleCopy} style={{ background:'none', border:'none', cursor:'pointer', color:'#829EA2', fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
              📋 Copy text
            </button>
          </div>
          <div style={{ width:0, height:0, borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderTop:'6px solid #222A2F' }}/>
        </div>
      )}

      {/* Comment modal */}
      {commentModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#222A2F', borderRadius:16, padding:20, width:'100%', maxWidth:360 }}>
            <p style={{ fontSize:13, color:'#829EA2', marginBottom:12, fontStyle:'italic', lineHeight:1.5 }}>"{commentModal.length > 80 ? commentModal.slice(0,80)+'...' : commentModal}"</p>
            <textarea autoFocus value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Add your comment..."
              style={{ width:'100%', background:'#0B0D11', border:'1px solid #445257', borderRadius:10, padding:12, color:'#C8D8DC', fontSize:13, resize:'none', height:100, marginBottom:12, fontFamily:'Inter, sans-serif' }}
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setCommentModal(null)} style={{ flex:1, padding:10, borderRadius:10, border:'1px solid #445257', background:'transparent', color:'#829EA2', fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveComment} style={{ flex:1, padding:10, borderRadius:10, border:'none', background:'#8B3A52', color:'#C8D8DC', fontSize:13, fontWeight:600, cursor:'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {quoteToast && (
        <div style={{ position:'fixed', bottom:100, left:'50%', transform:'translateX(-50%)', background:'#8B3A52', color:'#C8D8DC', padding:'10px 20px', borderRadius:2, fontSize:13, fontWeight:500, zIndex:999, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(255,107,53,0.4)' }}>
          {quoteToast}
        </div>
      )}

      {/* Page nav */}
      <div style={{ position:'sticky', bottom:0, background:th.toolbar, borderTop:`1px solid ${th.border}`, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
          style={{ background:'none', border:'1px solid #445257', borderRadius:8, color:currentPage===0?'#445257':'#8B3A52', padding:'8px 14px', fontSize:13, cursor:currentPage===0?'default':'pointer' }}>
          {t.prevPage}
        </button>
        <span style={{ fontSize:12, color:'#829EA2' }}>{currentPage + 1} / {pages.length} · {pct}%</span>
        <button onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage === pages.length - 1}
          style={{ background:'none', border:'1px solid #445257', borderRadius:8, color:currentPage===pages.length-1?'#445257':'#8B3A52', padding:'8px 14px', fontSize:13, cursor:currentPage===pages.length-1?'default':'pointer' }}>
          {t.nextPage}
        </button>
      </div>
      

      {/* Streak toast */}
      {streakToast && (
        <div style={{ position:'fixed', top:70, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg, #8B3A52, #ff8c00)', color:'#C8D8DC', padding:'10px 20px', borderRadius:2, fontSize:13, fontWeight:600, zIndex:999, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(255,107,53,0.5)', display:'flex', alignItems:'center', gap:8 }}>
          {streakToast}
        </div>
      )}

    </div>
  );
};

// ── SEE ALL SCREEN ────────────────────────────────────────
const SeeAllScreen = ({ t, onOpenBook, onBack }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  const loadBooks = async (pageNum, query = '') => {
    setLoading(true);
    try {
      const params = query
        ? `search=${encodeURIComponent(query)}&page=${pageNum}&mime_type=text%2Fplain`
        : `sort=popular&page=${pageNum}&mime_type=text%2Fplain`;
      const res = await fetch(GUTENDEX + '?' + params);
      const data = await res.json();
      const newBooks = (data.results || []).map(b => ({
        id: b.id, title: b.title,
        author: b.authors[0]?.name || 'Unknown',
        cover: b.formats['image/jpeg'] || '',
        txtUrl: b.formats['text/plain; charset=utf-8'] || b.formats['text/plain; charset=us-ascii'] || b.formats['text/plain'] || '',
        downloads: b.download_count || 0,
      })).filter(b => b.txtUrl);
      setBooks(prev => pageNum === 1 ? newBooks : [...prev, ...newBooks]);
      setHasMore(!!data.next);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadBooks(1); }, []);

  useEffect(() => {
    clearTimeout(searchRef.current);
    if (searchQ.trim().length < 2) { if (searchQ === '') { setPage(1); loadBooks(1); } setSearching(false); return; }
    setSearching(true);
    searchRef.current = setTimeout(() => { setPage(1); loadBooks(1, searchQ); setSearching(false); }, 500);
  }, [searchQ]);

  const downloadAndOpen = async (b) => {
    setDownloading(b.id); setError('');
    try {
      const txtUrl = b.txtUrl.replace('http://', 'https://');
      const res = await fetch('/api/fetch-book?url=' + encodeURIComponent(txtUrl));
      const text = await res.text();
      const paras = parseTxt(text);
      if (paras.length === 0) throw new Error('empty');
      const name = b.title + '.txt';
      await LS.saveBook(name, paras);
      if (b.cover) localStorage.setItem('defaultcover_' + name, b.cover);
      onOpenBook({ name, title: b.title, paras, cover: b.cover || coverColor(name) });
    } catch { setError('Could not download. Try another.'); }
    setDownloading(null);
  };

  return (
    <div className="fade-in" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: '#222A2F', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="arrow_left" size={16} color="#8B3A52" />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Popular Free Books</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#222A2F', borderRadius: 2, padding: '10px 14px', marginBottom: 20 }}>
        <Icon name="search" size={15} color="#829EA2" />
        <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search 70,000+ books..."
          style={{ background: 'none', border: 'none', outline: 'none', color: '#C8D8DC', fontSize: 13, flex: 1, fontFamily: "'Lora', serif" }} />
        {searching && <span className="spin" style={{ fontSize: 14, color: '#8B3A52' }}>⟳</span>}
        {searchQ.length > 0 && !searching && <button onClick={() => setSearchQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#829EA2', fontSize: 16 }}>✕</button>}
      </div>

      {error && <p style={{ color: '#6B2D3A', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {books.map(b => (
          <div key={b.id} onClick={() => downloading === null && downloadAndOpen(b)}
            style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#222A2F', borderRadius: 2, padding: 12, cursor: downloading !== null ? 'default' : 'pointer', border: '1px solid #445257', opacity: downloading === b.id ? 0.7 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ flexShrink: 0 }}>
              {b.cover
                ? <img src={b.cover} style={{ width: 58, height: 82, borderRadius: 2, objectFit: 'cover', display: 'block', border: '1px solid #445257' }} onError={e => { e.target.style.display='none'; }} />
                : <div style={{ width: 58, height: 82, borderRadius: 2, background: coverColor(b.title), display: 'flex', alignItems: 'flex-end', padding: 6, border: '1px solid #445257' }}><span style={{ fontSize: 9, fontWeight: 600, color: '#C8D8DC', lineHeight: 1.3 }}>{b.title.slice(0,25)}</span></div>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.title}</p>
              <p style={{ fontSize: 11, color: '#829EA2', marginBottom: 6 }}>{b.author}</p>
              <span style={{ fontSize: 10, color: '#445257', background: '#0B0D11', padding: '2px 8px', borderRadius: 2 }}>📥 {b.downloads.toLocaleString()}</span>
            </div>
            <div style={{ flexShrink: 0 }}>
              {downloading === b.id
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><span className="spin" style={{ fontSize: 20, color: '#8B3A52' }}>⟳</span><span style={{ fontSize: 9, color: '#8B3A52' }}>Loading</span></div>
                : <div style={{ background: '#8B3A52', borderRadius: 2, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#C8D8DC', textAlign: 'center' }}>Read<br/><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.85 }}>Free ↓</span></div>
              }
            </div>
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '2rem 0' }}><span className="spin" style={{ fontSize: 24, color: '#8B3A52' }}>⟳</span><p style={{ fontSize: 12, color: '#829EA2', marginTop: 8 }}>Loading books...</p></div>}

      {!loading && hasMore && (
        <button onClick={() => { const n = page+1; setPage(n); loadBooks(n, searchQ); }}
          style={{ width: '100%', marginTop: 16, padding: 14, borderRadius: 2, border: '1.5px dashed #445257', background: 'transparent', color: '#829EA2', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="book" size={14} color="#829EA2" /> Load more books
        </button>
      )}
      {!loading && books.length === 0 && <div style={{ textAlign: 'center', padding: '3rem 0' }}><p style={{ fontSize: 24, marginBottom: 8 }}>📚</p><p style={{ fontSize: 14, color: '#829EA2' }}>No books found</p></div>}
    </div>
  );
};

// ── HOME SCREEN ───────────────────────────────────────────
const HomeScreen = ({ t, onOpenBook, onSeeAll }) => {
  const [active, setActive] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [featuredBooks, setFeaturedBooks] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [showGenres, setShowGenres] = useState(false);
  const searchTimeout = useRef(null);
  const sliderTimeout = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(searchTimeout.current);
      clearInterval(sliderTimeout.current);
    };
  }, []);

  // Auto advance hero slider every second
  useEffect(() => {
    if (featuredBooks.length === 0) return;
    const id = setInterval(() => {
      setActive(prev => (prev + 1) % featuredBooks.length);
    }, 3000);
    return () => clearInterval(id);
  }, [featuredBooks.length]);

  // Load popular books on mount — Gutendex (Project Gutenberg)
  useEffect(() => {
    const cached = sessionStorage.getItem('catalog_v1');
    if (cached) {
      const books = JSON.parse(cached);
      setCatalog(books);
      setFeaturedBooks(books.filter(b => b.cover).slice(0, 5));
      setLoadingCatalog(false);
      return;
    }
    fetchGutendex('sort=popular&page=1&mime_type=text%2Fplain')
      .then(async books => {
        try {
          const more = await fetchGutendex('sort=popular&page=2&mime_type=text%2Fplain');
          books = [...books, ...more];
        } catch {}
        sessionStorage.setItem('catalog_v1', JSON.stringify(books));
        setCatalog(books);
        setFeaturedBooks(books.filter(b => b.cover).slice(0, 5));
        setLoadingCatalog(false);
      })
      .catch(() => setLoadingCatalog(false));
  }, []);

  // Search with debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await fetchGutendex('search=' + encodeURIComponent(searchQuery) + '&mime_type=text%2Fplain');
        setSearchResults(results);
      } catch {}
      setSearching(false);
    }, 500);
  }, [searchQuery]);

  const downloadAndOpen = async (b) => {
    if (!b.txtUrl) { setSearchError('No readable version available.'); return; }
    setDownloading(b.id); setSearchError('');
    try {
      const txtUrl = b.txtUrl.replace('http://', 'https://');
      const res = await fetch('/api/fetch-book?url=' + encodeURIComponent(txtUrl));
      const text = await res.text();
      const paras = parseTxt(text);
      if (paras.length === 0) throw new Error('empty');
      const name = b.title + '.txt';
      await LS.saveBook(name, paras);
      if (b.cover) localStorage.setItem('defaultcover_' + name, b.cover);
      setSearchQuery(''); setSearchResults([]);
      onOpenBook({ name, title: b.title, paras, cover: b.cover || coverColor(name) });
    } catch { setSearchError('Could not download this book. Try another one.'); }
    setDownloading(null);
  };

  const heroBook = featuredBooks[active] || MOCK.featured[0];

  return (
    <div className="fade-in" style={{ paddingBottom: 20 }}>
      <p style={{ fontSize: 13, color: "#829EA2" }}>{t.welcome}</p>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 2, marginBottom: 20 }}>{t.discover}</h1>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#222A2F", borderRadius: 2, padding: "10px 14px" }}>
          <Icon name="search" size={16} color="#829EA2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowGenres(false); }}
            onFocus={() => { if (!searchQuery) setShowGenres(true); }}
            onBlur={() => setTimeout(() => setShowGenres(false), 200)}
            placeholder={t.search}
            style={{ background: 'none', border: 'none', outline: 'none', color: '#C8D8DC', fontSize: 14, flex: 1, fontFamily: 'Inter, sans-serif' }}
          />
          {searching && <span className="spin" style={{ fontSize: 16, color: '#8B3A52' }}>⟳</span>}
          {searchQuery.length > 0 && !searching && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#829EA2', fontSize: 18, lineHeight: 1 }}>✕</button>
          )}
        </div>

        {/* Genre dropdown */}
        {showGenres && !searchQuery && (
          <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#222A2F', borderRadius: 2, border: '1px solid #445257', zIndex: 200, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <p style={{ fontSize: 11, color: '#829EA2', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 }}>Browse by genre</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: '🗡 Adventure',   query: 'adventure' },
                { label: '💀 Horror',      query: 'horror' },
                { label: '❤️ Romance',     query: 'romance' },
                { label: '🔬 Science',     query: 'science' },
                { label: '🏛 History',     query: 'history' },
                { label: '🧠 Philosophy',  query: 'philosophy' },
                { label: '🔍 Mystery',     query: 'mystery' },
                { label: '👻 Gothic',      query: 'gothic' },
                { label: '🌍 Travel',      query: 'travel' },
                { label: '😂 Humor',       query: 'humor' },
                { label: '🧪 Fiction',     query: 'fiction' },
                { label: '📜 Classic',     query: 'classic literature' },
              ].map(g => (
                <button key={g.query} onClick={() => { setSearchQuery(g.query); setShowGenres(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 2, border: '1px solid #445257', background: '#0B0D11', color: '#C8D8DC', fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#222A2F', borderRadius: 2, border: '1px solid #445257', zIndex: 200, maxHeight: 420, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {searchResults.map((b, i) => (
              <div key={b.id} onClick={() => downloading === null && downloadAndOpen(b)}
                style={{ display: 'flex', gap: 12, padding: '12px 14px', borderBottom: i < searchResults.length - 1 ? '1px solid #0B0D11' : 'none', cursor: downloading !== null ? 'default' : 'pointer', alignItems: 'center' }}>
                {b.cover ? (
                  <img src={b.cover} style={{ width: 42, height: 58, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div style={{ width: 42, height: 58, borderRadius: 6, background: coverColor(b.title), flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: 4 }}>
                    <span style={{ fontSize: 8, color: '#C8D8DC', fontWeight: 600 }}>{b.title.slice(0, 20)}</span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                  <p style={{ fontSize: 11, color: '#829EA2', marginBottom: 4 }}>{b.author}</p>
                  {b.summary && <p style={{ fontSize: 10, color: '#829EA2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.summary}</p>}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {downloading === b.id ? (
                    <span className="spin" style={{ fontSize: 18, color: '#8B3A52' }}>⟳</span>
                  ) : (
                    <div style={{ background: '#8B3A52', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, color: '#C8D8DC' }}>Read</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
          <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#222A2F', borderRadius: 2, border: '1px solid #445257', padding: '20px', textAlign: 'center', color: '#829EA2', fontSize: 13, zIndex: 200 }}>
            No books found for "{searchQuery}"
          </div>
        )}
      </div>

      {searchError && (
        <p style={{ color: '#6B2D3A', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{searchError}</p>
      )}

      {/* Main content hidden during search */}
      {!searchQuery && (
        <>
          {/* Hero slider with real books */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ borderRadius: 16, height: 180, position: "relative", overflow: "hidden" }}
              onClick={() => heroBook.txtUrl && downloadAndOpen(heroBook)}>
              {heroBook.cover ? (
                <img src={heroBook.cover} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, #1a3a5c, #0B0D11)` }} />
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 100%)", padding: "24px 20px", display: "flex", flexDirection: "column", justifyContent: "flex-end", cursor: heroBook.txtUrl ? 'pointer' : 'default' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#8B3A52", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Popular</span>
                <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>{heroBook.title}</h2>
                <p style={{ fontSize: 12, color: "#829EA2", marginBottom: 14 }}>{heroBook.author}</p>
                {downloading === heroBook.id ? (
                  <div style={{ alignSelf: "flex-start", background: "#8B3A52", color: "#C8D8DC", borderRadius: 2, padding: "7px 18px", fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spin">⟳</span> Downloading...
                  </div>
                ) : (
                  <div style={{ alignSelf: "flex-start", background: "#8B3A52", color: "#C8D8DC", borderRadius: 2, padding: "7px 18px", fontSize: 12, fontWeight: 600 }}>
                    Read Free ↓
                  </div>
                )}
              </div>
              {/* Slider dots */}
              <div style={{ position: "absolute", bottom: 12, right: 16, display: "flex", gap: 5 }}>
                {featuredBooks.map((_, i) => (
                  <div key={i} onClick={e => { e.stopPropagation(); setActive(i); }}
                    style={{ width: i === active ? 18 : 6, height: 6, borderRadius: 3, background: i === active ? "#8B3A52" : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "width 0.2s" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Popular books */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Popular Free Books</h3>
            <span onClick={onSeeAll} style={{ fontSize: 12, color: "#8B3A52", cursor: "pointer" }}>{t.seeAll}</span>
          </div>

          {loadingCatalog ? (
            <div className="scroll-x" style={{ marginBottom: 28 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ minWidth: 110, flexShrink: 0 }}>
                  <div style={{ width: 110, height: 155, borderRadius: 2, background: '#222A2F', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation: 'shimmer 1.2s infinite' }}/>
                  </div>
                  <div style={{ height: 10, background: '#222A2F', borderRadius: 2, marginTop: 8, width: '80%' }}/>
                  <div style={{ height: 8, background: '#222A2F', borderRadius: 2, marginTop: 5, width: '55%' }}/>
                </div>
              ))}
            </div>
          ) : (
            <div className="scroll-x" style={{ marginBottom: 28 }}>
              {catalog.map(b => (
                <div key={b.id} onClick={() => downloadAndOpen(b)}
                  style={{ minWidth: 110, cursor: 'pointer', opacity: downloading === b.id ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  {b.cover ? (
                    <img src={b.cover} style={{ width: 110, height: 155, borderRadius: 2, objectFit: 'cover', display: 'block', border: '1px solid #445257' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: 110, height: 155, borderRadius: 2, background: coverColor(b.title), display: 'flex', alignItems: 'flex-end', padding: 8, border: '1px solid #445257' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#C8D8DC', lineHeight: 1.3 }}>{b.title}</span>
                    </div>
                  )}
                  <p style={{ fontSize: 11, fontWeight: 500, marginTop: 6, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{b.title}</p>
                  <p style={{ fontSize: 10, color: "#829EA2", marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{b.author}</p>
                  {downloading === b.id ? (
                    <p style={{ fontSize: 10, color: '#8B3A52', marginTop: 3 }}>Downloading...</p>
                  ) : b.downloads ? (
                    <p style={{ fontSize: 10, color: "#445257", marginTop: 3 }}>📥 {(b.downloads/1000).toFixed(0)}k</p>
                  ) : (
                    <p style={{ fontSize: 11, color: "#8B3A52", fontWeight: 600, marginTop: 3 }}>Free ↓</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── SHARE QUOTE ───────────────────────────────────────────
async function shareQuote(text, bookTitle) {
  // 1. Build canvas image
  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0B0D11');
  grad.addColorStop(1, '#222A2F');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Orange accent bar
  ctx.fillStyle = '#8B3A52';
  ctx.fillRect(80, 120, 6, H - 240);

  // Quote mark
  ctx.font = 'bold 160px Georgia, serif';
  ctx.fillStyle = 'rgba(255,107,53,0.15)';
  ctx.fillText('"', 60, 300);

  // Quote text — word-wrap
  const maxW = W - 200;
  const words = text.split(' ');
  let lines = [], line = '';
  ctx.font = '500 52px Inter, sans-serif';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  // Clamp to ~8 lines
  if (lines.length > 8) { lines = lines.slice(0, 8); lines[7] = lines[7] + '…'; }

  ctx.fillStyle = '#C8D8DC';
  const lineH = 72;
  const startY = Math.max(200, (H - lines.length * lineH - 160) / 2);
  lines.forEach((l, i) => { ctx.fillText(l, 120, startY + i * lineH); });

  // Book title
  ctx.font = '600 38px Inter, sans-serif';
  ctx.fillStyle = '#8B3A52';
  ctx.fillText('— ' + bookTitle, 120, H - 160);

  // App name
  ctx.font = '400 30px Inter, sans-serif';
  ctx.fillStyle = '#829EA2';
  ctx.fillText('Ilm Read Books', 120, H - 110);

  // 2. Copy text to clipboard
  const shareText = `"${text}"\n— ${bookTitle}\n\nRead on Ilm Read Books`;
  try { await navigator.clipboard.writeText(shareText); } catch {}

  // 3. Try Web Share API with image
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'quote.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: shareText });
        return;
      } catch {}
    }
    // 4. Fallback: download image
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ilmbook-quote.png';
    a.click();
  }, 'image/png');
}

// ── QUOTES TAB ────────────────────────────────────────────
const QuotesTab = ({ quotes, setQuotes, allAnnotations, onOpenBook }) => {
  const [noteFilter, setNoteFilter] = useState('quotes');

  const CATEGORIES = [
    { key: 'quotes',    label: '❝ Quotes'      },
    { key: 'highlight', label: '🖊 Highlights'  },
    { key: 'underline', label: 'U Underlines'   },
    { key: 'strike',    label: 'S Strikethrough'},
    { key: 'comment',   label: '💬 Comments'   },
  ];

  const filtered = noteFilter === 'quotes'
    ? quotes
    : allAnnotations.filter(a => a.type === noteFilter);

  const jumpToBook = async (bookName) => {
    const paras = await LS.loadBook(bookName);
    if (!paras || paras.length === 0) return;
    onOpenBook({
      name: bookName,
      title: bookName.replace(/\.[^/.]+$/, ''),
      paras,
      cover: localStorage.getItem('defaultcover_' + bookName) || coverColor(bookName),
    });
  };

  return (
    <div>
      {/* Category chips */}
      <div className="scroll-x" style={{ marginBottom: 16, paddingBottom: 4 }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setNoteFilter(c.key)} style={{
            whiteSpace: 'nowrap', padding: '7px 14px', borderRadius: 2,
            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: noteFilter === c.key ? '#8B3A52' : '#222A2F',
            color: noteFilter === c.key ? '#fff' : '#829EA2',
            transition: 'all 0.15s', flexShrink: 0,
          }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Quotes list */}
      {noteFilter === 'quotes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {quotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>💬</p>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No quotes yet</p>
              <p style={{ fontSize: 12, color: '#829EA2' }}>Highlight text while reading to save quotes</p>
            </div>
          ) : quotes.map(q => (
            <div key={q.id} style={{ background: '#222A2F', borderRadius: 2, padding: 16, borderLeft: '3px solid #8B3A52' }}>
              <p style={{ fontSize: 13, color: '#C8D8DC', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 10 }}>"{q.text}"</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 11, color: '#8B3A52', fontWeight: 500 }}>{q.bookTitle}</p>
                  <p style={{ fontSize: 10, color: '#829EA2', marginTop: 2 }}>{q.savedAt}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => shareQuote(q.text, q.bookTitle)}
                    title="Share quote"
                    style={{ background: '#0B0D11', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontSize: 14 }}>
                    📤
                  </button>
                  <button onClick={() => { Quotes.delete(q.id); setQuotes(Quotes.getAll()); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>
                    <Icon name="trash" size={14} color="#6B2D3A"/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Annotations list */}
      {noteFilter !== 'quotes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>🔖</p>
              <p style={{ fontSize: 14, color: '#829EA2' }}>No {noteFilter}s yet</p>
              <p style={{ fontSize: 12, color: '#829EA2', marginTop: 4 }}>Select text while reading to add</p>
            </div>
          ) : filtered.map((a, i) => (
            <div key={a.id || i} onClick={() => jumpToBook(a.bookName)}
              style={{ background: '#222A2F', borderRadius: 2, padding: 16, cursor: 'pointer',
                borderLeft: `3px solid ${a.type === 'highlight' ? '#8B3A52' : a.type === 'underline' ? '#829EA2' : a.type === 'strike' ? '#6B2D3A' : '#445257'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#8B3A52', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {CATEGORIES.find(c => c.key === a.type)?.label || a.type}
                </span>
                <span style={{ fontSize: 10, color: '#829EA2' }}>Page {(a.page || 0) + 1}</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#C8D8DC',
                background: a.type === 'highlight' ? 'rgba(255,107,53,0.12)' : 'transparent',
                padding: a.type === 'highlight' ? '6px 8px' : 0, borderRadius: 6,
                textDecoration: a.type === 'underline' ? 'underline' : a.type === 'strike' ? 'line-through' : 'none',
                textDecorationColor: '#8B3A52' }}>
                "{a.text}"
              </p>
              {a.comment && (
                <div style={{ background: '#0B0D11', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
                  <p style={{ fontSize: 11, color: '#829EA2', marginBottom: 2 }}>Your note:</p>
                  <p style={{ fontSize: 12, color: '#C8D8DC' }}>{a.comment}</p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <p style={{ fontSize: 11, color: '#8B3A52', fontWeight: 500 }}>{a.bookTitle}</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); shareQuote(a.text, a.bookTitle); }}
                    title="Share"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>
                    📤
                  </button>
                  <span style={{ fontSize: 10, color: '#829EA2', background: '#0B0D11', padding: '3px 8px', borderRadius: 2 }}>Tap to jump →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── LIBRARY SCREEN ────────────────────────────────────────
const CATS_ICONS = ["book","check","heart","quote"];

const LibraryScreen = ({ t, onOpenBook, refreshKey }) => {
  const [cat, setCat] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [books, setBooks] = useState([]);
  const [quotes, setQuotes] = useState(() => Quotes.getAll());
  const [allAnnotations, setAllAnnotations] = useState([]);
  const fileRef = useRef();

  const refreshBooks = async () => {
    const names = await LS.getAllBooks();
    setBooks(names);
    // Load annotations for all books
    const annotations = [];
    names.forEach(name => {
      try {
        const ann = JSON.parse(localStorage.getItem('ann_' + name) || '[]');
        ann.forEach(a => annotations.push({ ...a, bookName: name, bookTitle: name.replace(/\.[^/.]+$/, '') }));
      } catch {}
    });
    setAllAnnotations(annotations);
  };

  useEffect(() => {
    refreshBooks();
    setQuotes(Quotes.getAll());
  }, [refreshKey]);

  const current = books.find(name => localStorage.getItem('lastRead') === name)
    || books.find(name => { const p = LS.loadPct(name); return p > 0 && p < 100; });

  const isFavorite = name => localStorage.getItem('fav_' + name) === 'true';

  const toggleFavorite = (e, name) => {
    e.stopPropagation();
    if (isFavorite(name)) {
      localStorage.removeItem('fav_' + name);
    } else {
      localStorage.setItem('fav_' + name, 'true');
    }
    setBooks([...LS.getAllBooks()]);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true); setError('');
    try {
      let paras = [];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'epub') {
        paras = await parseEpub(await file.arrayBuffer());
      } else if (ext === 'pdf') {
        paras = await parsePdf(await file.arrayBuffer());
      } else {
        paras = parseTxt(await file.text());
      }
      if (paras.length === 0) throw new Error('empty');
      await LS.saveBook(file.name, paras);
      await refreshBooks();
      onOpenBook({ name: file.name, title: file.name.replace(/\.[^/.]+$/, ''), paras, cover: coverColor(file.name) });
    } catch (err) {
      setError(t.errorFile);
      console.error(err);
    }
    setLoading(false);
    e.target.value = '';
  };

  const openSaved = async (name) => {
    const paras = await LS.loadBook(name);
    if (!paras) return;
    onOpenBook({ name, title: name.replace(/\.[^/.]+$/, ''), paras, cover: coverColor(name) });
  };

  const deleteBook = async (e, name) => {
    e.stopPropagation();
    await LS.removeBook(name);
    await refreshBooks();
  };

  const filtered = cat === 0 ? books
    : cat === 1 ? books.filter(n => localStorage.getItem('finished_' + n) === 'true')
    : cat === 2 ? books.filter(n => localStorage.getItem('fav_' + n) === 'true')
    : [];

  return (
    <div className="fade-in">
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>{t.myBooks}</h1>

      {/* Currently reading */}
      {current && (
        <div onClick={() => openSaved(current)} style={{ background:"#222A2F", borderRadius:2, padding:16, marginBottom:24, cursor:'pointer' }}>
          <p style={{ fontSize:11, color:"#829EA2", marginBottom:12, textTransform:"uppercase", letterSpacing:0.8, fontWeight:500 }}>{t.nowReading}</p>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <Cover book={{ title: current.replace(/\.[^/.]+$/, ''), cover: coverColor(current) }} w={64} h={90}/>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{current.replace(/\.[^/.]+$/, '')}</p>
              <ProgressBar pct={LS.loadPct(current)} h={4}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ fontSize:11, color:"#8B3A52", fontWeight:600 }}>{LS.loadPct(current)}% {t.completed}</span>
                <span style={{ fontSize:11, background:"#8B3A52", color:"#fff", borderRadius:2, padding:"4px 12px", fontWeight:500 }}>{t.continueBtn}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20, overflowX:"auto", paddingBottom:4 }}>
        {t.cats.map((label, i) => (
          <button key={i} onClick={() => setCat(i)} style={{ display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", padding:"8px 14px", borderRadius:2, border:"none", cursor:"pointer", fontSize:12, fontWeight:500, background:cat===i?"#8B3A52":"#222A2F", color:cat===i?"#fff":"#829EA2", transition:"all 0.15s" }}>
            <Icon name={CATS_ICONS[i]} size={13} color={cat===i?"#fff":"#829EA2"}/> {label}
          </button>
        ))}
      </div>

      {/* Quotes tab */}
      {cat === 3 && (
        <QuotesTab quotes={quotes} setQuotes={setQuotes} allAnnotations={allAnnotations} onOpenBook={onOpenBook}/>
      )}

      {/* Book list */}
      {cat !== 3 && (
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
          {filtered.map(name => {
            const pct = LS.loadPct(name);
            const title = name.replace(/\.[^/.]+$/, '');
            return (
              <div key={name} onClick={() => openSaved(name)} style={{ display:"flex", gap:12, alignItems:"center", background:"#222A2F", borderRadius:2, padding:12, cursor:'pointer' }}>
                <Cover book={{ title, cover: coverColor(name) }} w={52} h={74}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{title}</p>
                  <p style={{ fontSize:11, color:"#829EA2", marginBottom:8 }}>{name.split('.').pop().toUpperCase()}</p>
                  <ProgressBar pct={pct} h={3}/>
                  <span style={{ fontSize:10, color:pct>=100?"#445257":"#8B3A52", marginTop:4, display:"block", fontWeight:500 }}>
                    {pct >= 100 ? `✓ ${t.finished}` : `${pct}%`}
                  </span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={e => toggleFavorite(e, name)} style={{ background:'none', border:'none', cursor:'pointer', padding:6, borderRadius:8 }}>
                    <Icon name="heart" size={15} color={isFavorite(name) ? "#6B2D3A" : "#829EA2"}/>
                  </button>
                  <button onClick={e => deleteBook(e, name)} style={{ background:'none', border:'none', cursor:'pointer', padding:6, borderRadius:8, opacity:0.6 }}>
                    <Icon name="trash" size={15} color="#6B2D3A"/>
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && books.length > 0 && (
            <p style={{ color:"#829EA2", fontSize:13, textAlign:"center", padding:"2rem 0" }}>{t.noBooks}</p>
          )}
        </div>
      )}

      {error && <p style={{ color:"#6B2D3A", fontSize:12, marginBottom:10, textAlign:"center" }}>{error}</p>}
      <input ref={fileRef} type="file" accept=".epub,.txt,.pdf" style={{ display:"none" }} onChange={handleFile}/>
      <button onClick={() => fileRef.current.click()} disabled={loading}
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:16, borderRadius:2, border:"1.5px dashed #445257", background:"transparent", color:loading?"#829EA2":"#829EA2", fontSize:13, fontWeight:500, cursor:loading?"default":"pointer" }}>
        {loading ? <><span className="spin" style={{ fontSize:16 }}>⟳</span> {t.loading}</> : <><Icon name="upload" size={16} color="#829EA2"/> {t.uploadBtn}</>}
      </button>

      {books.length === 0 && !loading && (
        <div style={{ textAlign:"center", padding:"2rem 0" }}>
          <p style={{ fontSize:28, marginBottom:8 }}>📚</p>
          <p style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>{t.emptyTitle}</p>
          <p style={{ fontSize:13, color:"#829EA2" }}>{t.emptySub}</p>
        </div>
      )}
    </div>
  );
};

// ── HIGHLIGHTS SCREEN ────────────────────────────────────
const HighlightsScreen = ({ t, onOpenBook }) => {
  const [showGenreMenu, setShowGenreMenu] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [catalogBooks, setCatalogBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');

  const GENRES = [
    { label: '🗡 Adventure',   query: 'adventure'          },
    { label: '💀 Horror',      query: 'horror'             },
    { label: '❤️ Romance',     query: 'romance'            },
    { label: '🔬 Science',     query: 'science'            },
    { label: '🏛 History',     query: 'history'            },
    { label: '🧠 Philosophy',  query: 'philosophy'         },
    { label: '🔍 Mystery',     query: 'mystery'            },
    { label: '👻 Gothic',      query: 'gothic'             },
    { label: '🌍 Travel',      query: 'travel'             },
    { label: '😂 Humor',       query: 'humor'              },
    { label: '🧪 Fiction',     query: 'fiction'            },
    { label: '📜 Classic',     query: 'classic literature' },
  ];

  const loadGenreBooks = (query) => {
    setLoadingBooks(true);
    setCatalogBooks([]);
    setShowGenreMenu(false);
    fetchGutendex('search=' + encodeURIComponent(query) + '&mime_type=text%2Fplain')
      .then(books => { setCatalogBooks(books); setLoadingBooks(false); })
      .catch(() => setLoadingBooks(false));
  };

  const downloadAndOpen = async (b) => {
    setDownloading(b.id); setError('');
    try {
      const txtUrl = b.txtUrl.replace('http://', 'https://');
      const res = await fetch('/api/fetch-book?url=' + encodeURIComponent(txtUrl));
      const text = await res.text();
      const paras = parseTxt(text);
      if (paras.length === 0) throw new Error('empty');
      const name = b.title + '.txt';
      await LS.saveBook(name, paras);
      if (b.cover) localStorage.setItem('defaultcover_' + name, b.cover);
      onOpenBook({ name, title: b.title, paras, cover: b.cover || coverColor(name) });
    } catch { setError('Could not download. Try another.'); }
    setDownloading(null);
  };

  const SkeletonList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ display: 'flex', gap: 12, background: '#222A2F', borderRadius: 2, padding: 12 }}>
          <div style={{ width: 52, height: 74, borderRadius: 8, background: '#445257', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation: 'shimmer 1.2s infinite' }}/>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <div style={{ height: 12, background: '#445257', borderRadius: 4, width: '70%' }}/>
            <div style={{ height: 10, background: '#445257', borderRadius: 4, width: '45%' }}/>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fade-in" style={{ paddingBottom: 24 }}>

      {/* Header + Genre button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t.highlights}</h1>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowGenreMenu(p => !p)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 2,
            border: '1px solid #445257', background: showGenreMenu ? '#8B3A52' : '#222A2F',
            color: showGenreMenu ? '#fff' : '#829EA2',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            📚 Genres {showGenreMenu ? '▲' : '▼'}
          </button>
          {showGenreMenu && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 300,
              background: '#222A2F', borderRadius: 2, border: '1px solid #445257',
              padding: 12, width: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <p style={{ fontSize: 10, color: '#829EA2', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: 600 }}>Browse by genre</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {GENRES.map(g => (
                  <button key={g.query} onClick={() => { setSelectedGenre(g); loadGenreBooks(g.query); }}
                    style={{
                      padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 500, textAlign: 'left',
                      background: selectedGenre?.query === g.query ? '#8B3A52' : '#0B0D11',
                      color: selectedGenre?.query === g.query ? '#fff' : '#829EA2',
                      transition: 'all 0.15s',
                    }}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p style={{ color: '#6B2D3A', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

      {selectedGenre && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{selectedGenre.label} Books</p>
          <button onClick={() => { setSelectedGenre(null); setCatalogBooks([]); }}
            style={{ fontSize: 11, color: '#8B3A52', background: 'none', border: 'none', cursor: 'pointer' }}>
            Clear ✕
          </button>
        </div>
      )}

      {selectedGenre ? (
        loadingBooks ? <SkeletonList /> : catalogBooks.length === 0 ? (
          <p style={{ color: '#829EA2', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>No books found</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catalogBooks.map(b => (
              <div key={b.id} onClick={() => downloading === null && downloadAndOpen(b)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#222A2F', borderRadius: 2, padding: 12, cursor: 'pointer', opacity: downloading === b.id ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                {b.cover ? (
                  <img src={b.cover} style={{ width: 52, height: 74, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }}/>
                ) : (
                  <div style={{ width: 52, height: 74, borderRadius: 8, background: coverColor(b.title), flexShrink: 0 }}/>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                  <p style={{ fontSize: 11, color: '#829EA2', marginBottom: 6 }}>{b.author}</p>
                  <span style={{ fontSize: 10, color: '#829EA2', background: '#0B0D11', padding: '2px 8px', borderRadius: 2 }}>
                    📥 {b.downloads.toLocaleString()}
                  </span>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {downloading === b.id ? (
                    <span className="spin" style={{ fontSize: 20, color: '#8B3A52' }}>⟳</span>
                  ) : (
                    <div style={{ background: '#8B3A52', borderRadius: 2, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#C8D8DC', textAlign: 'center' }}>
                      Read<br/><span style={{ fontSize: 9, fontWeight: 400 }}>Free ↓</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📚</p>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Browse by Genre</p>
          <p style={{ fontSize: 13, color: '#829EA2', marginBottom: 20 }}>Tap Genres above to discover books by category</p>
          <button onClick={() => setShowGenreMenu(true)} style={{
            padding: '10px 24px', borderRadius: 2, border: 'none',
            background: '#8B3A52', color: '#C8D8DC', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            📚 Browse Genres
          </button>
        </div>
      )}
    </div>
  );
};


// ── PROFILE SCREEN ────────────────────────────────────────

const ProfileScreen = ({ t, user, onLogout }) => {
  const [userRating, setUserRating] = useState(() => Stats.getRating());
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [readingTime, setReadingTime] = useState(() => Stats.getReadingTime());
  const [booksRead, setBooksRead] = useState(() => Stats.getBooksRead());
  const [streak, setStreak] = useState(() => Stats.getStreak());
  const [profilePic, setProfilePic] = useState(() => Auth.getPic());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const picRef = useRef();

  useEffect(() => {
    setReadingTime(Stats.getReadingTime());
    setBooksRead(Stats.getBooksRead());
    setUserRating(Stats.getRating());
  }, []);

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      Auth.savePic(ev.target.result);
      setProfilePic(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const saveName = () => {
    if (!newName.trim()) return;
    const updated = { ...user, name: newName.trim() };
    Auth.saveUser(updated);
    const stored = localStorage.getItem('account_' + user.email);
    if (stored) {
      const acc = JSON.parse(stored);
      localStorage.setItem('account_' + user.email, JSON.stringify({ ...acc, name: newName.trim() }));
    }
    setEditingName(false);
    window.location.reload();
  };

  const menuIcons = ["card", "history", "heart", "star", "upload"];
  const menuLabels = [t.menu[0], t.menu[1], t.menu[2], t.menu[3], "Send Feedback"];

  const handleMenuClick = (i) => {
    if (i === 3) { setTempRating(userRating || 5); setShowRatingModal(true); }
    if (i === 4) { setShowFeedback(true); }
  };

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{t.profile}</h1>

      {/* User card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#222A2F', borderRadius: 2, padding: 16, marginBottom: 20 }}>
        {/* Profile picture */}
        <div style={{ position: 'relative', flexShrink: 0 }} onClick={() => picRef.current.click()}>
          {profilePic ? (
            <img src={profilePic} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid #8B3A52' }}/>
          ) : (
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#8B3A52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, cursor: 'pointer' }}>
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: '#0B0D11', border: '1px solid #445257', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: 10 }}>✏️</span>
          </div>
          <input ref={picRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePicChange}/>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                style={{ background: '#0B0D11', border: '1px solid #445257', borderRadius: 8, padding: '6px 10px', color: '#C8D8DC', fontSize: 14, fontFamily: 'Lora', outline: 'none', flex: 1 }}
              />
              <button onClick={saveName} style={{ background: '#8B3A52', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#C8D8DC', fontSize: 12, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingName(false)} style={{ background: '#445257', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#829EA2', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>{user?.name}</p>
              <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 2 }}>
                <span style={{ fontSize: 12 }}>✏️</span>
              </button>
            </div>
          )}
          <p style={{ fontSize: 12, color: '#829EA2' }}>{user?.email}</p>
        </div>

        {/* Logout button */}
        <button onClick={() => setShowLogoutConfirm(true)} style={{ background: 'none', border: '1px solid #445257', borderRadius: 2, padding: '6px 12px', color: '#829EA2', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
          Log out
        </button>
      </div>

      {/* Streak banner */}
      {streak > 0 && (
        <div style={{ background:'linear-gradient(135deg, #8B3A52, #ff8c00)', borderRadius:2, padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:32 }}>🔥</span>
          <div>
            <p style={{ fontSize:18, fontWeight:700, color:'#C8D8DC' }}>{streak} day streak!</p>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)' }}>
              {streak === 1 ? "Great start! Come back tomorrow to keep it going." :
               streak < 7  ? "Keep it up! You're building a habit." :
               streak < 30 ? "Impressive! You're on fire 🔥" :
               "Legendary reader! You're unstoppable 🏆"}
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:20 }}>
        <div style={{ background:"#222A2F", borderRadius:2, padding:"12px 8px", textAlign:"center" }}>
          <p style={{ fontSize:14, fontWeight:700, color:"#8B3A52" }}>{Stats.formatTime(readingTime)}</p>
          <p style={{ fontSize:9, color:"#829EA2", marginTop:4 }}>{t.readingTime}</p>
        </div>
        <div style={{ background:"#222A2F", borderRadius:2, padding:"12px 8px", textAlign:"center" }}>
          <p style={{ fontSize:14, fontWeight:700, color:"#8B3A52" }}>{booksRead}</p>
          <p style={{ fontSize:9, color:"#829EA2", marginTop:4 }}>{t.booksRead}</p>
        </div>
        <div style={{ background:"#222A2F", borderRadius:2, padding:"12px 8px", textAlign:"center" }}>
          <p style={{ fontSize:14, fontWeight:700, color:"#8B3A52" }}>{streak > 0 ? `🔥 ${streak}` : '—'}</p>
          <p style={{ fontSize:9, color:"#829EA2", marginTop:4 }}>Day streak</p>
        </div>
        <div onClick={() => { setTempRating(userRating || 5); setShowRatingModal(true); }}
          style={{ background:"#222A2F", borderRadius:2, padding:"12px 8px", textAlign:"center", cursor:'pointer' }}>
          <p style={{ fontSize:14, fontWeight:700, color:"#8B3A52" }}>{userRating > 0 ? `★ ${userRating}` : '—'}</p>
          <p style={{ fontSize:9, color:"#829EA2", marginTop:4 }}>{t.rating}</p>
        </div>
      </div>

      {/* Menu */}
      <div style={{ background: '#222A2F', borderRadius: 2, overflow: 'hidden' }}>
        {menuLabels.map((label, i) => (
          <div key={i} onClick={() => handleMenuClick(i)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', borderBottom: i < menuLabels.length - 1 ? '1px solid #0B0D11' : 'none', cursor: 'pointer' }}>
            <div style={{ width: 34, height: 34, borderRadius: 2, background: '#0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={menuIcons[i]} size={16} color="#8B3A52"/>
            </div>
            <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
            <Icon name="chevron_right" size={16} color="#445257"/>
          </div>
        ))}
      </div>

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#222A2F', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>👋</p>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Log out?</h3>
            <p style={{ fontSize: 13, color: '#829EA2', marginBottom: 20 }}>Your books and progress will be saved.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, padding: 12, borderRadius: 2, border: '1px solid #445257', background: 'transparent', color: '#829EA2', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={async () => { await Auth.logout(); onLogout(); }}
                style={{ flex: 1, padding: 12, borderRadius: 2, border: 'none', background: '#6B2D3A', color: '#C8D8DC', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating modal */}
      {showRatingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#222A2F', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>Rate your experience</h3>
            <p style={{ fontSize: 12, color: '#829EA2', textAlign: 'center', marginBottom: 20 }}>How are you enjoying the app?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setTempRating(star)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, opacity: star <= tempRating ? 1 : 0.25, transition: 'all 0.15s', transform: star <= tempRating ? 'scale(1.1)' : 'scale(1)' }}>★</button>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#8B3A52', fontWeight: 600, marginBottom: 20 }}>
              {['','Poor','Fair','Good','Great','Excellent! ⭐'][tempRating]}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowRatingModal(false)}
                style={{ flex: 1, padding: 11, borderRadius: 2, border: '1px solid #445257', background: 'transparent', color: '#829EA2', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { Stats.setRating(tempRating); setUserRating(tempRating); setShowRatingModal(false); }}
                style={{ flex: 1, padding: 11, borderRadius: 2, border: 'none', background: '#8B3A52', color: '#C8D8DC', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {showFeedback && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'#222A2F', borderBottom:'1px solid #445257' }}>
            <h3 style={{ fontSize:16, fontWeight:600 }}>Send Feedback</h3>
            <button onClick={() => { setShowFeedback(false); setFeedbackSent(false); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#829EA2', fontSize:22 }}>✕</button>
          </div>
          {feedbackSent ? (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0B0D11', padding:32, textAlign:'center' }}>
              <p style={{ fontSize:48, marginBottom:16 }}>🙏</p>
              <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Thanks for your feedback!</h3>
              <p style={{ fontSize:14, color:'#829EA2', marginBottom:28 }}>Your response helps us improve the app.</p>
              <button onClick={() => { setShowFeedback(false); setFeedbackSent(false); }}
                style={{ padding:'12px 28px', borderRadius:2, border:'none', background:'#8B3A52', color:'#C8D8DC', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                Close
              </button>
            </div>
          ) : (
            <iframe
              src="https://tally.so/embed/Medo9g?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
              style={{ flex:1, border:'none', width:'100%', background:'#0B0D11' }}
              title="Feedback"
              onLoad={(e) => {
                try {
                  window.addEventListener('message', function handler(event) {
                    if (event.data?.includes?.('tally') || event.data?.type === 'tally-form-submitted') {
                      setFeedbackSent(true);
                      window.removeEventListener('message', handler);
                    }
                  });
                } catch {}
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ── APP ───────────────────────────────────────────────────
const App = () => {
  const [tab, setTab] = useState("home");
  const [lang, setLang] = useState("en");
  const [readingBook, setReadingBook] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState(() => Auth.getUser());
  const [authLoading, setAuthLoading] = useState(true);
  const t = T[lang];

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    });
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  // Listen to Firebase auth state
  useEffect(() => {
    const unsub = fbAuth.onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        const u = {
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          email: firebaseUser.email,
          uid: firebaseUser.uid,
        };
        Auth.saveUser(u);
        setUser(u);
        await Cloud.fullSync();
        setRefreshKey(k => k + 1);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  if (authLoading) return (
    <div style={{ minHeight:'100vh', background:'#0B0D11', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <span className="spin" style={{ fontSize:32, color:'#8B3A52' }}>⟳</span>
        <p style={{ color:'#829EA2', marginTop:12, fontSize:14 }}>Loading...</p>
      </div>
    </div>
  );

  if (!user) return <AuthScreen onLogin={(u) => setUser(u)} />;

  const NAV = [
  { id:"home",      label:t.home,       icon:"home"      },
  { id:"library",   label:t.myBooks,    icon:"book"      },
  { id:"highlights",label:t.highlights, icon:"bookmark"  },
  { id:"profile",   label:t.profile,    icon:"user"      },
];

  const openBook = book => {
    localStorage.setItem('lastRead', book.name);
    setReadingBook(book);
    setRefreshKey(k => k + 1);
  };

  const closeBook = () => {
    setReadingBook(null);
    setRefreshKey(k => k + 1);
  };

  if (readingBook) return <ReaderScreen book={readingBook} onBack={closeBook} t={t}/>;

  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:"#0B0D11", paddingBottom:72 }}>
      {/* Install banner */}
      {showInstallBanner && (
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'#222A2F', borderBottom:'1px solid #445257', padding:'10px 16px' }}>
          <img src="logo.jpeg" style={{ width:32, height:32, borderRadius:8, objectFit:'cover' }}/>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:12, fontWeight:600, color:'#C8D8DC' }}>Install Ilm Read Books</p>
            <p style={{ fontSize:11, color:'#829EA2' }}>Add to home screen for quick access</p>
          </div>
          <button onClick={handleInstall} style={{ background:'#8B3A52', border:'none', borderRadius:8, padding:'6px 12px', color:'#C8D8DC', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
            Install
          </button>
          <button onClick={() => setShowInstallBanner(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#829EA2', fontSize:18, flexShrink:0 }}>✕</button>
        </div>
      )}
      <div style={{ display:"flex", gap:6, padding:"14px 16px 0", justifyContent:"flex-end" }}>
        {["en"].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ padding:"4px 11px", borderRadius:2, border:"none", cursor:"pointer", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5, background:lang===l?"#8B3A52":"#222A2F", color:lang===l?"#fff":"#829EA2", transition:"all 0.15s" }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ padding:"12px 16px 0" }}>
        {tab==="home" && <HomeScreen t={t} onOpenBook={openBook} onSeeAll={() => setTab('seeall')}/>}
        {tab==="seeall" && <SeeAllScreen t={t} onOpenBook={openBook} onBack={() => setTab('home')}/>}
        {tab==="library" && <LibraryScreen t={t} onOpenBook={openBook} refreshKey={refreshKey}/>}
        {tab==="highlights" && <HighlightsScreen t={t} onOpenBook={openBook}/>}
        {tab==="profile" && <ProfileScreen t={t} user={user} onLogout={() => setUser(null)}/>}
      </div>
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"#0B0D11", backdropFilter:"blur(8px)", borderTop:"1px solid #445257", display:"flex", zIndex:100 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"10px 0 14px", background:"none", border:"none", cursor:"pointer", color:tab===n.id?"#8B3A52":"#829EA2", transition:"color 0.15s", position:"relative" }}>
            <Icon name={n.icon} size={20} color={tab===n.id?"#8B3A52":"#829EA2"}/>
            <span style={{ fontSize:10, fontWeight:tab===n.id?600:400 }}>{n.label}</span>
            {tab===n.id && <div style={{ position:"absolute", bottom:4, width:4, height:4, borderRadius:"50%", background:"#8B3A52" }}/>}
          </button>
        ))}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
