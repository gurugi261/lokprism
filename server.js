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

    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    protocol.get(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let nextUrl = res.headers.location;
        if (!nextUrl.startsWith('http://') && !nextUrl.startsWith('https://')) {
          nextUrl = new URL(nextUrl, url).href;
        }
        return httpsGet(nextUrl, headers).then(resolve).catch(reject);
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
// Helper: Hash code generator for unique image IDs
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// Helper: Scrape Google Images directly as fallback
function scrapeGoogleImages(query, color = '') {
  return new Promise((resolve, reject) => {
    let tbs = '';
    if (color) {
      const colorMap = {
        'Red': 'red',
        'Orange': 'orange',
        'Yellow': 'yellow',
        'Green': 'green',
        'Blue': 'blue',
        'Purple': 'purple'
      };
      const googleColor = colorMap[color];
      if (googleColor) {
        tbs = `&tbs=ic:specific,isc:${googleColor}`;
      }
    }

    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch${tbs}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const imgUrls = [];
          const regex = /"(https?:\/\/[^"]+?\.(?:jpg|jpeg|png|gif|webp))"/g;
          let match;
          while ((match = regex.exec(data)) !== null) {
            const url = match[1];
            if (!url.includes('gstatic.com') && !url.includes('google') && !imgUrls.includes(url)) {
              imgUrls.push(url);
            }
          }

          const tbnUrls = [];
          const tbnRegex = /(https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=tbn:[^"]+)/g;
          while ((match = tbnRegex.exec(data)) !== null) {
            const url = match[1];
            if (!tbnUrls.includes(url)) {
              tbnUrls.push(url);
            }
          }

          const images = [];
          const maxResults = 50;
          for (let i = 0; i < Math.max(imgUrls.length, tbnUrls.length); i++) {
            if (images.length >= maxResults) break;
            const originalUrl = imgUrls[i] || tbnUrls[i];
            const thumbnailUrl = tbnUrls[i] || imgUrls[i];
            if (originalUrl) {
              images.push({
                id: Math.abs(hashCode(originalUrl)),
                title: `${query} 이미지 ${images.length + 1}`,
                url: originalUrl,
                thumbnailUrl: thumbnailUrl,
                source: 'google-scrape'
              });
            }
          }
          resolve(images);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// Helper: Fetch fallback search results when official/scrape fails or is blocked by CAPTCHA
async function getSearchFallback() {
  try {
    const pageNum = Math.floor(Math.random() * 20) + 1;
    const picsumUrl = `https://picsum.photos/v2/list?page=${pageNum}&limit=50`;
    const result = await httpsGet(picsumUrl);
    const photos = JSON.parse(result.data);

    return photos.map(p => ({
      id: parseInt(p.id) || Math.abs(hashCode(p.author)),
      title: `Photo by ${p.author}`,
      url: `https://picsum.photos/id/${p.id}/600/400`,
      thumbnailUrl: `https://picsum.photos/id/${p.id}/300/200`,
      photographer: p.author,
      source: 'picsum-fallback'
    })).slice(0, 50);
  } catch (err) {
    console.error('Picsum fallback fetch error:', err);
    const db = readDB();
    return db.images.slice(0, 50);
  }
}

// ===========================================
// API: Search images from web (Google search)
// ===========================================
app.get('/api/search-web', async (req, res) => {
  const config = loadConfig();
  const apiKey = config.GOOGLE_API_KEY || '';
  const cx = config.GOOGLE_CX || '';
  const { query = '', color = '', page = '1' } = req.query;

  // If no API Key or CX, use the Google Scraper fallback
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || !cx || cx === 'YOUR_CX_HERE') {
    try {
      let images = await scrapeGoogleImages(query, color);
      // If scraper returned nothing (blocked by CAPTCHA), use the high-quality picsum fallback to guarantee 24 stunning images
      if (!images || images.length === 0) {
        images = await getSearchFallback();
      }
      return res.json({ images: images.slice(0, 50), source: 'google-scrape', hasApiKey: false });
    } catch (err) {
      console.error('Google Scraper fallback error:', err);
      const images = await getSearchFallback();
      return res.json({ images: images.slice(0, 50), source: 'picsum-fallback', hasApiKey: false });
    }
  }

  // Use official Google Custom Search JSON API
  try {
    const colorMap = {
      'Red': 'red',
      'Orange': 'orange',
      'Yellow': 'yellow',
      'Green': 'green',
      'Blue': 'blue',
      'Purple': 'purple'
    };
    const googleColor = colorMap[color] || '';
    const startIdx = (parseInt(page) - 1) * 10 + 1;
    let googleUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${cx}&key=${apiKey}&searchType=image&num=10&start=${startIdx}`;
    if (googleColor) {
      googleUrl += `&imgColor=${googleColor}`;
    }

    const result = await httpsGet(googleUrl);
    if (result.statusCode !== 200) {
      console.error('Google API error status:', result.statusCode, result.data);
      let images = await scrapeGoogleImages(query, color);
      if (!images || images.length === 0) {
        images = await getSearchFallback();
      }
      return res.json({ images: images.slice(0, 50), source: 'google-scrape', hasApiKey: false });
    }

    const data = JSON.parse(result.data);
    let images = (data.items || []).map((item, index) => ({
      id: Math.abs(hashCode(item.link)),
      title: item.title,
      url: item.link,
      thumbnailUrl: item.image?.thumbnailLink || item.link,
      source: 'google'
    }));

    if (images.length === 0) {
      images = await getSearchFallback();
    }

    return res.json({
      images: images.slice(0, 50),
      source: 'google',
      hasApiKey: true,
      totalResults: parseInt(data.searchInformation?.totalResults || '0'),
      page: parseInt(page)
    });
  } catch (err) {
    console.error('Google official search error:', err);
    try {
      let images = await scrapeGoogleImages(query, color);
      if (!images || images.length === 0) {
        images = await getSearchFallback();
      }
      return res.json({ images: images.slice(0, 50), source: 'google-scrape', hasApiKey: false });
    } catch (scrapeErr) {
      const images = await getSearchFallback();
      return res.json({ images: images.slice(0, 50), source: 'picsum-fallback', hasApiKey: false });
    }
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

  function fetchWithRedirect(targetUrl, depth = 0) {
    if (depth > 5) {
      return res.status(500).json({ error: 'Too many redirects' });
    }

    try {
      const parsedUrl = new URL(targetUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const proxyReq = protocol.get(targetUrl, (imgRes) => {
        // Follow redirects
        if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
          let nextUrl = imgRes.headers.location;
          if (!nextUrl.startsWith('http://') && !nextUrl.startsWith('https://')) {
            nextUrl = new URL(nextUrl, targetUrl).href;
          }
          fetchWithRedirect(nextUrl, depth + 1);
          return;
        }

        res.set('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        imgRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('Image proxy request error:', err.message);
        res.status(500).json({ error: '이미지 프록시 실패' });
      });
    } catch (err) {
      console.error('Image proxy URL parse error:', err.message);
      res.status(500).json({ error: '잘못된 이미지 URL' });
    }
  }

  fetchWithRedirect(imageUrl);
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

// API: Delete an image
app.delete('/api/images/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const initialLength = db.images.length;
  db.images = db.images.filter(img => img.id !== id);
  db.favorites = db.favorites.filter(favId => favId !== id);
  
  if (db.images.length === initialLength) {
    return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
  }
  writeDB(db);
  res.json({ message: '이미지가 성공적으로 삭제되었습니다.', id });
});

// API: Add/Save a new image
app.post('/api/images', (req, res) => {
  const { title, url, colors, dominantColor } = req.body;
  if (!url || !colors || !dominantColor) {
    return res.status(400).json({ error: '잘못된 이미지 데이터입니다.' });
  }

  const db = readDB();
  const newImage = {
    id: Date.now(),
    title: title || '무제 이미지',
    url,
    colors,
    dominantColor
  };

  db.images.unshift(newImage);
  writeDB(db);
  res.status(201).json(newImage);
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
