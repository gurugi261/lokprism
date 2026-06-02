// State Variables
let currentMode = 'single'; // 'single' or 'multi'
let selectedHue = 0; // for single mode
let selectedSat = 100;
let selectedLight = 59;
let multiColors = []; // array of { id, hue, sat, light, name, weight }
let allImages = [];
let webSearchResults = null; // null if showing local images, array if showing web search results
let favoriteIds = [];
let searchHistory = [];
let activeTab = 'explore';
let currentUser = null;

// HSL Color Categories definitions
const HSL_GROUPS = [
  { name: 'Red', label: '빨강', range: [[0, 20], [320, 360]], color: '#FF3B30' },
  { name: 'Orange', label: '주황', range: [[20, 50]], color: '#FF9500' },
  { name: 'Yellow', label: '노랑', range: [[50, 70]], color: '#FFCC00' },
  { name: 'Green', label: '초록', range: [[70, 160]], color: '#34C759' },
  { name: 'Blue', label: '파랑', range: [[160, 260]], color: '#007AFF' },
  { name: 'Purple', label: '보라', range: [[260, 320]], color: '#AF52DE' }
];

// Hex to RGB converter helper
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// HSL to RGB converter helper
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

// RGB to HSL converter helper
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// Get HSL Category name based on Hue value
function getHslCategoryName(h, s, l) {
  // If saturation is extremely low or lightness is too dark/bright, it's neutral/grayscale
  if (s < 12 || l < 10 || l > 93) {
    return 'Neutral'; // Grayscale
  }

  for (const group of HSL_GROUPS) {
    for (const r of group.range) {
      if (h >= r[0] && h <= r[1]) {
        return group.name;
      }
    }
  }
  return 'Red'; // fallback
}

// Calculate hex code from HSL
function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  const toHex = x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Initialize Application UI
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadSession();
  fetchImages();
  fetchHistory();
});

// Load user login session if stored
function loadSession() {
  const storedUser = localStorage.getItem('chroma_user');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    applyLoginState(currentUser);
  }
}

// Fetch images from API
async function fetchImages() {
  try {
    const res = await fetch('/api/images');
    allImages = await res.json();
    fetchFavorites();
  } catch (err) {
    console.error('Error fetching images:', err);
  }
}

// Fetch favorites list
async function fetchFavorites() {
  if (!currentUser) {
    favoriteIds = [];
    renderGallery();
    return;
  }
  try {
    const res = await fetch('/api/favorites');
    favoriteIds = await res.json();
    renderGallery();
  } catch (err) {
    console.error('Error fetching favorites:', err);
    renderGallery();
  }
}

// Fetch search history
async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    searchHistory = await res.json();
    renderHistory();
  } catch (err) {
    console.error('Error fetching history:', err);
  }
}

// Setup Dom Listeners
function setupEventListeners() {
  // Login flow
  document.getElementById('btnLogin').addEventListener('click', handleMockLogin);
  document.getElementById('btnGithubLogin').addEventListener('click', () => handleMockSocialLogin('GitHub'));
  document.getElementById('btnGoogleLogin').addEventListener('click', () => handleMockSocialLogin('Google'));
  document.getElementById('btnGuest').addEventListener('click', handleGuestEntry);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

  // Tab navigation
  document.getElementById('tabExplore').addEventListener('click', () => switchTab('explore'));
  document.getElementById('tabFavorites').addEventListener('click', () => switchTab('favorites'));

  // Search mode switcher
  document.getElementById('modeSingle').addEventListener('click', () => setMode('single'));
  document.getElementById('modeMulti').addEventListener('click', () => setMode('multi'));

  // Color picker sliders
  const slideHue = document.getElementById('slideHue');
  const slideSat = document.getElementById('slideSat');
  const slideLight = document.getElementById('slideLight');

  const updateColorFromSliders = () => {
    selectedHue = parseInt(slideHue.value);
    selectedSat = parseInt(slideSat.value);
    selectedLight = parseInt(slideLight.value);

    document.getElementById('lblHue').innerText = `${selectedHue}°`;
    document.getElementById('lblSat').innerText = `${selectedSat}%`;
    document.getElementById('lblLight').innerText = `${selectedLight}%`;

    const hex = hslToHex(selectedHue, selectedSat, selectedLight);
    const rgbStr = `rgb(${Object.values(hslToRgb(selectedHue, selectedSat, selectedLight)).join(', ')})`;
    const hslStr = `hsl(${selectedHue}, ${selectedSat}%, ${selectedLight}%)`;

    document.getElementById('colorPreview').style.backgroundColor = hex;
    document.getElementById('valHex').innerText = hex;
    document.getElementById('valRgb').innerText = rgbStr;
    document.getElementById('valHsl').innerText = hslStr;

    // Reset presets selection unless it matches
    document.querySelectorAll('.preset-btn').forEach(btn => {
      if (parseInt(btn.dataset.hue) === selectedHue) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  };

  slideHue.addEventListener('input', updateColorFromSliders);
  slideSat.addEventListener('input', updateColorFromSliders);
  slideLight.addEventListener('input', updateColorFromSliders);

  // Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hue = parseInt(e.target.dataset.hue);
      slideHue.value = hue;
      slideSat.value = 100;
      slideLight.value = 50;
      updateColorFromSliders();
    });
  });

  // Add Color to weights (multi-color)
  document.getElementById('btnAddColor').addEventListener('click', addColorToMulti);

  // Search Action
  document.getElementById('btnSearch').addEventListener('click', triggerSearch);
  document.getElementById('btnResetSearch').addEventListener('click', resetSearch);
  document.getElementById('btnClearHistory').addEventListener('click', clearHistory);

  // Upload Box Toggle
  document.getElementById('btnTriggerUpload').addEventListener('click', toggleUploadPanel);

  // Drag and Drop
  const dropzone = document.getElementById('dropzone');
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageSelection(files[0]);
    }
  });

  dropzone.addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageSelection(e.target.files[0]);
    }
  });

  document.getElementById('btnCancelUpload').addEventListener('click', cancelUpload);
  document.getElementById('btnSaveUpload').addEventListener('click', saveUploadedImage);

  // Sorting
  document.getElementById('sortSelect').addEventListener('change', () => {
    renderGallery();
  });

  // Modal close
  document.getElementById('btnDetailClose').addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('active');
  });
  document.getElementById('btnDetailFav').addEventListener('click', toggleDetailFavorite);
}

// Apply logged-in UI state
function applyLoginState(user) {
  currentUser = user;
  document.getElementById('loginOverlay').classList.remove('active');
  document.getElementById('appContainer').classList.remove('hidden');
  
  document.getElementById('userName').innerText = user.name;
  document.getElementById('userRole').innerText = user.email || 'Registered User';
  document.getElementById('userAvatar').src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.name}`;
  
  fetchFavorites();
}

// Login handlers
function handleMockLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) return alert('이메일을 입력해주세요.');
  
  const name = email.split('@')[0];
  const user = { name: name.charAt(0).toUpperCase() + name.slice(1), email };
  localStorage.setItem('chroma_user', JSON.stringify(user));
  applyLoginState(user);
}

function handleMockSocialLogin(platform) {
  const user = { name: `${platform} User`, email: `auth_${platform.toLowerCase()}@chroma.com` };
  localStorage.setItem('chroma_user', JSON.stringify(user));
  applyLoginState(user);
}

function handleGuestEntry() {
  const user = { name: '게스트', email: 'guest@chroma.com', isGuest: true };
  applyLoginState(user);
}

function handleLogout() {
  localStorage.removeItem('chroma_user');
  currentUser = null;
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('loginOverlay').classList.add('active');
}

// Tab navigation handler
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tabExplore').classList.toggle('active', tab === 'explore');
  document.getElementById('tabFavorites').classList.toggle('active', tab === 'favorites');
  
  document.getElementById('galleryTitle').innerText = tab === 'explore' ? '모든 이미지' : '즐겨찾기 목록';
  renderGallery();
}

// Mode Selector
function setMode(mode) {
  currentMode = mode;
  document.getElementById('modeSingle').classList.toggle('active', mode === 'single');
  document.getElementById('modeMulti').classList.toggle('active', mode === 'multi');

  const btnAddColor = document.getElementById('btnAddColor');
  const multiColorsSection = document.getElementById('multiColorsSection');

  if (mode === 'single') {
    btnAddColor.classList.add('hidden');
    multiColorsSection.classList.add('hidden');
  } else {
    btnAddColor.classList.remove('hidden');
    multiColorsSection.classList.remove('hidden');
    renderMultiColors();
  }
}

// Add a color to the multi-color list
function addColorToMulti() {
  // Find current color name based on hue
  let colorName = '빨강';
  for (const group of HSL_GROUPS) {
    for (const r of group.range) {
      if (selectedHue >= r[0] && selectedHue <= r[1]) {
        colorName = group.label;
      }
    }
  }

  // Prevent duplicate hues within 20 degrees for weights
  const isDuplicate = multiColors.some(c => Math.abs(c.hue - selectedHue) < 15);
  if (isDuplicate) {
    alert('이미 비슷한 색상이 리스트에 포함되어 있습니다.');
    return;
  }

  if (multiColors.length >= 5) {
    alert('최대 5개의 색상까지만 동시에 지정할 수 있습니다.');
    return;
  }

  // Add color
  const weight = 30; // default 30%
  multiColors.push({
    id: Date.now(),
    hue: selectedHue,
    sat: selectedSat,
    light: selectedLight,
    hex: hslToHex(selectedHue, selectedSat, selectedLight),
    name: colorName,
    weight
  });

  renderMultiColors();
}

// Render selected multi colors chips and sliders
function renderMultiColors() {
  const container = document.getElementById('multiColorsList');
  container.innerHTML = '';
  
  let totalWeight = 0;

  multiColors.forEach((color, index) => {
    totalWeight += color.weight;
    
    const row = document.createElement('div');
    row.className = 'multi-color-row';
    row.innerHTML = `
      <div class="multi-color-header">
        <div class="multi-color-info">
          <span class="color-dot" style="background-color: ${color.hex};"></span>
          <span>${color.name} (${color.hex})</span>
        </div>
        <button class="btn-remove-color" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="weight-slider-group">
        <input type="range" min="5" max="100" value="${color.weight}" data-index="${index}">
        <span class="weight-val">${color.weight}%</span>
      </div>
    `;
    
    // remove listener
    row.querySelector('.btn-remove-color').addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      multiColors.splice(idx, 1);
      renderMultiColors();
    });

    // weight slider listener
    row.querySelector('input[type="range"]').addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      const val = parseInt(e.target.value);
      multiColors[idx].weight = val;
      renderMultiColors();
    });

    container.appendChild(row);
  });

  document.getElementById('lblTotalWeight').innerText = `${totalWeight}%`;
}

// Trigger Color Search
async function triggerSearch() {
  const keywordInput = document.getElementById('webSearchKeyword');
  let query = keywordInput.value.trim();

  // If keyword is empty, construct a query based on selected color(s) to fetch from Google
  if (!query) {
    if (currentMode === 'single') {
      let label = '빨강';
      for (const group of HSL_GROUPS) {
        for (const r of group.range) {
          if (selectedHue >= r[0] && selectedHue <= r[1]) {
            label = group.label;
          }
        }
      }
      query = `${label}색`;
    } else {
      if (multiColors.length > 0) {
        query = multiColors.map(c => `${c.name}색`).join(' ');
      } else {
        query = '알록달록한 색상';
      }
    }
  }

  // Show search status bar
  const statusBar = document.getElementById('searchStatusBar');
  const statusText = document.getElementById('searchStatusText');
  const analysisProgress = document.getElementById('searchAnalysisProgress');
  const progressBar = document.getElementById('analysisProgressBar');
  const progressText = document.getElementById('analysisProgressText');

  statusBar.classList.remove('hidden');
  analysisProgress.classList.add('hidden');
  statusText.innerText = 'Google에서 이미지를 검색하는 중...';

  // Determine color query parameter if single color selected
  let colorParam = '';
  if (currentMode === 'single') {
    for (const group of HSL_GROUPS) {
      for (const r of group.range) {
        if (selectedHue >= r[0] && selectedHue <= r[1]) {
          colorParam = group.name;
        }
      }
    }
  }

  try {
    const res = await fetch(`/api/search-web?query=${encodeURIComponent(query)}&color=${colorParam}`);
    if (!res.ok) throw new Error('Search failed');
    
    const searchData = await res.json();
    const searchImages = searchData.images || [];

    if (searchImages.length === 0) {
      statusText.innerText = '검색 결과가 없습니다.';
      setTimeout(() => statusBar.classList.add('hidden'), 3000);
      webSearchResults = [];
      renderGallery();
      return;
    }

    // Dynamic color analysis for Google search results
    statusText.innerText = '이미지 다운로드 및 색상 분석 중...';
    analysisProgress.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.innerText = `색상 분석 중: 0/${searchImages.length}`;

    const analyzedImages = [];
    let completedCount = 0;

    for (const img of searchImages) {
      try {
        const imgEl = new Image();
        imgEl.crossOrigin = 'Anonymous';
        
        await new Promise((resolve) => {
          imgEl.onload = () => {
            try {
              const { colors, dominantColor } = getColorsFromImageElement(imgEl);
              analyzedImages.push({
                id: img.id,
                title: img.title || `${query} 이미지`,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                colors,
                dominantColor,
                source: img.source
              });
            } catch (err) {
              console.error('Failed to parse colors of search image:', err);
            }
            resolve();
          };
          imgEl.onerror = () => {
            resolve(); // proceed even if one image fails to load
          };
          imgEl.src = `/api/proxy-image?url=${encodeURIComponent(img.url)}`;
        });
      } catch (err) {
        console.error('Failed to process search result image:', img.url, err);
      }

      completedCount++;
      const percent = Math.round((completedCount / searchImages.length) * 100);
      progressBar.style.width = `${percent}%`;
      progressText.innerText = `색상 분석 중: ${completedCount}/${searchImages.length}`;
    }

    webSearchResults = analyzedImages;
    statusBar.classList.add('hidden');
    
    // Save history
    await saveHistory(query);
    renderGallery();
  } catch (err) {
    console.error('Web search error:', err);
    statusText.innerText = '이미지 검색 중 오류가 발생했습니다.';
    setTimeout(() => statusBar.classList.add('hidden'), 3000);
  }
}

// Save Search History
async function saveHistory(query) {
  let colorValueText = '';
  let colorValueVal = '';

  if (currentMode === 'single') {
    let label = '빨강';
    for (const group of HSL_GROUPS) {
      for (const r of group.range) {
        if (selectedHue >= r[0] && selectedHue <= r[1]) {
          label = group.label;
        }
      }
    }
    colorValueText = `${query ? query + ' + ' : ''}${label} 계열`;
    colorValueVal = hslToHex(selectedHue, selectedSat, selectedLight);
  } else {
    colorValueText = `${query ? query + ' + ' : ''}` + multiColors.map(c => `${c.name} ${c.weight}%`).join(', ');
    colorValueVal = multiColors.map(c => `${c.hex}_${c.weight}`).join('|');
  }

  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colorText: colorValueText,
        colorValue: colorValueVal,
        mode: currentMode
      })
    });
    fetchHistory();
  } catch (err) {
    console.error('Error saving history:', err);
  }
}

// Reset Search params
function resetSearch() {
  selectedHue = 0;
  selectedSat = 100;
  selectedLight = 59;
  
  const slideHue = document.getElementById('slideHue');
  const slideSat = document.getElementById('slideSat');
  const slideLight = document.getElementById('slideLight');

  slideHue.value = 0;
  slideSat.value = 100;
  slideLight.value = 59;

  // trigger input events manually
  slideHue.dispatchEvent(new Event('input'));
  
  document.getElementById('webSearchKeyword').value = '';
  webSearchResults = null;
  
  multiColors = [];
  renderMultiColors();
  renderGallery();
}

// Clear Search History
async function clearHistory() {
  if (!confirm('최근 검색 기록을 모두 비우시겠습니까?')) return;
  try {
    await fetch('/api/history', { method: 'DELETE' });
    fetchHistory();
  } catch (err) {
    console.error('Error clearing history:', err);
  }
}

// Render search history list
function renderHistory() {
  const container = document.getElementById('historyList');
  container.innerHTML = '';

  if (searchHistory.length === 0) {
    container.innerHTML = '<li class="color-val-label" style="text-align:center; padding: 10px;">기록이 없습니다.</li>';
    return;
  }

  searchHistory.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    
    // Draw small color indicators
    let colorIndicatorsHtml = '';
    if (item.mode === 'single') {
      colorIndicatorsHtml = `<span class="history-color-indicator" style="background-color: ${item.colorValue};"></span>`;
    } else {
      const colors = item.colorValue.split('|').map(c => c.split('_')[0]);
      colorIndicatorsHtml = `
        <div style="display: flex; gap: 2px;">
          ${colors.slice(0, 3).map(c => `<span class="history-color-indicator" style="background-color: ${c}; width: 10px; height: 10px;"></span>`).join('')}
        </div>
      `;
    }

    li.innerHTML = `
      ${colorIndicatorsHtml}
      <span class="history-text" title="${item.colorText}">${item.colorText}</span>
      <span class="history-mode-tag">${item.mode === 'single' ? '단일' : '다중'}</span>
    `;

    li.addEventListener('click', () => {
      restoreSearchFromHistory(item);
    });

    container.appendChild(li);
  });
}

// Restore search parameters when history item clicked
function restoreSearchFromHistory(historyItem) {
  setMode(historyItem.mode);
  
  if (historyItem.mode === 'single') {
    // Convert hex back to HSL to set sliders
    const rgb = hexToRgb(historyItem.colorValue);
    if (rgb) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      document.getElementById('slideHue').value = hsl.h;
      document.getElementById('slideSat').value = hsl.s;
      document.getElementById('slideLight').value = hsl.l;
      document.getElementById('slideHue').dispatchEvent(new Event('input'));
    }
  } else {
    // Parse weight strings e.g. "#FF0000_30|#00FF00_40"
    multiColors = [];
    const colorSpecs = historyItem.colorValue.split('|');
    colorSpecs.forEach(spec => {
      const [hex, weight] = spec.split('_');
      const rgb = hexToRgb(hex);
      if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        let colorName = '기타';
        for (const group of HSL_GROUPS) {
          for (const r of group.range) {
            if (hsl.h >= r[0] && hsl.h <= r[1]) {
              colorName = group.label;
            }
          }
        }
        multiColors.push({
          id: Date.now() + Math.random(),
          hue: hsl.h,
          sat: hsl.s,
          light: hsl.l,
          hex: hex,
          name: colorName,
          weight: parseInt(weight)
        });
      }
    });
    renderMultiColors();
  }
  
  renderGallery();
}

// Calculate similarity of an image colors to selected color filters
function calculateSimilarity(image) {
  if (currentMode === 'single') {
    // Similarity is based on the selected Hue Group percentage in the image
    let selectedGroup = HSL_GROUPS[0].name;
    for (const group of HSL_GROUPS) {
      for (const r of group.range) {
        if (selectedHue >= r[0] && selectedHue <= r[1]) {
          selectedGroup = group.name;
        }
      }
    }
    // Return proportion directly (0-100)
    return image.colors[selectedGroup] || 0;
  } else {
    // Multi-color similarity using Euclidean Distance
    // Compare selected weights to image percentages
    if (multiColors.length === 0) return 100;
    
    let sumSquaredDiff = 0;
    
    // Check match for each primary color category
    HSL_GROUPS.forEach(group => {
      // Find what percentage the user requested for this group
      let userWeightForGroup = 0;
      multiColors.forEach(c => {
        let belongsToGroup = false;
        for (const r of group.range) {
          if (c.hue >= r[0] && c.hue <= r[1]) belongsToGroup = true;
        }
        if (belongsToGroup) {
          userWeightForGroup += c.weight;
        }
      });

      const imagePercentForGroup = image.colors[group.name] || 0;
      const diff = userWeightForGroup - imagePercentForGroup;
      sumSquaredDiff += diff * diff;
    });

    const distance = Math.sqrt(sumSquaredDiff);
    // Normalized similarity score: 100 - distance (with a scaling factor to make it feel responsive)
    const score = Math.max(0, 100 - (distance * 0.8));
    return Math.round(score);
  }
}

// Render gallery images with color percentages and similarities
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';
  
  // Filter by activeTab (favorites vs all)
  let list = allImages;
  if (activeTab === 'explore') {
    list = webSearchResults !== null ? webSearchResults : allImages;
  } else if (activeTab === 'favorites') {
    list = allImages.filter(img => favoriteIds.includes(img.id));
  }

  // Calculate similarity scores for all images
  const listWithScores = list.map(img => ({
    ...img,
    similarity: calculateSimilarity(img)
  }));

  // Sort images
  const sortVal = document.getElementById('sortSelect').value;
  if (sortVal === 'match') {
    // Highest match score first
    listWithScores.sort((a, b) => b.similarity - a.similarity);
  } else if (sortVal === 'recent') {
    // Newest ID first
    listWithScores.sort((a, b) => b.id - a.id);
  }

  document.getElementById('galleryCount').innerText = `${listWithScores.length}개`;

  if (listWithScores.length === 0) {
    document.getElementById('noResults').classList.remove('hidden');
    return;
  } else {
    document.getElementById('noResults').classList.add('hidden');
  }

  listWithScores.forEach(img => {
    const card = document.createElement('div');
    card.className = 'img-card';
    
    // Create color composite bar HTML
    let compositeBarHtml = '';
    HSL_GROUPS.forEach(g => {
      const pct = img.colors[g.name] || 0;
      if (pct > 0) {
        compositeBarHtml += `<div style="background-color: ${g.color}; width: ${pct}%; height: 100%;" title="${g.label}: ${pct}%"></div>`;
      }
    });

    const isFav = favoriteIds.includes(img.id);

    card.innerHTML = `
      <div class="img-wrapper">
        <img src="${img.url}" alt="${img.title}" loading="lazy">
        <div class="card-overlay-top">
          <span class="match-badge">${img.similarity}% Match</span>
          <button class="btn-card-fav ${isFav ? 'active' : ''}" data-id="${img.id}">
            <i class="fa-solid fa-heart"></i>
          </button>
        </div>
      </div>
      <div class="card-info">
        <h4 class="card-title">${img.title}</h4>
        <div class="card-color-bar">
          ${compositeBarHtml}
        </div>
      </div>
    `;

    // Favorites click
    card.querySelector('.btn-card-fav').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentUser?.isGuest) {
        alert('즐겨찾기 기능을 이용하려면 회원 로그인이 필요합니다.');
        return;
      }
      const imgId = parseInt(e.currentTarget.dataset.id);
      toggleFavorite(imgId);
    });

    // Detail view click
    card.addEventListener('click', () => {
      openDetailModal(img);
    });

    grid.appendChild(card);
  });
}

// Toggle favorite state of an image (auto-saves web search results to local database)
async function toggleFavorite(imageId) {
  const image = allImages.find(img => img.id === imageId) || (webSearchResults && webSearchResults.find(img => img.id === imageId));
  if (!image) return;

  let finalId = imageId;
  const isSavedLocally = allImages.some(img => img.url === image.url);

  if (!isSavedLocally) {
    try {
      const saveRes = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: image.title,
          url: image.url,
          colors: image.colors,
          dominantColor: image.dominantColor
        })
      });
      if (saveRes.ok) {
        const savedImg = await saveRes.json();
        allImages.unshift(savedImg); // add to top
        finalId = savedImg.id;
        if (webSearchResults) {
          const webImg = webSearchResults.find(img => img.url === image.url);
          if (webImg) webImg.id = savedImg.id;
        }
      } else {
        alert('즐겨찾기 추가를 위한 이미지 저장 실패');
        return;
      }
    } catch (err) {
      console.error('Error auto-saving web search image:', err);
      alert('서버 오류로 즐겨찾기에 추가할 수 없습니다.');
      return;
    }
  } else {
    const localImg = allImages.find(img => img.url === image.url);
    if (localImg) {
      finalId = localImg.id;
    }
  }

  try {
    const res = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId: finalId })
    });
    const data = await res.json();
    favoriteIds = data.favorites;
    
    // Refresh UI
    renderGallery();
    
    // Update modal button if open
    const modalFavBtn = document.getElementById('btnDetailFav');
    const isFavNow = favoriteIds.includes(finalId);
    modalFavBtn.classList.toggle('active', isFavNow);
    modalFavBtn.querySelector('span').innerText = isFavNow ? '즐겨찾기 해제' : '즐겨찾기 추가';
    modalFavBtn.dataset.id = finalId;
  } catch (err) {
    console.error('Error toggling favorite:', err);
  }
}

// Open detailed modal for an image
function openDetailModal(image) {
  const modal = document.getElementById('detailModal');
  
  document.getElementById('detailImage').src = image.url;
  document.getElementById('detailTitle').innerText = image.title;
  document.getElementById('detailDominantHex').innerText = image.dominantColor;
  document.getElementById('detailDominantTag').style.setProperty('--dom-color', image.dominantColor);
  
  // Set Favorite button state
  const isFav = favoriteIds.includes(image.id);
  const favBtn = document.getElementById('btnDetailFav');
  favBtn.classList.toggle('active', isFav);
  favBtn.querySelector('span').innerText = isFav ? '즐겨찾기 해제' : '즐겨찾기 추가';
  // Keep image id on button datasets
  favBtn.dataset.id = image.id;

  // Set HSL bar charts in details
  const statsList = document.getElementById('detailColorStatsList');
  statsList.innerHTML = '';

  // Get total classified percentage
  let classifiedTotal = 0;
  HSL_GROUPS.forEach(g => {
    classifiedTotal += (image.colors[g.name] || 0);
  });
  
  // Handle neutral/grayscale
  const neutralPct = Math.max(0, 100 - classifiedTotal);

  HSL_GROUPS.forEach(g => {
    const pct = image.colors[g.name] || 0;
    const row = document.createElement('div');
    row.className = 'detail-stat-row';
    row.innerHTML = `
      <span class="detail-stat-label">${g.label}</span>
      <div class="detail-stat-bar-container">
        <div class="detail-stat-bar" style="background-color: ${g.color}; width: 0%;"></div>
      </div>
      <span class="detail-stat-percentage">${pct}%</span>
    `;
    statsList.appendChild(row);
    
    // Animate width expansion
    setTimeout(() => {
      row.querySelector('.detail-stat-bar').style.width = `${pct}%`;
    }, 100);
  });

  // Add Grayscale/Neutral row if relevant
  const rowNeutral = document.createElement('div');
  rowNeutral.className = 'detail-stat-row';
  rowNeutral.innerHTML = `
    <span class="detail-stat-label">무채색</span>
    <div class="detail-stat-bar-container">
      <div class="detail-stat-bar" style="background-color: #888888; width: 0%;"></div>
    </div>
    <span class="detail-stat-percentage">${neutralPct}%</span>
  `;
  statsList.appendChild(rowNeutral);
  setTimeout(() => {
    rowNeutral.querySelector('.detail-stat-bar').style.width = `${neutralPct}%`;
  }, 100);

  // Dominant palette extraction - simulate extracting color palette chips
  const paletteList = document.getElementById('detailPaletteList');
  paletteList.innerHTML = '';
  
  // Generate a mock harmonic palette based on dominant color
  const baseRgb = hexToRgb(image.dominantColor) || { r: 128, g: 128, b: 128 };
  const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
  
  const mockPalette = [
    image.dominantColor,
    hslToHex((baseHsl.h + 30) % 360, Math.max(20, baseHsl.s - 20), Math.min(80, baseHsl.l + 10)),
    hslToHex((baseHsl.h + 180) % 360, baseHsl.s, baseHsl.l),
    hslToHex(baseHsl.h, Math.max(0, baseHsl.s - 50), Math.min(90, baseHsl.l + 20)),
    hslToHex(baseHsl.h, baseHsl.s, Math.max(15, baseHsl.l - 25))
  ];

  mockPalette.forEach(hex => {
    const chip = document.createElement('div');
    chip.className = 'palette-chip';
    chip.innerHTML = `
      <div class="palette-color" style="background-color: ${hex};" title="클릭해서 복사"></div>
      <span class="palette-hex">${hex}</span>
    `;

    chip.addEventListener('click', () => {
      navigator.clipboard.writeText(hex);
      alert(`색상 코드 ${hex}가 클립보드에 복사되었습니다!`);
    });

    paletteList.appendChild(chip);
  });

  modal.classList.add('active');
}

// Favorite button handler inside detailed view modal
function toggleDetailFavorite(e) {
  const imgId = parseInt(e.currentTarget.dataset.id);
  if (currentUser?.isGuest) {
    alert('즐겨찾기 기능을 이용하려면 회원 로그인이 필요합니다.');
    return;
  }
  toggleFavorite(imgId);
}

// Toggle upload sliding panel
function toggleUploadPanel() {
  const panel = document.getElementById('uploadContainer');
  panel.classList.toggle('hidden');
}

// Cancel image upload flow
function cancelUpload() {
  document.getElementById('dropzone').classList.remove('hidden');
  document.getElementById('analysisPreview').classList.add('hidden');
  document.getElementById('imgToAnalyze').src = '';
  document.getElementById('uploadTitle').value = '';
  document.getElementById('btnSaveUpload').disabled = true;
  toggleUploadPanel();
}

// Read selected image and analyze colors
let analyzedColorData = null;
let analyzedDominantHex = '#000000';
let uploadImageUrl = '';

function handleImageSelection(file) {
  if (!file.type.match('image.*')) {
    alert('이미지 파일만 업로드할 수 있습니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const imgUrl = e.target.result;
    document.getElementById('dropzone').classList.add('hidden');
    const previewArea = document.getElementById('analysisPreview');
    previewArea.classList.remove('hidden');
    
    const imgElement = document.getElementById('imgToAnalyze');
    imgElement.src = imgUrl;
    uploadImageUrl = imgUrl;

    // Show loading spinner during canvas processing
    const loadingEl = previewArea.querySelector('.loading-spinner');
    const chartEl = document.getElementById('analysisBarChart');
    loadingEl.classList.remove('hidden');
    chartEl.innerHTML = '';
    chartEl.classList.add('hidden');
    
    // Analyze using Canvas API after image loads
    imgElement.onload = () => {
      analyzeImageColors(imgElement);
    };
  };
  reader.readAsDataURL(file);
}

// Reusable image analysis helper using Canvas API
function getColorsFromImageElement(imgElement) {
  const canvas = document.getElementById('analysisCanvas');
  const ctx = canvas.getContext('2d');

  const targetSize = 100;
  canvas.width = targetSize;
  canvas.height = targetSize;

  ctx.drawImage(imgElement, 0, 0, targetSize, targetSize);

  const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
  const pixels = imgData.data;
  
  const counts = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Blue: 0, Purple: 0, Neutral: 0 };
  let totalPixels = 0;
  let rSum = 0, gSum = 0, bSum = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i+1];
    const b = pixels[i+2];
    const a = pixels[i+3];

    if (a < 128) continue; // Skip semi-transparent pixels

    totalPixels++;
    rSum += r;
    gSum += g;
    bSum += b;

    const hsl = rgbToHsl(r, g, b);
    const category = getHslCategoryName(hsl.h, hsl.s, hsl.l);
    counts[category]++;
  }

  const percentages = {};
  let classifiedTotal = 0;
  
  HSL_GROUPS.forEach(g => {
    const pct = totalPixels > 0 ? Math.round((counts[g.name] || 0) / totalPixels * 100) : 0;
    percentages[g.name] = pct;
    classifiedTotal += pct;
  });

  const avgR = totalPixels > 0 ? Math.round(rSum / totalPixels) : 0;
  const avgG = totalPixels > 0 ? Math.round(gSum / totalPixels) : 0;
  const avgB = totalPixels > 0 ? Math.round(bSum / totalPixels) : 0;
  
  const toHex = x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  const dominantColor = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`.toUpperCase();

  return { colors: percentages, dominantColor };
}

// Image analysis using Canvas API
function analyzeImageColors(imgElement) {
  const { colors, dominantColor } = getColorsFromImageElement(imgElement);
  analyzedDominantHex = dominantColor;
  analyzedColorData = colors;

  // Render dynamic bar chart preview
  const chartEl = document.getElementById('analysisBarChart');
  chartEl.innerHTML = '';
  
  HSL_GROUPS.forEach(g => {
    const pct = colors[g.name] || 0;
    if (pct > 0) {
      const seg = document.createElement('div');
      seg.className = 'chart-segment';
      seg.style.backgroundColor = g.color;
      seg.style.width = `${pct}%`;
      seg.setAttribute('data-label', `${g.label}: ${pct}%`);
      chartEl.appendChild(seg);
    }
  });

  // Handle neutral
  let classifiedTotal = 0;
  HSL_GROUPS.forEach(g => {
    classifiedTotal += (colors[g.name] || 0);
  });
  const neutralPct = Math.max(0, 100 - classifiedTotal);
  if (neutralPct > 0) {
    const seg = document.createElement('div');
    seg.className = 'chart-segment';
    seg.style.backgroundColor = '#888888';
    seg.style.width = `${neutralPct}%`;
    seg.setAttribute('data-label', `무채색: ${neutralPct}%`);
    chartEl.appendChild(seg);
  }

  // Done analyzing
  document.getElementById('analysisPreview').querySelector('.loading-spinner').classList.add('hidden');
  chartEl.classList.remove('hidden');
  
  // Enable Save button
  document.getElementById('btnSaveUpload').disabled = false;
}

// POST upload to server API
async function saveUploadedImage() {
  const titleInput = document.getElementById('uploadTitle').value.trim();
  const title = titleInput || '무제 이미지';

  if (!analyzedColorData || !uploadImageUrl) {
    alert('이미지 분석 데이터가 올바르지 않습니다.');
    return;
  }

  const payload = {
    title,
    url: uploadImageUrl,
    colors: analyzedColorData,
    dominantColor: analyzedDominantHex
  };

  try {
    const res = await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const newImg = await res.json();
      allImages.unshift(newImg); // add to top
      renderGallery();
      cancelUpload(); // reset UI
      alert('성공적으로 분석 및 추가 완료되었습니다!');
    } else {
      const errorMsg = await res.json();
      alert(`저장 실패: ${errorMsg.error}`);
    }
  } catch (err) {
    console.error('Error saving image:', err);
    alert('서버 저장 실패: 네트워크 상태를 확인하세요.');
  }
}
