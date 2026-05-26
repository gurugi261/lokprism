const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load config (Pexels API key)
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('config.json 로드 실패:', err.message);
  }
  return {};
}

// Helper to read DB
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB, resetting database', err);
    return { images: [], favorites: [], history: [] };
  }
}

// Helper to write DB
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing DB', err);
  }
}

// Helper: HTTPS GET with promise
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: headers
    };

    https.get(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

// ===========================================
// API: Search images from web (Pexels proxy)
// ===========================================
app.get('/api/search-web', async (req, res) => {
  const config = loadConfig();
  const apiKey = config.PEXELS_API_KEY || '';
  const { query = '', color = '', page = '1' } = req.query;

  // Color mapping: HSL group name → Pexels color parameter
  const colorMap = {
    'Red': 'red',
    'Orange': 'orange',
    'Yellow': 'yellow',
    'Green': 'green',
    'Blue': 'blue',
    'Purple': 'violet'
  };

  // If no Pexels API key, use Lorem Picsum as fallback
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    try {
      const pageNum = parseInt(page) || 1;
      const picsumUrl = `https://picsum.photos/v2/list?page=${pageNum}&limit=24`;
      const result = await httpsGet(picsumUrl);
      const photos = JSON.parse(result.data);

      const images = photos.map(p => ({
        id: parseInt(p.id),
        title: `Photo by ${p.author}`,
        url: `https://picsum.photos/id/${p.id}/600/400`,
        thumbnailUrl: `https://picsum.photos/id/${p.id}/300/200`,
        photographer: p.author,
        source: 'picsum',
        avgColor: null // will be analyzed client-side
      }));

      return res.json({ images, source: 'picsum', hasApiKey: false });
    } catch (err) {
      console.error('Picsum API error:', err);
      // Final fallback: return sample images from db
      const db = readDB();
      return res.json({ images: db.images, source: 'local', hasApiKey: false });
    }
  }

  // Use Pexels API
  try {
    const pexelsColor = colorMap[color] || '';
    const searchQuery = query || 'nature landscape';
    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=24&page=${page}${pexelsColor ? '&color=' + pexelsColor : ''}`;

    const result = await httpsGet(pexelsUrl, { 'Authorization': apiKey });

    if (result.statusCode !== 200) {
      console.error('Pexels API error:', result.statusCode, result.data);
      return res.status(result.statusCode).json({ error: 'Pexels API 오류' });
    }

    const data = JSON.parse(result.data);
    const images = data.photos.map(p => ({
      id: p.id,
      title: p.alt || `Photo by ${p.photographer}`,
      url: p.src.medium,
      thumbnailUrl: p.src.small,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      pexelsUrl: p.url,
      avgColor: p.avg_color,
      source: 'pexels'
    }));

    return res.json({
      images,
      source: 'pexels',
      hasApiKey: true,
      totalResults: data.total_results,
      page: data.page,
      perPage: data.per_page
    });
  } catch (err) {
    console.error('Pexels search error:', err);
    return res.status(500).json({ error: '웹 이미지 검색 실패' });
  }
});

// ===========================================
// API: Proxy image for CORS-free Canvas analysis
// ===========================================
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const parsedUrl = new URL(imageUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const proxyReq = protocol.get(imageUrl, (imgRes) => {
      // Follow redirects
      if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
        protocol.get(imgRes.headers.location, (redirectRes) => {
          res.set('Content-Type', redirectRes.headers['content-type'] || 'image/jpeg');
          res.set('Cache-Control', 'public, max-age=86400');
          redirectRes.pipe(res);
        }).on('error', () => res.status(500).end());
        return;
      }

      res.set('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      imgRes.pipe(res);
    });

    proxyReq.on('error', () => {
      res.status(500).json({ error: '이미지 프록시 실패' });
    });
  } catch (err) {
    res.status(500).json({ error: '잘못된 이미지 URL' });
  }
});

// ===========================================
// API: Check if API key is configured
// ===========================================
app.get('/api/config-status', (req, res) => {
  const config = loadConfig();
  const hasKey = !!(config.PEXELS_API_KEY && config.PEXELS_API_KEY !== 'YOUR_API_KEY_HERE');
  res.json({ hasApiKey: hasKey });
});

// ===========================================
// API: Get all saved images (from db.json)
// ===========================================
app.get('/api/images', (req, res) => {
  const db = readDB();
  res.json(db.images);
});

// API: Get favorites
app.get('/api/favorites', (req, res) => {
  const db = readDB();
  res.json(db.favorites);
});

// API: Toggle favorite status of an image
app.post('/api/favorites/toggle', (req, res) => {
  const { imageId } = req.body;
  if (imageId === undefined) {
    return res.status(400).json({ error: 'Missing imageId' });
  }

  const db = readDB();
  const idNum = Number(imageId);
  const index = db.favorites.indexOf(idNum);

  if (index === -1) {
    db.favorites.push(idNum);
  } else {
    db.favorites.splice(index, 1);
  }

  writeDB(db);
  res.json({ favorites: db.favorites });
});

// API: Get search history
app.get('/api/history', (req, res) => {
  const db = readDB();
  res.json(db.history);
});

// API: Add search history
app.post('/api/history', (req, res) => {
  const { colorText, colorValue, mode } = req.body;
  if (!colorValue) {
    return res.status(400).json({ error: 'Missing search values' });
  }

  const db = readDB();
  const newHistory = {
    id: Date.now(),
    colorText,
    colorValue,
    mode,
    timestamp: new Date().toISOString()
  };

  db.history.unshift(newHistory);
  if (db.history.length > 20) {
    db.history = db.history.slice(0, 20);
  }

  writeDB(db);
  res.status(201).json(newHistory);
});

// API: Delete all history
app.delete('/api/history', (req, res) => {
  const db = readDB();
  db.history = [];
  writeDB(db);
  res.json({ message: 'History cleared successfully' });
});

// Fallback to SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ChromaSearch 서버 실행 중: http://localhost:${PORT}`);
  const config = loadConfig();
  if (config.PEXELS_API_KEY && config.PEXELS_API_KEY !== 'YOUR_API_KEY_HERE') {
    console.log('✅ Pexels API 키 감지 — 웹 이미지 검색 활성화');
  } else {
    console.log('ℹ️  Pexels API 키 미설정 — Lorem Picsum 폴백 모드 사용');
    console.log('   키 설정: config.json 파일의 PEXELS_API_KEY를 수정하세요');
  }
});
