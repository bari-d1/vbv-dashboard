# Verse by Verse — Social Media Analytics Dashboard

A full-stack analytics dashboard for the Verse by Verse Christian music content platform.
Pulls real performance data from **Instagram**, **TikTok**, and **YouTube**.

---

## Quick Start

```bash
# 1. Clone / enter project
cd versebyverse/backend

# 2. Install dependencies
npm install

# 3. Copy env template and fill in your tokens
cp .env.example .env

# 4. Start the server
npm start
# → http://localhost:3001
```

The frontend is served by the same Express server — no separate build step needed.

---

## Folder Structure

```
versebyverse/
├── backend/
│   ├── server.js                  # Express entry point
│   ├── package.json
│   ├── .env.example               # Template — copy to .env
│   ├── middleware/
│   │   └── cache.js               # 30-min in-memory response cache
│   └── routes/
│       ├── instagram.js           # GET /api/instagram/insights
│       ├── tiktok.js              # GET /api/tiktok/insights
│       └── youtube.js             # GET /api/youtube/insights
└── frontend/
    ├── index.html                 # SPA shell
    ├── css/
    │   └── styles.css             # Dark-mode, platform-coloured design
    └── js/
        ├── utils.js               # Shared helpers, Chart.js defaults
        ├── app.js                 # Navigation, period switching, routing
        ├── overview.js            # Overview page renderer
        ├── instagram.js           # Instagram page renderer
        ├── tiktok.js              # TikTok page renderer
        └── youtube.js             # YouTube page renderer
```

---

## API Endpoints

| Endpoint | Query param | Returns |
|---|---|---|
| `GET /api/instagram/insights` | `?period=7d\|30d\|90d` | Followers, reach, impressions, content breakdown, top posts, demographics |
| `GET /api/tiktok/insights` | `?period=7d\|30d\|90d` | Followers, views, likes, shares, top videos |
| `GET /api/youtube/insights` | `?period=7d\|30d\|90d` | Subscribers, views, watch time, top videos |
| `GET /api/health` | — | Server status + which platforms are configured |

Responses are cached for 30 minutes (configurable via `CACHE_TTL_SECONDS` in `.env`).

If credentials are missing for a platform, that platform returns **realistic demo data** and marks the response with `"_demo": true` — so the other platforms still load.

---

## Getting Your API Tokens

### Instagram (Meta Graph API)

1. Go to [developers.facebook.com](https://developers.facebook.com) and create an App (type: **Business**).
2. Add the **Instagram Graph API** product.
3. In **Graph API Explorer**, select your app and generate a User Token with scopes:
   `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`
4. Exchange it for a **long-lived token** (lasts 60 days):
   ```
   GET https://graph.facebook.com/v19.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_TOKEN}
   ```
5. Find your Instagram Business Account ID:
   ```
   GET https://graph.facebook.com/v19.0/me/accounts?access_token={TOKEN}
   # Then for the page:
   GET https://graph.facebook.com/v19.0/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}
   ```
6. Set in `.env`:
   ```
   INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
   INSTAGRAM_BUSINESS_ACCOUNT_ID=your_ig_business_id
   ```

---

### TikTok (Display API)

1. Apply for access at [developers.tiktok.com](https://developers.tiktok.com).
2. Create an app and enable **Login Kit** + **Content Posting API**.
3. Complete OAuth flow to get an access token with scopes: `user.info.basic`, `video.list`.
4. Set in `.env`:
   ```
   TIKTOK_ACCESS_TOKEN=your_tiktok_access_token
   ```

> **Note:** TikTok's API requires business/creator accounts and app review. Use demo mode while waiting for approval.

---

### YouTube (Data API v3)

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a project → **APIs & Services → Enable APIs → YouTube Data API v3**.
3. Create credentials: **API Key** (for public channel data).
4. Find your Channel ID: YouTube Studio → **Settings → Channel → Advanced settings**.
5. Set in `.env`:
   ```
   YOUTUBE_API_KEY=AIza...
   YOUTUBE_CHANNEL_ID=UCxxxxxxxx
   ```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | For live IG data | Long-lived Meta Graph API token |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | For live IG data | Numeric IG Business account ID |
| `TIKTOK_ACCESS_TOKEN` | For live TT data | TikTok OAuth access token |
| `YOUTUBE_API_KEY` | For live YT data | Google Cloud API key |
| `YOUTUBE_CHANNEL_ID` | For live YT data | YouTube channel ID (UC...) |
| `PORT` | No (default: 3001) | Server port |
| `CACHE_TTL_SECONDS` | No (default: 1800) | Cache duration in seconds |
