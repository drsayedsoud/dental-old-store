import {
  loginWithGoogle, logout, watchAuthState,
  saveUserProfile, getUserProfile,
  addListing, getListing, getListings, watchListings, updateListing, deleteListing,
  toggleLike, addComment, watchComments,
  uploadListingImages
} from './firebase.js';

// =============================
// 🛡️ وظائف مساعدة للأمان والتحقق
// =============================

/**
 * Escape special HTML characters to prevent XSS.
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate that a value is a positive integer > 0.
 */
function validatePositiveNumber(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

/**
 * Validate a phone number (7‑15 digits).
 */
function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Validate a number against a minimum value.
 */
function validateNumber(value, min = 0) {
  const num = Number(value);
  return !isNaN(num) && num >= min ? num : null;
}

// =====================================================
// 🌍 حساب المسافة بين نقطتين (Haversine Formula)
// =====================================================
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// =====================================================
// 🏪 حالة التطبيق
// =====================================================
const state = {
  user: null,           // المستخدم الحالي
  userProfile: null,    // بيانات المستخدم من Firestore
  userLat: null,        // موقع المستخدم
  userLng: null,
  listings: [],         // كل الإعلانات
  currentListing: null, // الإعلان المفتوح حالياً
  currentImages: [],    // صور الإعلان المفتوح
  currentImageIndex: 0, // الصورة الحالية في العرض
  unsubComments: null,  // لإيقاف مراقبة التعليقات
  unsubListings: null,  // لإيقاف مراقبة الإعلانات
  uploadedFiles: [],    // الصور المُختارة للنشر
  uploadedPreviews: [], // معاينة الصور
  selectedCategory: "all",
  maxDistance: 30,      // نطاق البحث بالكيلومتر
  searchQuery: "",
};

// =====================================================
// 🖥️ عناصر الـ DOM
// =====================================================
const pages = {
  login: document.getElementById('login-page'),
  home: document.getElementById('home-page'),
  add: document.getElementById('add-page'),
  detail: document.getElementById('detail-page'),
  profile: document.getElementById('profile-page'),
};

const bottomNav = {
  home: document.getElementById('nav-home'),
  add: document.getElementById('nav-add'),
  profile: document.getElementById('nav-profile'),
};

// =====================================================
// 🔄 التنقل بين الصفحات
// =====================================================
function showPage(pageName) {
  Object.values(pages).forEach(p => p?.classList.remove('active'));
  const topNav = document.getElementById('top-nav');
  const bottomNavEl = document.getElementById('bottom-nav');

  if (pageName === 'login') {
    pages.login?.classList.add('active');
    if (topNav) topNav.style.display = 'none';
    if (bottomNavEl) bottomNavEl.style.display = 'none';
  } else {
    pages[pageName]?.classList.add('active');
    if (topNav) topNav.style.display = 'flex';
    if (bottomNavEl) bottomNavEl.style.display = 'flex';

    // تحديث الشريط السفلي
    document.querySelectorAll('.bottom-nav-item, .bottom-nav-add').forEach(el => el.classList.remove('active'));
    if (pageName === 'home') bottomNav.home?.classList.add('active');
    if (pageName === 'profile') bottomNav.profile?.classList.add('active');
  }

  window.scrollTo(0, 0);
}

// =====================================================
// 🔔 التوست (إشعارات بسيطة)
// =====================================================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// مؤشر التحميل
function showLoader(show) {
  const loader = document.getElementById('loader-overlay');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

// =====================================================
// 📍 الحصول على موقع المستخدم
// =====================================================
function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      // موقع افتراضي (العيادة - الشرقية)
      resolve({ lat: 30.5833, lng: 31.5 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 30.5833, lng: 31.5 }) // افتراضي عند الرفض
    );
  });
}

// =====================================================
// 🔐 المصادقة
// =====================================================
watchAuthState(async (user) => {
  if (user) {
    state.user = user;
    // جلب أو إنشاء الملف الشخصي
    let profile = await getUserProfile(user.uid);
    if (!profile) {
      await saveUserProfile(user.uid, {
        uid: user.uid,
        name: user.displayName || 'مستخدم جديد',
        photo: user.photoURL || '',
        phone: '',
        area: 'العيادة',
        createdAt: new Date().toISOString(),
      });
      profile = await getUserProfile(user.uid);
    }
    state.userProfile = profile;

    // جلب موقع المستخدم
    const loc = await getUserLocation();
    state.userLat = loc.lat;
    state.userLng = loc.lng;

    updateNavUI();
    showPage('home');
    loadHomeListings();
  } else {
    state.user = null;
    state.userProfile = null;
    showPage('login');
    if (state.unsubListings) state.unsubListings();
  }
});

// تحديث الـ UI للشريط العلوي
function updateNavUI() {
  const avatar = document.getElementById('nav-avatar');
  if (avatar && state.user?.photoURL) {
    avatar.src = state.user.photoURL;
  }
}

// زر تسجيل الدخول
document.getElementById('btn-login-google')?.addEventListener('click', async () => {
  try {
    showLoader(true);
    await loginWithGoogle();
  } catch (e) {
    showLoader(false);
    showToast('فشل تسجيل الدخول، حاول مرة أخرى', 'error');
  }
});

// =====================================================
// 🏠 الصفحة الرئيسية
// =====================================================
function loadHomeListings() {
  if (state.unsubListings) state.unsubListings();

  renderSkeletons();

  state.unsubListings = watchListings((listings) => {
    showLoader(false);
    state.listings = listings;
    renderListings();
  });

  // تحديث الـ UI
  const greetEl = document.getElementById('home-greeting');
  if (greetEl) {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور';
    greetEl.textContent = `${greet}، ${state.userProfile?.name?.split(' ')[0] || 'مرحباً'} 👋`;
  }
}

// رسم هياكل التحميل (Skeletons)
function renderSkeletons() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill(`
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>
    </div>
  `).join('');
}

// رسم الإعلانات
function renderListings() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;

  let filtered = state.listings;

  // فلتر بالبحث
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.area?.toLowerCase().includes(q)
    );
  }

  // فلتر بالفئة
  if (state.selectedCategory !== 'all') {
    filtered = filtered.filter(l => l.category === state.selectedCategory);
  }

  // فلتر بالمسافة
  if (state.userLat && state.userLng) {
    filtered = filtered.filter(l => {
      if (!l.lat || !l.lng) return true; // عرض لو مفيش موقع
      const dist = calcDistance(state.userLat, state.userLng, l.lat, l.lng);
      l._distance = dist;
      return dist <= state.maxDistance;
    });
    filtered.sort((a, b) => (a._distance || 0) - (b._distance || 0));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>لا توجد إعلانات</h3>
        <p>لا توجد إعلانات في نطاق ${state.maxDistance} كم منك حالياً.<br>كن أول من ينشر!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(l => buildListingCard(l)).join('');

  // ربط أحداث الكليك
  grid.querySelectorAll('.listing-card').forEach(card => {
    card.addEventListener('click', () => openListing(card.dataset.id));
  });
}

// بناء كارت إعلان
function buildListingCard(listing) {
  const img = listing.images?.[0] || 'placeholder.jpg';
  const isAuction = listing.type === 'auction';
  const liked = listing.likes?.includes(state.user?.uid);
  const likesCount = listing.likes?.length || 0;
  const dist = listing._distance ? `${listing._distance.toFixed(1)} كم` : (listing.area ? escapeHTML(listing.area) : '');
  const titleEsc = escapeHTML(listing.title || 'بدون عنوان');
  const priceText = isAuction
    ? `🔨 يبدأ من ${escapeHTML(listing.startingPrice?.toLocaleString('ar-EG') || '')} ج`
    : `${escapeHTML(listing.price?.toLocaleString('ar-EG') || '')} ج`;

  return `
    <div class="listing-card" data-id="${listing.id}">
      <div class="card-img-wrap">
        <img src="${img}" alt="${listing.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect width=%22200%22 height=%22150%22 fill=%22%23f0ede8%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2230%22>🖼️</text></svg>'">
        <img src="${img}" alt="${titleEsc}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect width=%22200%22 height=%22150%22 fill=%22%23f0ede8%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2230%22>🖼️</text></svg>'">
        <span class="card-type-badge ${isAuction ? 'badge-auction' : 'badge-fixed'}">
          ${isAuction ? '🔨 مزاد' : '💰 سعر ثابت'}
        </span>
      </div>
      <div class="card-body">
        <div class="card-title">${titleEsc}</div>
        <div class="card-price ${isAuction ? 'auction-price' : ''}">${priceText}</div>
        <div class="card-meta">
          <span class="card-area">📍 ${dist}</span>
          <span class="card-likes ${liked ? 'liked' : ''}">
            ${liked ? '❤️' : '🤍'} ${likesCount}
          </span>
        </div>
      </div>
    </div>
  `;
}

document.getElementById('search-input')?.addEventListener('input', (e) => {
  state.searchQuery = e.target.value.trim();
  renderListings();
});

document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.selectedCategory = chip.dataset.cat;
    renderListings();
  });
});

// =====================================================
// 📄 صفحة تفاصيل الإعلان
// =====================================================
async function openListing(listingId) {
  showLoader(true);
  const listing = await getListing(listingId);
  if (!listing) { showLoader(false); showToast('الإعلان غير موجود', 'error'); return; }

  state.currentListing = listing;
  state.currentImages = listing.images || [];
  state.currentImageIndex = 0;

  showPage('detail');
  renderDetailPage(listing);
  showLoader(false);
}

function renderDetailPage(listing) {
  const container = document.getElementById('detail-content-area');
  if (!container) return;

  const isAuction = listing.type === 'auction';
  const isOwner = listing.sellerId === state.user?.uid;
  const liked = listing.likes?.includes(state.user?.uid);
  const likesCount = listing.likes?.length || 0;
  const titleEsc = escapeHTML(listing.title || 'بدون عنوان');
  const sellerNameEsc = escapeHTML(listing.sellerName || 'مجهول');
  const sellerAreaEsc = escapeHTML(listing.area || 'غير محدد');

  const topBid = listing.currentTopBid || listing.startingPrice;

  let auctionTimerHTML = '';
  if (isAuction && listing.auctionEndsAt) {
    auctionTimerHTML = buildAuctionTimer(listing.auctionEndsAt);
  }

  container.innerHTML = `
    <div class="detail-images" id="detail-images-slider">
      <img id="detail-main-img" src="${state.currentImages[0] || ''}" alt="${titleEsc}">
      ${state.currentImages.length > 1 ? `<span class="detail-images-count">📷 ${state.currentImageIndex + 1}/${state.currentImages.length}</span>` : ''}
    </div>

    <div class="detail-content">
      <span class="detail-type-badge ${isAuction ? 'auction' : 'fixed'}">
        ${isAuction ? '🔨 مزاد' : '💰 سعر ثابت'}
      </span>
      <h1 class="detail-title">${titleEsc}</h1>
      <div class="detail-price ${isAuction ? 'auction-price' : ''}">
        ${isAuction
          ? `🔨 أعلى عرض: ${topBid?.toLocaleString('ar-EG')} ج`
          : `${listing.price?.toLocaleString('ar-EG')} ج`}
      </div>

      ${auctionTimerHTML}

      <div class="detail-actions-bar">
        ${isOwner ? `
          <button class="action-btn outline" onclick="deleteMyListing('${listing.id}')">🗑️ حذف</button>
        ` : isAuction ? `
          <button class="action-btn auction-btn" onclick="scrollToComment()">🔨 زايد الآن</button>
        ` : `
          <button class="action-btn primary" onclick="contactSeller('${listing.sellerPhone}')">📱 تواصل مع البائع</button>
        `}
        <button class="action-btn outline ${liked ? 'liked-btn' : ''}" id="like-btn" onclick="handleLike('${listing.id}')">
          ${liked ? '❤️' : '🤍'} ${likesCount}
        </button>
        <button class="action-btn outline" onclick="shareListing('${listing.id}')">🔗 شارك</button>
      </div>

      <div class="seller-info">
        <img class="seller-avatar" src="${listing.sellerPhoto || ''}" alt="${sellerNameEsc}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2246%22 height=%2246%22><rect width=%2246%22 height=%2246%22 rx=%2223%22 fill=%22%23e0dbd4%22/><text x=%2250%%22 y=%2254%%22 text-anchor=%22middle%22 font-size=%2222%22>👤</text></svg>'">
        <div>
          <div class="seller-name">${sellerNameEsc}</div>
          <div class="seller-area">📍 ${sellerAreaEsc}</div>
        </div>
        ${listing.sellerPhone ? `
          <button class="seller-contact-btn" onclick="contactSeller('${listing.sellerPhone}')">
            💬 واتساب
          </button>
        ` : ''}
      </div>

      <div class="detail-description">${escapeHTML(listing.description || 'لا يوجد وصف')}</div>

      <div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:20px;">
        📅 نُشر في: ${formatDate(listing.createdAt)} &nbsp;|&nbsp; 📍 ${sellerAreaEsc}
      </div>

      <div class="comments-section">
        <div class="comments-title">
          ${isAuction ? '🔨 المزايدات والتعليقات' : '💬 التعليقات'}
          <span class="comments-count" id="comments-count">0</span>
        </div>
        <div id="comments-list"></div>
      </div>
    </div>
  `;

  if (state.unsubComments) state.unsubComments();
  state.unsubComments = watchComments(listing.id, (comments) => {
    renderComments(comments, isAuction);
    const countEl = document.getElementById('comments-count');
    if (countEl) countEl.textContent = comments.length;
  });

  const commentBar = document.getElementById('add-comment-bar');
  if (commentBar) {
    commentBar.style.display = 'flex';
    const input = document.getElementById('comment-input');
    const prefix = document.getElementById('bid-prefix');
    if (isAuction) {
      if (prefix) prefix.style.display = 'inline';
      if (input) input.placeholder = 'اكتب مبلغ مزايدتك...';
    } else {
      if (prefix) prefix.style.display = 'none';
      if (input) input.placeholder = 'اكتب تعليقك...';
    }
  }

  setupImageSwipe();

  if (isAuction && listing.auctionEndsAt) {
    startAuctionTimer(listing.auctionEndsAt);
  }
}

function renderComments(comments, isAuction) {
  const list = document.getElementById('comments-list');
  if (!list) return;

  if (comments.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:20px;">
      ${isAuction ? '🔨 لا توجد مزايدات بعد، كن الأول!' : '💬 لا توجد تعليقات بعد، أضف تعليقاً!'}
    </p>`;
    return;
  }

  if (isAuction) {
    comments.sort((a, b) => (b.bidAmount || 0) - (a.bidAmount || 0));
  }

  list.innerHTML = comments.map((c, i) => `
    <div class="comment-item">
      <img class="comment-avatar" src="${c.userPhoto || ''}" alt="${escapeHTML(c.userName)}"
        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2234%22 height=%2234%22><rect width=%2234%22 height=%2234%22 rx=%2217%22 fill=%22%23e0dbd4%22/><text x=%2250%%22 y=%2254%%22 text-anchor=%22middle%22 font-size=%2218%22>👤</text></svg>'">
      <div class="comment-bubble">
        <div class="comment-meta">
          <span class="comment-name">${escapeHTML(c.userName || 'مجهول')} ${i === 0 && isAuction ? '👑' : ''}</span>
          <span class="comment-time">${formatDate(c.createdAt)}</span>
        </div>
        ${c.text ? `<div class="comment-text">${escapeHTML(c.text)}</div>` : ''}
        ${isAuction && c.bidAmount ? `<div class="bid-amount">💰 ${c.bidAmount.toLocaleString('ar-EG')} ج</div>` : ''}
      </div>
    </div>
  `).join('');
}

document.getElementById('btn-send-comment')?.addEventListener('click', sendComment);
document.getElementById('comment-input')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendComment();
});

async function sendComment() {
  const input = document.getElementById('comment-input');
  const text = input?.value?.trim();
  if (!text || !state.currentListing || !state.user) return;

  const isAuction = state.currentListing.type === 'auction';
  const commentData = {
    userId: state.user.uid,
    userName: state.userProfile?.name || state.user.displayName || 'مجهول',
    userPhoto: state.user.photoURL || '',
    text: isAuction ? '' : text,
    bidAmount: isAuction ? validateNumber(text, 1) : null,
  };

  if (isAuction) {
    if (commentData.bidAmount === null) {
      showToast('أدخل مبلغاً صحيحاً للمزايدة', 'error');
      return;
    }
    const topBid = state.currentListing.currentTopBid || state.currentListing.startingPrice || 0;
    if (commentData.bidAmount <= topBid) {
      showToast(`مزايدتك يجب أن تكون أكبر من ${topBid.toLocaleString('ar-EG')} ج`, 'error');
      return;
    }
  }

  try {
    await addComment(state.currentListing.id, commentData);
    if (input) input.value = '';
  } catch (e) {
    showToast('فشل الإرسال، حاول مرة أخرى', 'error');
  }
}

async function handleLike(listingId) {
  if (!state.user) { showToast('سجل دخول أولاً', 'error'); return; }
  const added = await toggleLike(listingId, state.user.uid);
  showToast(added ? '❤️ تمت الإضافة للمفضلة' : '💔 تمت الإزالة من المفضلة', 'info');

  const btn = document.getElementById('like-btn');
  if (btn) {
    const listing = await getListing(listingId);
    state.currentListing = listing;
    const liked = listing?.likes?.includes(state.user.uid);
    const count = listing?.likes?.length || 0;
    btn.innerHTML = `${liked ? '❤️' : '🤍'} ${count}`;
    btn.classList.toggle('liked-btn', liked);
  }
}

function shareListing(listingId) {
  const url = `${window.location.origin}?listing=${listingId}`;
  if (navigator.share) {
    navigator.share({ title: state.currentListing?.title, url });
  } else {
    navigator.clipboard.writeText(url);
    showToast('تم نسخ رابط الإعلان', 'success');
  }
}

function contactSeller(phone) {
  if (!phone) { showToast('رقم الهاتف غير متاح', 'error'); return; }
  const cleanPhone = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${cleanPhone}`, '_blank');
}

async function deleteMyListing(listingId) {
  if (!confirm('هل تريد حذف هذا الإعلان؟')) return;
  showLoader(true);
  await deleteListing(listingId);
  showLoader(false);
  showToast('تم حذف الإعلان', 'success');
  showPage('home');
}

// التمرير للتعليقات
function scrollToComment() {
  const input = document.getElementById('comment-input');
  input?.focus();
  document.querySelector('.comments-section')?.scrollIntoView({ behavior: 'smooth' });
}

// =====================================================
// ⏱️ عداد المزاد
// =====================================================
let timerInterval = null;

function buildAuctionTimer(endsAt) {
  return `
    <div class="auction-timer-card">
      <div class="auction-timer-label">⏰ ينتهي المزاد خلال</div>
      <div class="auction-timer">
        <div class="timer-unit"><div class="timer-num" id="timer-d">--</div><div class="timer-lbl">يوم</div></div>
        <div class="timer-unit"><div class="timer-num" id="timer-h">--</div><div class="timer-lbl">ساعة</div></div>
        <div class="timer-unit"><div class="timer-num" id="timer-m">--</div><div class="timer-lbl">دقيقة</div></div>
        <div class="timer-unit"><div class="timer-num" id="timer-s">--</div><div class="timer-lbl">ثانية</div></div>
      </div>
    </div>
  `;
}

function startAuctionTimer(endsAt) {
  if (timerInterval) clearInterval(timerInterval);
  function updateTimer() {
    const end = endsAt?.toDate ? endsAt.toDate() : new Date(endsAt);
    const diff = end - new Date();
    if (diff <= 0) {
      clearInterval(timerInterval);
      document.getElementById('timer-d').textContent = '00';
      document.getElementById('timer-h').textContent = '00';
      document.getElementById('timer-m').textContent = '00';
      document.getElementById('timer-s').textContent = '00';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    const td = document.getElementById('timer-d');
    const th = document.getElementById('timer-h');
    const tm = document.getElementById('timer-m');
    const ts = document.getElementById('timer-s');
    if (td) td.textContent = pad(d);
    if (th) th.textContent = pad(h);
    if (tm) tm.textContent = pad(m);
    if (ts) ts.textContent = pad(s);
  }
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

// =====================================================
// 📸 سحب الصور (Image Swipe)
// =====================================================
function setupImageSwipe() {
  const slider = document.getElementById('detail-images-slider');
  if (!slider || state.currentImages.length <= 1) return;
  let startX = 0;
  slider.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) state.currentImageIndex = Math.min(state.currentImageIndex + 1, state.currentImages.length - 1);
      else state.currentImageIndex = Math.max(state.currentImageIndex - 1, 0);
      document.getElementById('detail-main-img').src = state.currentImages[state.currentImageIndex];
      const count = document.querySelector('.detail-images-count');
      if (count) count.textContent = `📷 ${state.currentImageIndex + 1}/${state.currentImages.length}`;
    }
  }, { passive: true });
}

// =====================================================
// ➕ صفحة نشر إعلان
// =====================================================
function initAddPage() {
  state.uploadedFiles = [];
  state.uploadedPreviews = [];
  renderImageSlots();

  // إعادة تعيين النموذج
  const form = document.getElementById('add-listing-form');
  if (form) form.reset();

  // إخفاء إعدادات المزاد
  const auctionSettings = document.getElementById('auction-settings');
  if (auctionSettings) auctionSettings.classList.remove('visible');

  // تحديد السعر الثابت افتراضياً
  selectSaleType('fixed');
}

function renderImageSlots() {
  const container = document.getElementById('images-upload-area');
  if (!container) return;
  const maxImgs = 5;
  let html = '';

  // الصور المُختارة
  for (let i = 0; i < state.uploadedPreviews.length; i++) {
    html += `
      <div class="img-upload-thumb has-img">
        <img src="${state.uploadedPreviews[i]}" alt="صورة ${i+1}">
        <button class="remove-img" onclick="removeImage(${i})">✕</button>
      </div>
    `;
  }

  // زر إضافة صورة
  if (state.uploadedFiles.length < maxImgs) {
    html += `
      <label class="img-upload-thumb" for="img-input">
        <span class="add-icon">📷</span>
        <span class="add-text">أضف صورة</span>
      </label>
      <input type="file" id="img-input" accept="image/*" multiple style="display:none" onchange="handleImageSelect(event)">
    `;
  }

  container.innerHTML = html;
}

window.handleImageSelect = function(e) {
  const files = Array.from(e.target.files);
  const maxFiles = 5;
  const remaining = maxFiles - state.uploadedFiles.length;
  const selected = files.slice(0, remaining);

  selected.forEach(file => {
    // Validate file type and size (<=5MB)
    if (!file.type.startsWith('image/')) {
      showToast('الملف غير مدعوم، يرجى اختيار صورة فقط', 'error');
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      showToast('حجم الصورة كبير جداً (أقصى 5 ميغابايت)', 'error');
      return;
    }
    state.uploadedFiles.push(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      state.uploadedPreviews.push(ev.target.result);
      renderImageSlots();
    };
    reader.readAsDataURL(file);
  });
};

window.removeImage = function(index) {
  state.uploadedFiles.splice(index, 1);
  state.uploadedPreviews.splice(index, 1);
  renderImageSlots();
};

function selectSaleType(type) {
  const fixedBtn = document.getElementById('btn-type-fixed');
  const auctionBtn = document.getElementById('btn-type-auction');
  const auctionSettings = document.getElementById('auction-settings');
  const priceSection = document.getElementById('price-section');

  if (fixedBtn) fixedBtn.classList.toggle('selected-fixed', type === 'fixed');
  if (auctionBtn) auctionBtn.classList.toggle('selected-auction', type === 'auction');
  if (auctionSettings) auctionSettings.classList.toggle('visible', type === 'auction');
  if (priceSection) priceSection.style.display = type === 'fixed' ? 'block' : 'none';

  document.getElementById('sale-type-input').value = type;
}

document.getElementById('btn-type-fixed')?.addEventListener('click', () => selectSaleType('fixed'));
document.getElementById('btn-type-auction')?.addEventListener('click', () => selectSaleType('auction'));

// إرسال الإعلان
document.getElementById('add-listing-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.user) { showToast('سجل دخول أولاً', 'error'); return; }

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  showLoader(true);

  try {
    const type = document.getElementById('sale-type-input').value;
    const title = document.getElementById('listing-title').value.trim();
    const description = document.getElementById('listing-desc').value.trim();
    const category = document.getElementById('listing-cat').value;
    const rawPrice = document.getElementById('listing-price').value;
    const rawStarting = document.getElementById('listing-starting-price').value;
    const rawAuctionDays = document.getElementById('auction-days').value;
    const area = document.getElementById('listing-area').value.trim();
    const phone = document.getElementById('listing-phone').value.trim();

    const price = type === 'fixed' ? validatePositiveNumber(rawPrice) : null;
    const startingPrice = type === 'auction' ? validatePositiveNumber(rawStarting) : null;
    const auctionDays = type === 'auction' ? validateNumber(rawAuctionDays, 1) : null;

    if (!title) { showToast('أدخل عنوان الإعلان', 'error'); showLoader(false); if (submitBtn) submitBtn.disabled = false; return; }

    // تحقّق من السعر إذا كان ثابتًا
    if (type === 'fixed' && price === null) {
      showToast('الرجاء إدخال سعر صحيح > 0', 'error');
      showLoader(false);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    // تحقّق من سعر البدء والأيام إذا كان مزادًا
    if (type === 'auction') {
      if (startingPrice === null) {
        showToast('الرجاء إدخال السعر الابتدائي الصحيح > 0', 'error');
        showLoader(false);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      if (!auctionDays || auctionDays <= 0 || auctionDays > 30) {
        showToast('عدد أيام المزاد يجب أن يكون بين 1 و 30', 'error');
        showLoader(false);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
    }
    // تحقّق من رقم الهاتف إذا تم إدخاله
    if (phone && !isValidPhone(phone)) {
      showToast('رقم الهاتف غير صالح', 'error');
      showLoader(false);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    // رفع الصور
    let imageUrls = [];
    if (state.uploadedFiles.length > 0) {
      showToast('⏳ جارٍ رفع الصور...', 'info');
      imageUrls = await uploadListingImages(state.uploadedFiles, state.user.uid);
    }

    // موقع المستخدم
    const lat = state.userLat || 30.5833;
    const lng = state.userLng || 31.5;

    // وقت انتهاء المزاد
    let auctionEndsAt = null;
    if (type === 'auction' && auctionDays) {
      const ends = new Date();
      ends.setDate(ends.getDate() + auctionDays);
      auctionEndsAt = ends.toISOString();
    }

    await addListing({
      title,
      description,
      category,
      type,
      price: price || null,
      startingPrice: startingPrice || null,
      currentTopBid: startingPrice || null,
      auctionEndsAt,
      images: imageUrls,
      area: area || state.userProfile?.area || 'العيادة',
      lat,
      lng,
      sellerId: state.user.uid,
      sellerName: state.userProfile?.name || state.user.displayName,
      sellerPhoto: state.user.photoURL || '',
      sellerPhone: phone || state.userProfile?.phone || '',
    });

    showLoader(false);
    showToast('✅ تم نشر إعلانك بنجاح!', 'success');
    showPage('home');
    initAddPage();
  } catch (err) {
    console.error(err);
    showLoader(false);
    showToast('فشل نشر الإعلان، حاول مرة أخرى', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

// =====================================================
// 👤 صفحة الملف الشخصي
// =====================================================
function renderProfilePage() {
  const user = state.user;
  const profile = state.userProfile;
  if (!user) return;

  const avatarEl = document.getElementById('profile-avatar');
  const nameEl = document.getElementById('profile-name');
  const areaEl = document.getElementById('profile-area');

  if (avatarEl) avatarEl.src = user.photoURL || '';
  if (nameEl) nameEl.textContent = profile?.name || user.displayName || 'مستخدم';
  if (areaEl) areaEl.textContent = profile?.area || 'العيادة';

  // إحصاء إعلانات المستخدم
  const myListings = state.listings.filter(l => l.sellerId === user.uid);
  const activeEl = document.getElementById('stat-active');
  const soldEl = document.getElementById('stat-sold');
  if (activeEl) activeEl.textContent = myListings.filter(l => l.status === 'active').length;
  if (soldEl) soldEl.textContent = myListings.filter(l => l.status === 'sold').length;
}

// تسجيل الخروج
document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await logout();
  showToast('تم تسجيل الخروج', 'info');
});

// =====================================================
// 🔗 التنقل - الشريط السفلي
// =====================================================
document.getElementById('nav-home')?.addEventListener('click', () => {
  showPage('home');
  if (state.unsubComments) state.unsubComments();
  document.getElementById('add-comment-bar').style.display = 'none';
});

document.getElementById('nav-add')?.addEventListener('click', () => {
  if (!state.user) { showToast('سجل دخول أولاً', 'error'); return; }
  showPage('add');
  initAddPage();
  document.getElementById('add-comment-bar').style.display = 'none';
});

document.getElementById('nav-profile')?.addEventListener('click', () => {
  showPage('profile');
  renderProfilePage();
  document.getElementById('add-comment-bar').style.display = 'none';
});

// زر الرجوع في صفحة التفاصيل
document.getElementById('detail-back-btn')?.addEventListener('click', () => {
  if (state.unsubComments) state.unsubComments();
  document.getElementById('add-comment-bar').style.display = 'none';
  showPage('home');
});

// =====================================================
// 🛠️ وظائف مساعدة
// =====================================================
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'منذ لحظات';
  if (diff < 3600000) return `منذ ${Math.floor(diff/60000)} دقيقة`;
  if (diff < 86400000) return `منذ ${Math.floor(diff/3600000)} ساعة`;
  if (diff < 604800000) return `منذ ${Math.floor(diff/86400000)} يوم`;
  return date.toLocaleDateString('ar-EG');
}

// =====================================================
// 🌐 تعريض الدوال للـ HTML
// =====================================================
window.handleLike = handleLike;
window.shareListing = shareListing;
window.contactSeller = contactSeller;
window.deleteMyListing = deleteMyListing;
window.scrollToComment = scrollToComment;
window.selectSaleType = selectSaleType;

// تهيئة أولية
showLoader(false);
