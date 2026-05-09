# 📖 Ilm Read Books

> *A digital sanctuary for readers. Dark, elegant, distraction-free.*

A mobile-first web app for reading free books online — built with a Dark Academia aesthetic and a community-powered library.

---

## ✨ Features

- **70,000+ Free Books** — Browse and read classics from Project Gutenberg
- **Community Library** — Upload and share books with other readers worldwide
- **Upload Your Own** — Import EPUB, PDF, or TXT files from your device
- **Reader Themes** — Dark, sepia, and light modes with adjustable font size
- **Annotations** — Highlight, underline, strikethrough, and leave comments on any text
- **Quotes** — Save your favourite passages and share them as images
- **Reading Stats** — Track your reading time, books finished, and daily streaks
- **Cloud Sync** — Progress and annotations sync across devices via Supabase
- **PWA** — Installable on Android and iOS home screens
- **Genre Browsing** — Discover books by adventure, gothic, philosophy, mystery, and more
- **Multi-language Auth** — Sign in with email/password via Firebase

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (CDN + Babel), vanilla CSS |
| Auth | Firebase Authentication |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Book API | Gutendex (Project Gutenberg) |
| Book Proxy | Vercel Serverless Function |
| Hosting | Vercel |
| PWA | Web App Manifest + Service Worker |

---

## 📁 File Structure

```
├── index.html               # App shell, CDN imports, fonts
├── script.js                # Entire React app (~2500 lines)
├── style.css                # Dark Academia theme, animations
├── manifest.json            # PWA manifest
├── sw.js                    # Service worker for offline caching
├── Dark_Academia_Logo.jpeg  # App logo
├── booklib.jpeg             # Auth screen background
└── api/
    └── fetch-book.js        # Serverless proxy for book downloads
```

---

## 🚀 Deployment

The app is deployed on **Vercel**. The `api/fetch-book.js` file is automatically detected as a serverless function.

### Deploy your own

1. Fork this repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your fork
3. Click **Deploy** — no build settings needed
4. Your app is live at `your-project.vercel.app`

---

## 🗄 Database Setup (Supabase)

The app uses two Supabase features:

**Tables** (`libraries`, `annotations`, `quotes`, `community_books`) — stores reading progress, highlights, and community-uploaded book metadata.

**Storage** (`community-books` bucket) — stores uploaded book files (EPUB, PDF, TXT).

To set up your own instance, create a Supabase project and update the credentials in `script.js`:

```js
const SUPABASE_URL = 'your-project-url';
const SUPABASE_KEY = 'your-anon-key';
```

---

## 🎨 Design

Built around a **Dark Academia / Black Aesthetic** theme:

| Token | Hex | Role |
|---|---|---|
| `#0B0D11` | Near-black | Background |
| `#222A2F` | Dark slate | Cards |
| `#445257` | Steel grey | Borders |
| `#8B3A52` | Deep crimson | Accent |
| `#829EA2` | Dusty blue | Muted text |
| `#C8D8DC` | Cool pale grey | Primary text |

Typography: **Cormorant Garamond** (headers) · **Lora** (UI) · **EB Garamond** (reader)

---

## 📜 License

Free to use, modify, and deploy for personal and educational purposes.

Books sourced from [Project Gutenberg](https://www.gutenberg.org) — all public domain.
