// Customer Dashboard Marketplace Module
// Integrates smart curated left sidebar and dynamic scroller/spotlight injections

let allMarketplaceShops = [];
let allMarketplaceListings = [];
let allMarketplaceReviews = []; 
let userLikes = []; 
let userFavoriteShops = []; 
let globalLikesCount = {}; 
let activeMarketplaceMode = 'listings';
let searchTimeout = null;
let semanticSearchResults = null;

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Curation Categories Helpers
function getCuratedCategories(query = '') {
    const defaultCategories = [
        { name: 'Suits', icon: 'fas fa-user-tie' },
        { name: 'Senator Wear', icon: 'fas fa-cut' },
            { name: 'African Attire', icon: 'fas fa-globe-africa' },
        { name: 'Dresses', icon: 'fas fa-female' },
        { name: 'Shirts', icon: 'fas fa-shirt' },
        { name: 'Shoes', icon: 'fas fa-shoe-prints' },
        { name: 'Bags & Clutches', icon: 'fas fa-briefcase' }
    ];

    if (!query) {
        return defaultCategories;
    }

    const queryLower = query.toLowerCase();

    if (queryLower.includes('shoe') || queryLower.includes('foot') || queryLower.includes('boot') || queryLower.includes('sandal')) {
        return [
            { name: 'Shoes', icon: 'fas fa-shoe-prints' },
            { name: 'Sandals & Slippers', icon: 'fas fa-shoe-prints' },
            { name: 'Boots', icon: 'fas fa-shoe-prints' },
            { name: 'Belts', icon: 'fas fa-tag' },
            { name: 'Suits', icon: 'fas fa-user-tie' }
        ];
    }
    if (queryLower.includes('dress') || queryLower.includes('gown') || queryLower.includes('female') || queryLower.includes('woman') || queryLower.includes('women')) {
        return [
            { name: 'Dresses', icon: 'fas fa-female' },
            { name: 'Ready-to-Wear Dresses', icon: 'fas fa-female' },
            { name: 'Jumpsuits & Rompers', icon: 'fas fa-female' },
            { name: 'Bags & Clutches', icon: 'fas fa-briefcase' },
            { name: 'Jewellery', icon: 'fas fa-gem' },
            { name: 'Walking Sticks & Canes', icon: 'fas fa-magic' }
        ];
    }
    if (queryLower.includes('suit') || queryLower.includes('formal') || queryLower.includes('coat') || queryLower.includes('senator') || queryLower.includes('man') || queryLower.includes('men')) {
        return [
            { name: 'Suits', icon: 'fas fa-user-tie' },
            { name: 'Senator Wear', icon: 'fas fa-cut' },
            { name: 'African Attire', icon: 'fas fa-globe-africa' },
            { name: 'Shirts', icon: 'fas fa-shirt' },
            { name: 'Trousers', icon: 'fas fa-cut' },
            { name: 'Ties & Bowties', icon: 'fas fa-user-tie' },
            { name: 'Belts', icon: 'fas fa-tag' }
        ];
    }
    if (queryLower.includes('accessory') || queryLower.includes('bag') || queryLower.includes('watch') || queryLower.includes('glass') || queryLower.includes('shade') || queryLower.includes('hat') || queryLower.includes('cap')) {
        return [
            { name: 'Watches', icon: 'fas fa-clock' },
            { name: 'Glasses & Shades', icon: 'fas fa-glasses' },
            { name: 'Bags & Clutches', icon: 'fas fa-briefcase' },
            { name: 'Hats & Caps', icon: 'fas fa-hat-cowboy' },
            { name: 'Belts', icon: 'fas fa-tag' }
        ];
    }

    const matching = [];
    const allOptions = [
        { name: 'Suits', icon: 'fas fa-user-tie' },
        { name: 'Senator Wear', icon: 'fas fa-cut' },
            { name: 'African Attire', icon: 'fas fa-globe-africa' },
        { name: 'Dresses', icon: 'fas fa-female' },
        { name: 'Shirts', icon: 'fas fa-shirt' },
        { name: 'Trousers', icon: 'fas fa-cut' },
        { name: 'Coats', icon: 'fas fa-user-tie' },
        { name: 'Alterations', icon: 'fas fa-compress' },
        { name: 'Jumpsuits & Rompers', icon: 'fas fa-female' },
        { name: 'Hoodies & Sweatshirts', icon: 'fas fa-shirt' },
        { name: 'T-Shirts & Polos', icon: 'fas fa-shirt' },
        { name: 'Jeans & Denim', icon: 'fas fa-cut' },
        { name: 'Jackets & Cardigans', icon: 'fas fa-user-tie' },
        { name: 'Ready-to-Wear Dresses', icon: 'fas fa-female' },
        { name: 'Activewear', icon: 'fas fa-running' },
        { name: 'Watches', icon: 'fas fa-clock' },
        { name: 'Glasses & Shades', icon: 'fas fa-glasses' },
        { name: 'Ties & Bowties', icon: 'fas fa-user-tie' },
        { name: 'Scarves & Capes', icon: 'fas fa-user-tie' },
        { name: 'Belts', icon: 'fas fa-tag' },
        { name: 'Hats & Caps', icon: 'fas fa-hat-cowboy' },
        { name: 'Bags & Clutches', icon: 'fas fa-briefcase' },
        { name: 'Jewellery', icon: 'fas fa-gem' },
            { name: 'Walking Sticks & Canes', icon: 'fas fa-magic' },
        { name: 'Shoes', icon: 'fas fa-shoe-prints' },
        { name: 'Sandals & Slippers', icon: 'fas fa-shoe-prints' },
        { name: 'Boots', icon: 'fas fa-shoe-prints' }
    ];

    for (const opt of allOptions) {
        if (opt.name.toLowerCase().includes(queryLower)) {
            matching.push(opt);
            if (matching.length >= 6) break;
        }
    }

    if (matching.length < 5) {
        for (const opt of defaultCategories) {
            if (!matching.some(m => m.name === opt.name)) {
                matching.push(opt);
            }
            if (matching.length >= 6) break;
        }
    }

    return matching;
}

function renderSidebarCategories() {
    const container = document.getElementById('sidebar-categories-container');
    if (!container) return;

    const query = document.getElementById('marketplace-search-query')?.value || '';
    const currentCat = document.getElementById('marketplace-category-filter')?.value || '';
    const curated = getCuratedCategories(query);

    let html = '';
    
    const allActive = currentCat === '' ? 'active' : '';
    html += `
        <button class="sidebar-cat-item ${allActive}" onclick="selectSidebarCategory('')">
            <i class="fas fa-th-large"></i> All Categories
        </button>
    `;

    curated.forEach(cat => {
        const isActive = currentCat === cat.name ? 'active' : '';
        html += `
            <button class="sidebar-cat-item ${isActive}" onclick="selectSidebarCategory('${escapeHTML(cat.name)}')">
                <i class="${escapeHTML(cat.icon)}"></i> ${escapeHTML(cat.name)}
            </button>
        `;
    });

    container.innerHTML = html;
}

function selectSidebarCategory(catName) {
    const select = document.getElementById('marketplace-category-filter');
    if (select) {
        select.value = catName;
    }
    
    // Push state to browser history so 'back' button can undo category selection
    const url = new URL(window.location);
    if (catName) {
        url.searchParams.set('category', catName);
    } else {
        url.searchParams.delete('category');
    }
    window.history.pushState({ category: catName }, '', url);

    if (activeMarketplaceMode === 'shops' || activeMarketplaceMode === 'favourites') {
        setMarketplaceMode('listings');
    } else {
        filterMarketplace();
    }
    const target = document.getElementById('marketplace-listings-container');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Fetch Data from Supabase
async function loadMarketplaceData() {
    const shopsContainer = document.getElementById('marketplace-shops-container');
    const listingsContainer = document.getElementById('marketplace-listings-container');

    if (allMarketplaceShops.length > 0 && allMarketplaceListings.length > 0) {
        renderMarketplaceShops(allMarketplaceShops);
        renderMarketplaceListings(allMarketplaceListings);
        return;
    }

    try {
        // Fetch current user details first as some queries depend on it
        const authRes = await supabaseClient.auth.getUser();
        if (authRes.data && authRes.data.user) currentUser = authRes.data.user;

        // Fire all independent queries simultaneously
        const [shopsRes, listingsRes, reviewsRes, likesRes, favsRes, globalLikesRes] = await Promise.all([
            // 1. Fetch public shops
            supabaseClient.from('shops').select('*').eq('is_public', true).then(res => {
                if (res.error || !res.data) return supabaseClient.from('shops').select('*');
                return res;
            }),
            // 2. Fetch active listings
            supabaseClient.from('marketplace_listings').select('*, shops(name, profile_image), size_charts(*)').eq('status', 'active'),
            // 3. Fetch reviews
            supabaseClient.from('vw_marketplace_reviews').select('*'),
            // 4. Fetch user likes
            currentUser ? supabaseClient.from('marketplace_likes').select('listing_id').eq('user_id', currentUser.id) : Promise.resolve({ data: [] }),
            // 5. Fetch user favorite shops
            currentUser ? supabaseClient.from('client_favorite_shops').select('shop_id').eq('client_id', currentUser.id) : Promise.resolve({ data: [] }),
            // 6. Fetch global likes count
            supabaseClient.from('marketplace_likes').select('listing_id')
        ]);

        // Process shops
        allMarketplaceShops = shopsRes.data || [];

        // Process listings
        if (listingsRes.error || !listingsRes.data || listingsRes.data.length === 0) {
            allMarketplaceListings = getMockListings();
        } else {
            allMarketplaceListings = listingsRes.data;
        }

        // Process reviews
        allMarketplaceReviews = reviewsRes.data || [];

        // Process user likes
        if (likesRes.data && !likesRes.error) {
            userLikes = likesRes.data.map(l => l.listing_id);
        }

        // Process user favorite shops
        if (favsRes.data && !favsRes.error) {
            userFavoriteShops = favsRes.data.map(f => f.shop_id);
        }

        // Process global likes
        globalLikesCount = {};
        if (globalLikesRes.data) {
            globalLikesRes.data.forEach(l => { globalLikesCount[l.listing_id] = (globalLikesCount[l.listing_id] || 0) + 1; });
        }

        // Invalidate caching before sorting to respect favorited status changes
        if (typeof clearAlgorithmCache === 'function') {
            clearAlgorithmCache();
        }

        if (typeof calculateShopScore === 'function') {
            allMarketplaceShops.sort((a, b) => calculateShopScore(b, allMarketplaceReviews, userFavoriteShops) - calculateShopScore(a, allMarketplaceReviews, userFavoriteShops));
        }
        
        if (typeof calculateBespokeScore === 'function') {
            allMarketplaceListings.sort((a, b) => calculateBespokeScore(b, allMarketplaceShops, allMarketplaceReviews, globalLikesCount, userFavoriteShops) - calculateBespokeScore(a, allMarketplaceShops, allMarketplaceReviews, globalLikesCount, userFavoriteShops));
        }

        renderMarketplaceShops(allMarketplaceShops);
        renderMarketplaceListings(allMarketplaceListings);
    } catch (err) {
        console.error("Error loading marketplace data:", err);
        if (shopsContainer) shopsContainer.innerHTML = `<p style="color:red; text-align:center;">Failed to load shops.</p>`;
    }
}

// Render Tailor Shops
function renderMarketplaceShops(shops) {
    const container = document.getElementById('marketplace-shops-container');
    if (!container) return;
    if (shops.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--brand-slate);">No shops found.</div>`;
        return;
    }
    const STORAGE_URL = `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/marketplace-assets/`;
    container.innerHTML = shops.map(shop => {
        const hasBanner = shop.banner_image && shop.banner_image.trim() !== '' && !shop.banner_image.endsWith('/');
        const bannerUrl = hasBanner ? (shop.banner_image.startsWith('http') ? shop.banner_image : STORAGE_URL + shop.banner_image) : null;
        const bannerStyle = bannerUrl ? `background-image: url('${bannerUrl}')` : `background: linear-gradient(135deg, var(--brand-navy, #0a192f) 0%, var(--brand-navy-light, #112240) 100%); border-bottom: 1px solid rgba(212,175,55,0.15);`;
        const avatarIcon = `<i class="fas fa-store"></i>`;
        const avatarUrl = shop.profile_image ? (shop.profile_image.startsWith('http') ? shop.profile_image : STORAGE_URL + shop.profile_image) : '';
        const avatarStyle = avatarUrl ? `background-image: url('${avatarUrl}'); border-color: var(--brand-gold);` : '';

        const rawLoc = shop.location_name || shop.location || 'Nairobi, Kenya';
        const formattedLoc = rawLoc.split(',').map(s => s.trim().replace(/\b\w/g, c => c.toUpperCase())).join(', ');

        const shopReviews = allMarketplaceReviews.filter(r => r.shop_id === shop.id);
        const avgRating = shopReviews.length > 0
            ? (shopReviews.reduce((sum, r) => sum + r.rating, 0) / shopReviews.length).toFixed(1)
            : null;
        const ratingBadge = avgRating
            ? `<span class="card-badge"><i class="fas fa-star" style="color: var(--brand-gold);"></i> ${avgRating} (${shopReviews.length})</span>`
            : `<span class="card-badge" style="background: rgba(255,255,255,0.05); color: var(--brand-slate);"><i class="far fa-star"></i> New Shop</span>`;

        const isFavorited = userFavoriteShops.includes(shop.id);
        const favShopColor = isFavorited ? '#e60023' : 'rgba(255,255,255,0.75)';
        const favBtn = `
            <button class="fav-shop-btn" data-shop-id="${shop.id}" onclick="event.stopPropagation(); toggleFavoriteShop('${shop.id}')" style="position:absolute; top:12px; right:12px; z-index:10; background:rgba(6,12,24,0.65); border:none; color:${favShopColor}; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.9em; transition:all 0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.3);" title="${isFavorited ? 'Unpin Shop' : 'Pin Shop'}">
                <i class="fas fa-thumbtack" style="transition: transform 0.2s; transform: ${isFavorited ? 'rotate(45deg)' : 'rotate(0deg)'};"></i>
            </button>`;

        return `
            <div class="card shop-card">
                <div class="card-banner-wrap">
                    ${favBtn}
                    <div class="card-banner" style="${bannerStyle}"></div>
                </div>
                <div class="card-avatar" style="${avatarStyle} position: absolute;">
                    ${shop.profile_image ? '' : avatarIcon}
                </div>
                <div class="card-body" style="padding-top: 25px;">
                    <h3 class="card-title">${shop.name}</h3>
                    <div class="card-location">
                        <i class="fas fa-map-marker-alt"></i> ${formattedLoc}
                    </div>
                    <p class="card-desc">${shop.description || 'Premium custom design shop.'}</p>
                    <div class="card-footer">
                        ${ratingBadge}
                        <a href="../../views/manager/shop.html?id=${shop.id}" class="card-btn">Visit Shop <i class="fas fa-chevron-right"></i></a>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// Get single listing card HTML helper
function getListingCardHtml(list) {
    const imageUrl = (list.image_urls && JSON.parse(list.image_urls)[0]) || list.image_url || `https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&q=80&w=400`;
    const shopFromCache = allMarketplaceShops.find(s => s.id === list.shop_id);
    const shopName = list.shops?.name || shopFromCache?.name || 'Shop';
    const shopProfileImg = list.shops?.profile_image || shopFromCache?.profile_image;

    const STORAGE_URL = `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/marketplace-assets/`;
    const avatarImgUrl = shopProfileImg ? (shopProfileImg.startsWith('http') ? shopProfileImg : STORAGE_URL + shopProfileImg) : null;
    const avatarIconHtml = avatarImgUrl 
        ? `<img src="${avatarImgUrl}" style="width:16px; height:16px; border-radius:50%; object-fit:cover; margin-right:6px; border: 1px solid var(--brand-gold); vertical-align: middle;">`
        : `<i class="fas fa-store" style="color:var(--brand-gold); margin-right:4px; vertical-align: middle;"></i>`;

    const isLiked = userLikes.includes(list.id);
    const heartIcon = isLiked ? 'fas fa-heart' : 'far fa-heart';
    const heartColor = isLiked ? '#ef4444' : 'var(--brand-slate)';
    const viewsHtml = `<span id="view-count-${list.id}" style="font-size:0.75em;color:var(--brand-slate); display: inline-flex; align-items: center; gap: 4px; vertical-align: middle;"><i class="fas fa-eye"></i> ${list.views || 0}</span>`;
    const likeBtn = `
        <button class="like-btn" onclick="event.stopPropagation(); toggleLike('${list.id}')" style="background:transparent; border:none; color:${heartColor}; cursor:pointer; font-size:1.15em; padding:4px; display:inline-flex; align-items:center; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" id="like-btn-${list.id}">
            <i class="${heartIcon}"></i>
        </button>`;

    let badgeHtml = '';
    if (list.original_price && parseFloat(list.original_price) > parseFloat(list.price)) {
        const pct = Math.round(((parseFloat(list.original_price) - parseFloat(list.price)) / parseFloat(list.original_price)) * 100);
        badgeHtml = `<span class="badge-discount">${pct}% OFF</span>`;
    } else if (list.created_at) {
        const createdAt = new Date(list.created_at);
        const now = new Date();
        const diffTime = now - createdAt;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays <= 5) {
            badgeHtml = `<span class="badge-new">NEW</span>`;
        }
    }

    return `
        <div class="card listing-card" style="cursor: pointer;" onclick="openListingModal('${list.id}')">
            <div class="card-banner-wrap">
                ${badgeHtml}
                <div class="card-banner-blur" style="background-image: url('${imageUrl}')"></div>
                <div class="card-banner" style="background-image: url('${imageUrl}')"></div>
            </div>
            <div class="card-body" style="padding-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
                    <h3 class="card-title" style="font-size:1.2em; margin-bottom: 0; line-height: 1.2;">${list.title}</h3>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        ${viewsHtml}
                        ${likeBtn}
                    </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap: 8px; margin-top: 5px;">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span class="card-badge">${list.category || 'Senator Wear'}</span>
                    </div>
                    <span style="font-size:0.8em; color:var(--brand-slate); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display: inline-flex; align-items: center;" title="${shopName}">
                        ${avatarIconHtml}${shopName}
                    </span>
                </div>

                <p class="card-desc" style="font-size: 0.85em; margin-bottom: 6px;">${list.description || 'Individually crafted.'}</p>
                <div class="card-footer" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <div class="price-views-wrap" style="display: flex; flex-direction: column; gap: 2px;">
                        ${list.original_price && parseFloat(list.original_price) > parseFloat(list.price) ? `
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="text-decoration: line-through; color: var(--brand-slate); font-size: 0.85em;">Ksh ${parseFloat(list.original_price).toLocaleString()}</span>
                                <span class="price-tag" style="color: #ef4444; font-weight: 700; font-size: 1.1em; line-height: 1;">Ksh ${parseFloat(list.price).toLocaleString()}</span>
                            </div>
                        ` : `
                            <span class="price-tag" style="color: var(--brand-gold); font-weight: 700; font-size: 1.1em;">${list.price ? 'Ksh ' + parseFloat(list.price).toLocaleString() : 'Negotiable'}</span>
                        `}
                    </div>
                    <a href="../../views/manager/shop.html?id=${list.shop_id}&inquire=${list.id}" class="card-btn" onclick="event.stopPropagation(); trackListingView('${list.id || ''}', '../../views/manager/shop.html?id=${list.shop_id}&inquire=${list.id}'); return false;">Inquire Now <i class="fas fa-envelope"></i></a>
                </div>
            </div>
        </div>`;
}

// Generate Deals Horizontal Scroller HTML helper
function getDealsScrollerHtml() {
    const dealListings = allMarketplaceListings.filter(list => list.original_price && parseFloat(list.original_price) > parseFloat(list.price));
    if (dealListings.length === 0) return '';

    const displayedDeals = dealListings.slice(0, 8);
    const cardsHtml = displayedDeals.map(list => `<div style="flex: 0 0 240px; scroll-snap-align: start;">${getListingCardHtml(list)}</div>`).join('');

    return `
        <div class="scroller-section">
            <div class="scroller-section-title">
                <span><i class="fas fa-fire fire-icon"></i> Top Deals &amp; Exclusive Discounts</span>
            </div>
            <div class="horizontal-scroller">
                ${cardsHtml}
            </div>
        </div>
    `;
}

// Generate Shop Spotlight Banner HTML helper
function getShopSpotlightBannerHtml() {
    if (allMarketplaceShops.length === 0) return '';
    const shopsWithBanner = allMarketplaceShops.filter(s => s.banner_image && s.banner_image.trim() !== '' && !s.banner_image.endsWith('/'));
    const selectedShop = shopsWithBanner.length > 0 ? shopsWithBanner[Math.floor(Math.random() * shopsWithBanner.length)] : allMarketplaceShops[0];
    if (!selectedShop) return '';

    const STORAGE_URL = `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/marketplace-assets/`;
    const bannerUrl = selectedShop.banner_image && selectedShop.banner_image.trim() !== '' && !selectedShop.banner_image.endsWith('/')
        ? (selectedShop.banner_image.startsWith('http') ? selectedShop.banner_image : STORAGE_URL + selectedShop.banner_image)
        : 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=1000';

    return `
        <div class="promo-banner-section">
            <div class="promo-banner" style="background-image: url('${bannerUrl}')">
                <div class="promo-content">
                    <span class="promo-tag"><i class="fas fa-award"></i> In-App Premium Spotlight</span>
                    <h3 class="promo-title">${escapeHTML(selectedShop.name)}</h3>
                    <p class="promo-desc">${escapeHTML(selectedShop.description || 'Discover premium custom designs, experienced tailors, and professional alterations at this top-rated bespoke house.')}</p>
                    <a href="../../views/manager/shop.html?id=${selectedShop.id}" class="promo-btn">Explore Shop <i class="fas fa-chevron-right"></i></a>
                </div>
            </div>
        </div>
    `;
}

// Generate "You may be looking for" Feed Card HTML
function getCategorySuggestionCardHtml(chunkIndex) {
    const allCategories = [
        { name: 'Suits', icon: 'fas fa-user-tie' },
        { name: 'Senator Wear', icon: 'fas fa-cut' },
            { name: 'African Attire', icon: 'fas fa-globe-africa' },
        { name: 'Dresses', icon: 'fas fa-female' },
        { name: 'Shirts', icon: 'fas fa-shirt' },
        { name: 'Trousers', icon: 'fas fa-cut' },
        { name: 'Coats', icon: 'fas fa-user-tie' },
        { name: 'Alterations', icon: 'fas fa-compress' },
        { name: 'Jumpsuits & Rompers', icon: 'fas fa-female' },
        { name: 'Activewear', icon: 'fas fa-running' },
        { name: 'Watches', icon: 'fas fa-clock' },
        { name: 'Glasses & Shades', icon: 'fas fa-glasses' },
        { name: 'Ties & Bowties', icon: 'fas fa-user-tie' },
        { name: 'Belts', icon: 'fas fa-tag' },
        { name: 'Bags & Clutches', icon: 'fas fa-briefcase' },
        { name: 'Shoes', icon: 'fas fa-shoe-prints' }
    ];

    const isWide = chunkIndex % 2 !== 0;
    const currentItemsPerCard = isWide ? 8 : 4; // Wide cards show 8 items

    const startIndex = (chunkIndex * 4) % allCategories.length; // Keep offset logic same to not skip
    const chunk = allCategories.slice(startIndex, startIndex + currentItemsPerCard);
    
    if (chunk.length < currentItemsPerCard) {
        chunk.push(...allCategories.slice(0, currentItemsPerCard - chunk.length));
    }

    const gradient = 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, var(--card-bg) 100%)';
    const cardClass = isWide ? 'card suggestion-card wide-suggestion-card' : 'card suggestion-card';

    return `
        <div class="${cardClass}" style="background: ${gradient}; padding: 16px; display: flex; flex-direction: column; gap: 14px; border: 1px solid rgba(212, 175, 55, 0.3);">
            <h3 style="font-size: 1.15em; color: var(--brand-white); margin-bottom: 2px; font-family: 'Playfair Display', serif;">You may be looking for</h3>
            <div class="suggestion-btn-container" style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
                ${chunk.map(cat => `
                    <button onclick="selectSidebarCategory('${escapeHTML(cat.name)}')" style="display: flex; align-items: center; gap: 12px; background: var(--bg-dark); border: 1px solid rgba(255,255,255,0.05); padding: 8px 14px; border-radius: 30px; cursor: pointer; transition: all 0.2s; width: 100%; text-align: left; color: var(--brand-white); box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(212, 175, 55, 0.2);">
                            <i class="${escapeHTML(cat.icon)}" style="color: var(--brand-gold); font-size: 0.9em;"></i>
                        </div>
                        <span style="font-size: 0.88em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(cat.name)}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

// Generate Featured Shops Scroller HTML helper
function getFeaturedShopsScrollerHtml() {
    if (allMarketplaceShops.length === 0) return '';
    const displayedShops = allMarketplaceShops.slice(0, 6);

    const STORAGE_URL = `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/marketplace-assets/`;
    const cardsHtml = displayedShops.map(shop => {
        const hasBanner = shop.banner_image && shop.banner_image.trim() !== '' && !shop.banner_image.endsWith('/');
        const bannerUrl = hasBanner ? (shop.banner_image.startsWith('http') ? shop.banner_image : STORAGE_URL + shop.banner_image) : null;
        const bannerStyle = bannerUrl ? `background-image: url('${bannerUrl}')` : `background: linear-gradient(135deg, var(--brand-navy, #0a192f) 0%, var(--brand-navy-light, #112240) 100%); border-bottom: 1px solid rgba(212,175,55,0.15);`;
        
        let sImg = shop.profile_image;
        if (sImg === 'undefined' || sImg === 'null') sImg = '';
        const avatarUrl = sImg ? (sImg.startsWith('http') ? sImg : STORAGE_URL + sImg) : '';
        
        let avatarHTML = avatarUrl 
            ? `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; position:absolute; top:0; left:0; z-index:2;" onerror="this.style.display='none';">
               <i class="fas fa-store" style="position:relative; z-index:1;"></i>`
            : `<i class="fas fa-store"></i>`;

        const rawLoc = shop.location_name || shop.location || 'Nairobi, Kenya';
        const formattedLoc = rawLoc.split(',').map(s => s.trim().replace(/\b\w/g, c => c.toUpperCase())).join(', ');

        const shopReviews = allMarketplaceReviews.filter(r => r.shop_id === shop.id);
        const avgRating = shopReviews.length > 0
            ? (shopReviews.reduce((sum, r) => sum + r.rating, 0) / shopReviews.length).toFixed(1)
            : null;
        const ratingBadge = avgRating
            ? `<span class="card-badge"><i class="fas fa-star" style="color: var(--brand-gold);"></i> ${avgRating}</span>`
            : `<span class="card-badge" style="background: rgba(255,255,255,0.05); color: var(--brand-slate);"><i class="far fa-star"></i> New</span>`;

        const isFavorited = userFavoriteShops.includes(shop.id);
        const favColor = isFavorited ? '#e60023' : 'rgba(255,255,255,0.75)';
        const favBtn = `
            <button class="fav-shop-btn" data-shop-id="${shop.id}" onclick="event.stopPropagation(); toggleFavoriteShop('${shop.id}')" style="position:absolute; top:12px; right:12px; z-index:10; background:rgba(6,12,24,0.65); border:none; color:${favColor}; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.9em; transition:all 0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.3);" title="${isFavorited ? 'Unpin Shop' : 'Pin Shop'}">
                <i class="fas fa-thumbtack" style="transition: transform 0.2s; transform: ${isFavorited ? 'rotate(45deg)' : 'rotate(0deg)'};"></i>
            </button>`;

        return `
            <div class="card shop-card" style="flex: 0 0 240px; scroll-snap-align: start; margin-bottom: 2px;">
                <div class="card-banner-wrap" style="height: 120px;">
                    ${favBtn}
                    <div class="card-banner" style="${bannerStyle}"></div>
                </div>
                <div class="card-avatar" style="width: 50px; height: 50px; top: 95px; left: 15px; position:absolute; overflow:hidden; border-color: ${avatarUrl ? 'var(--brand-gold)' : 'var(--glass-border)'}; display:flex; align-items:center; justify-content:center; font-size: 1.2em;">
                    ${avatarHTML}
                </div>
                <div class="card-body" style="padding-top: 30px;">
                    <h3 class="card-title" style="font-size: 1.1em; margin-bottom: 4px;">${escapeHTML(shop.name)}</h3>
                    <div class="card-location" style="font-size: 0.78em; margin-bottom: 8px;">
                        <i class="fas fa-map-marker-alt"></i> ${escapeHTML(formattedLoc)}
                    </div>
                    <div class="card-footer" style="padding-top: 6px; margin-top: auto;">
                        ${ratingBadge}
                        <a href="../../views/manager/shop.html?id=${shop.id}" class="card-btn" style="padding: 5px 10px; font-size: 0.78em;">Visit <i class="fas fa-chevron-right"></i></a>
                    </div>
                </div>
            </div>`;
    }).join('');

    return `
        <div class="scroller-section">
            <div class="scroller-section-title">
                <span><i class="fas fa-store" style="color:var(--brand-gold);"></i> 📍 Featured Tailoring Shops</span>
                <button onclick="setMarketplaceMode('shops')" style="background:transparent; border:none; color:var(--brand-gold); font-size:0.8em; font-family:'Montserrat',sans-serif; cursor:pointer; font-weight:600;">View All <i class="fas fa-arrow-right"></i></button>
            </div>
            <div class="horizontal-scroller">
                ${cardsHtml}
            </div>
        </div>
    `;
}

// Global state for lazy rendering
let marketplaceDisplayLimit = 20;
let marketplaceObserver = null;

// Render Listings Grid
function renderMarketplaceListings(listings) {
    const container = document.getElementById('marketplace-listings-container');
    if (!container) return;
    if (listings.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--brand-slate);">No designs found.</div>`;
        return;
    }

    let html = [];
    let suggestionIndex = 0;
    
    // Slice for lazy rendering
    const displayedListings = listings.slice(0, marketplaceDisplayLimit);
    
    displayedListings.forEach((list, index) => {
        html.push(getListingCardHtml(list));

        if (activeMarketplaceMode === 'listings') {
            // Inject "You may be looking for" card periodically (every 8 items starting at index 3)
            if ((index - 3) % 8 === 0) {
                html.push(getCategorySuggestionCardHtml(suggestionIndex));
                suggestionIndex++;
            }

            // Inject Top Deals after 6 items (index 5)
            if (index === 5) {
                const dealsHtml = getDealsScrollerHtml();
                if (dealsHtml) html.push(dealsHtml);
            }
            // Inject Shop Spotlight Banner after 12 items (index 11)
            if (index === 11) {
                const spotlightHtml = getShopSpotlightBannerHtml();
                if (spotlightHtml) html.push(spotlightHtml);
            }
            // Inject Featured Shops Scroller after 18 items (index 17)
            if (index === 17) {
                const shopsScrollerHtml = getFeaturedShopsScrollerHtml();
                if (shopsScrollerHtml) html.push(shopsScrollerHtml);
            }
        }
    });

    // Add invisible trigger for intersection observer if there are more items to load
    if (marketplaceDisplayLimit < listings.length) {
        html.push(`<div id="marketplace-load-trigger" style="grid-column: 1/-1; height: 20px;"></div>`);
    }

    container.innerHTML = html.join('');

    // Setup Intersection Observer for Infinite Scroll
    const trigger = document.getElementById('marketplace-load-trigger');
    if (trigger) {
        if (marketplaceObserver) marketplaceObserver.disconnect();
        marketplaceObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                marketplaceDisplayLimit += 20;
                renderMarketplaceListings(listings); // Re-render with new limit
            }
        }, { rootMargin: '200px' });
        marketplaceObserver.observe(trigger);
    }
}


// Search & Filter Controller
async function handleSearchInput() {
    const queryVal = document.getElementById('marketplace-search-query').value.trim();

    if (activeMarketplaceMode === 'shops') {
        filterMarketplace();
        return;
    }

    if (!queryVal) {
        semanticSearchResults = null;
        filterMarketplace();
        return;
    }

    // Show searching loader in input container
    const searchIcon = document.getElementById('marketplace-search-icon');
    if (searchIcon) {
        searchIcon.className = 'fas fa-spinner fa-spin';
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            // Invoke semantic-search edge function
            const response = await supabaseClient.functions.invoke('semantic-search', {
                body: { query: queryVal, matchThreshold: 0.1, matchCount: 80 }
            });

            if (response.error) throw new Error(response.error);
            
            const listingsData = response.data?.listings || [];
            semanticSearchResults = listingsData;
        } catch (err) {
            console.error("Semantic search failed, falling back to keyword search:", err);
            semanticSearchResults = null;
        } finally {
            // Restore search icon
            const searchIcon = document.getElementById('marketplace-search-icon');
            if (searchIcon) {
                searchIcon.className = 'fas fa-search';
            }
            filterMarketplace();
        }
    }, 600); // 600ms debounce
}

function filterMarketplace() {
    marketplaceDisplayLimit = 20; // Reset pagination on new search
    renderSidebarCategories();
    const query = document.getElementById('marketplace-search-query').value.toLowerCase().trim();
    const location = document.getElementById('marketplace-search-location').value.toLowerCase().trim();
    const categoryFilterEl = document.getElementById('marketplace-category-filter');
    const category = categoryFilterEl ? categoryFilterEl.value : '';
    const favoritesFilterEl = document.getElementById('marketplace-favorites-filter');
    const showFavoritesOnly = favoritesFilterEl ? favoritesFilterEl.checked : false;

    if (activeMarketplaceMode === 'shops') {
        const filteredShops = allMarketplaceShops.filter(shop => {
            if (showFavoritesOnly && !userFavoriteShops.includes(shop.id)) return false;

            const nameMatch = !query ||
                (shop.name && shop.name.toLowerCase().includes(query)) ||
                (shop.description && shop.description.toLowerCase().includes(query));

            const locMatch = !location ||
                (shop.location_name && shop.location_name.toLowerCase().includes(location)) ||
                (shop.location && shop.location.toLowerCase().includes(location));

            return nameMatch && locMatch;
        });

        // Sort Shops by Bespoke Score (Reputation + Profile Quality)
        filteredShops.sort((a, b) => calculateShopScore(b, allMarketplaceReviews, userFavoriteShops) - calculateShopScore(a, allMarketplaceReviews, userFavoriteShops));

        renderMarketplaceShops(filteredShops);
    } else {
        const filteredListings = allMarketplaceListings.filter(list => {
            if (activeMarketplaceMode === 'favourites') {
                if (!userLikes.includes(list.id)) return false;
            }

            if (showFavoritesOnly && !userFavoriteShops.includes(list.shop_id)) return false;

            let queryMatch = false;
            if (!query) {
                queryMatch = true;
            } else if (semanticSearchResults) {
                // Semantic Match: Check if the listing is in our semantic search results
                queryMatch = semanticSearchResults.some(sr => sr.id === list.id);
            } else {
                // Fallback: standard keyword matching
                queryMatch = (list.title && list.title.toLowerCase().includes(query)) ||
                    (list.description && list.description.toLowerCase().includes(query)) ||
                    (list.category && list.category.toLowerCase().includes(query));
            }

            const categoryMatch = !category || list.category === category;

            const audienceFilterEl = document.getElementById('marketplace-audience-filter');
            const audience = audienceFilterEl ? audienceFilterEl.value : '';
            let isAudienceMatch = true;
            if (audience) {
                const itemAudience = list.target_audience || 'Unisex';
                isAudienceMatch = (itemAudience === audience);
            }

            const shop = allMarketplaceShops.find(s => s.id === list.shop_id);
            const locMatch = !location || (shop && (
                (shop.location_name && shop.location_name.toLowerCase().includes(location)) ||
                (shop.location && shop.location.toLowerCase().includes(location))
            ));

            return queryMatch && categoryMatch && isAudienceMatch && locMatch;
        });

        // Sort by semantic similarity if semantic search results exist, otherwise sort by bespoke score
        if (query && semanticSearchResults) {
            filteredListings.sort((a, b) => {
                const simA = semanticSearchResults.find(sr => sr.id === a.id)?.similarity || 0;
                const simB = semanticSearchResults.find(sr => sr.id === b.id)?.similarity || 0;
                if (simB !== simA) return simB - simA; // Higher similarity first
                // Tie breaker: calculateBespokeScore
                return calculateBespokeScore(b, allMarketplaceShops, allMarketplaceReviews, globalLikesCount, userFavoriteShops) - calculateBespokeScore(a, allMarketplaceShops, allMarketplaceReviews, globalLikesCount, userFavoriteShops);
            });
        } else {
            // Algorithm: Sort by Bespoke Score (Popularity > Quality > Recency > Profile)
            filteredListings.sort((a, b) => {
                return calculateBespokeScore(b, allMarketplaceShops, allMarketplaceReviews, globalLikesCount, userFavoriteShops) - calculateBespokeScore(a, allMarketplaceShops, allMarketplaceReviews, globalLikesCount, userFavoriteShops);
            });
        }

        renderMarketplaceListings(filteredListings);
    }
}

async function toggleLike(listingId) {
    if (!currentUser) {
        alert("Please log in to like creations.");
        return;
    }
    const btn = document.getElementById(`like-btn-${listingId}`);
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (!icon) return;

    const isCurrentlyLiked = userLikes.includes(listingId);
    
    // Optimistic UI Update
    if (isCurrentlyLiked) {
        userLikes = userLikes.filter(id => id !== listingId);
        icon.className = 'far fa-heart';
        btn.style.color = 'var(--brand-slate)';
    } else {
        userLikes.push(listingId);
        icon.className = 'fas fa-heart';
        btn.style.color = '#ef4444';
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => btn.style.transform = 'scale(1)', 200);
    }

    if (activeMarketplaceMode === 'favourites') {
        filterMarketplace();
    }

    try {
        if (isCurrentlyLiked) {
            const { error } = await supabaseClient
                .from('marketplace_likes')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('listing_id', listingId);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('marketplace_likes')
                .insert([{ user_id: currentUser.id, listing_id: listingId }]);
            if (error) throw error;
        }
    } catch (err) {
        console.error("Failed to toggle like:", err);
        // Revert
        if (isCurrentlyLiked) {
            userLikes.push(listingId);
            icon.className = 'fas fa-heart';
            btn.style.color = '#ef4444';
        } else {
            userLikes = userLikes.filter(id => id !== listingId);
            icon.className = 'far fa-heart';
            btn.style.color = 'var(--brand-slate)';
        }
        if (activeMarketplaceMode === 'favourites') {
            filterMarketplace();
        }
    }
}

function updateFavoriteShopIcons(shopId, isFav) {
    const buttons = document.querySelectorAll(`button.fav-shop-btn[data-shop-id="${shopId}"]`);
    buttons.forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-thumbtack';
            icon.style.transform = isFav ? 'rotate(45deg)' : 'rotate(0deg)';
        }
        btn.style.color = isFav ? '#e60023' : 'rgba(255,255,255,0.75)';
        btn.title = isFav ? 'Unpin Shop' : 'Pin Shop';
    });
}

async function toggleFavoriteShop(shopId) {
    if (!currentUser) {
        alert("Please log in to save tailor shops.");
        return;
    }

    const isCurrentlyFavorited = userFavoriteShops.includes(shopId);

    // Optimistic UI Update: toggle local list
    if (isCurrentlyFavorited) {
        userFavoriteShops = userFavoriteShops.filter(id => id !== shopId);
    } else {
        userFavoriteShops.push(shopId);
    }

    // Update DOM icons directly in-place without triggering sorting to prevent disorienting jumps
    updateFavoriteShopIcons(shopId, !isCurrentlyFavorited);

    // Trigger filters query only if we are currently looking at "Fav Shops Only"
    const favoritesFilterEl = document.getElementById('marketplace-favorites-filter');
    if (favoritesFilterEl && favoritesFilterEl.checked) {
        filterMarketplace();
    }

    try {
        if (isCurrentlyFavorited) {
            const { error } = await supabaseClient
                .from('client_favorite_shops')
                .delete()
                .eq('client_id', currentUser.id)
                .eq('shop_id', shopId);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('client_favorite_shops')
                .insert([{ client_id: currentUser.id, shop_id: shopId }]);
            if (error) throw error;
        }
    } catch (err) {
        console.error("Failed to toggle favorite shop:", err);
        if (isCurrentlyFavorited) {
            userFavoriteShops.push(shopId);
        } else {
            userFavoriteShops = userFavoriteShops.filter(id => id !== shopId);
        }
        updateFavoriteShopIcons(shopId, isCurrentlyFavorited);
        if (favoritesFilterEl && favoritesFilterEl.checked) {
            filterMarketplace();
        }
    }
}

function setMarketplaceMode(mode) {
    activeMarketplaceMode = mode;
    const btnListings = document.getElementById('mkt-btn-listings');
    const btnShops = document.getElementById('mkt-btn-shops');
    const btnFavourites = document.getElementById('mkt-btn-favourites');
    const btnMap = document.getElementById('mkt-btn-map');
    const sectionListings = document.getElementById('mkt-section-listings');
    const sectionShops = document.getElementById('mkt-section-shops');
    const sectionMap = document.getElementById('mkt-section-map');

    if (!btnListings || !btnShops || !sectionListings || !sectionShops) return;

    btnListings.classList.remove('active');
    btnShops.classList.remove('active');
    if (btnFavourites) btnFavourites.classList.remove('active');
    if (btnMap) btnMap.classList.remove('active');
    
    if (sectionMap) sectionMap.style.display = 'none';

    if (mode === 'listings') {
        btnListings.classList.add('active');
        sectionListings.style.display = 'block';
        sectionShops.style.display = 'none';
        filterMarketplace();
    } else if (mode === 'shops') {
        btnShops.classList.add('active');
        sectionListings.style.display = 'none';
        sectionShops.style.display = 'block';
        filterMarketplace();
    } else if (mode === 'favourites') {
        btnFavourites.classList.add('active');
        sectionListings.style.display = 'block';
        sectionShops.style.display = 'none';
        filterMarketplace();
    } else if (mode === 'map') {
        if (btnMap) btnMap.classList.add('active');
        sectionListings.style.display = 'none';
        sectionShops.style.display = 'none';
        if (sectionMap) sectionMap.style.display = 'block';
        initMarketplaceMap();
    }
}

let mapboxInstance = null;
let markersLayer = null;

function initMarketplaceMap() {
    // If map already exists, just tell it to resize in case the div changed
    if (mapboxInstance) {
        setTimeout(() => mapboxInstance.invalidateSize(), 200);
        return;
    }

    // Default to Nairobi coordinates
    const defaultLat = -1.2921;
    const defaultLng = 36.8219;

    // Initialize Leaflet Map
    mapboxInstance = L.map('marketplace-map').setView([defaultLat, defaultLng], 12);

    // Use OpenStreetMap standard free tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapboxInstance);
    
    markersLayer = L.layerGroup().addTo(mapboxInstance);

    // Try to get user's actual location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                mapboxInstance.setView([userLat, userLng], 13);
                
                // Add a marker for the user
                const userIcon = L.divIcon({
                    html: '<i class="fas fa-street-view" style="color: #ef4444; font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));"></i>',
                    className: 'user-location-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 24]
                });
                L.marker([userLat, userLng], {icon: userIcon})
                 .addTo(mapboxInstance)
                 .bindPopup('<b>You are here</b>')
                 .openPopup();
                 
                loadShopsOnMap(userLat, userLng);
            },
            (error) => {
                console.warn("Geolocation denied or failed. Using default location.", error);
                loadShopsOnMap(defaultLat, defaultLng);
            }
        );
    } else {
        loadShopsOnMap(defaultLat, defaultLng);
    }
}

async function loadShopsOnMap(lat, lng) {
    if (!markersLayer) return;
    markersLayer.clearLayers();

    try {
        // Call the Supabase RPC we created in Phase 1
        const { data: shops, error } = await supabaseClient
            .rpc('get_shops_near_me', {
                user_lat: lat,
                user_lon: lng,
                radius_in_meters: 50000 // 50km radius
            });

        if (error) {
            console.error("Supabase Map RPC Error:", error);
            throw error;
        }
        
        console.log("Shops found near me:", shops);
        console.log("Number of shops:", shops ? shops.length : 0);
        // Define a custom icon for tailors
        const tailorIcon = L.divIcon({
            html: '<div style="background: var(--brand-navy); border: 2px solid var(--brand-gold); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"><i class="fas fa-cut" style="color: var(--brand-gold); font-size: 14px;"></i></div>',
            className: 'tailor-map-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        shops.forEach(shop => {
            if (shop.latitude && shop.longitude) {
                const distKm = (shop.distance_meters / 1000).toFixed(1);
                const popupContent = `
                    <div style="font-family: 'Montserrat', sans-serif; min-width: 180px;">
                        <h4 style="margin: 0 0 5px 0; color: #0a192f; font-family: 'Playfair Display', serif;">${shop.shop_name}</h4>
                        <p style="margin: 0 0 10px 0; font-size: 12px; color: #475569;">${distKm} km away</p>
                        <button onclick="viewShopDetails('${shop.id}')" style="width: 100%; background: #D4AF37; color: #fff; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">View Shop</button>
                    </div>
                `;
                L.marker([shop.latitude, shop.longitude], {icon: tailorIcon})
                 .addTo(markersLayer)
                 .bindPopup(popupContent);
            }
        });
    } catch (err) {
        console.error("Error loading shops on map:", err);
    }
}

function getMockListings() {
    return [
        {
            id: "mock-list-1",
            shop_id: allMarketplaceShops[0]?.id || "mock-shop-1",
            title: "Royal Double-Breasted Slim Fit Suit",
            description: "Handcrafted, customized wool suit including coat and matching trouser. Perfect for weddings and executive meetings.",
            price: 25000,
            category: "Suits",
            image_url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=400"
        },
        {
            id: "mock-list-2",
            shop_id: allMarketplaceShops[0]?.id || "mock-shop-1",
            title: "Bespoke Senator Wear with Embroidered Detail",
            description: "Traditional senator top and trouser set. Soft premium fabric with unique embroidery on the collar.",
            price: 8500,
            category: "Senator Wear",
            image_url: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&q=80&w=400"
        },
        {
            id: "mock-list-3",
            shop_id: allMarketplaceShops[1]?.id || "mock-shop-2",
            title: "Luxurious Emerald Evening Dress",
            description: "Elegant silk gown tailored specifically to your silhouette. Perfect styling for formal events.",
            price: 18000,
            category: "Dresses",
            image_url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=400"
        }
    ];
}

window.openListingModal = function(listingId) {
    if (typeof trackListingView === 'function') trackListingView(listingId);
    const list = allMarketplaceListings.find(l => l.id === listingId);
    if (!list) return;

    const shopFromCache = allMarketplaceShops.find(s => s.id === list.shop_id);
    const shopName = list.shops?.name || shopFromCache?.name || 'Style Shop';
    const shopProfileImg = list.shops?.profile_image || shopFromCache?.profile_image;

    const STORAGE_URL = typeof APP_CONFIG !== 'undefined' ? `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/marketplace-assets/` : '';
    const avatarImgUrl = shopProfileImg ? (shopProfileImg.startsWith('http') ? shopProfileImg : STORAGE_URL + shopProfileImg) : null;
    const avatarIconHtml = avatarImgUrl 
        ? `<img src="${avatarImgUrl}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border: 1px solid var(--brand-gold);">`
        : `<i class="fas fa-store" style="color:var(--brand-gold); font-size: 1.2em;"></i>`;

    const imageUrl = (list.image_urls && JSON.parse(list.image_urls)[0]) || list.image_url || `https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&q=80&w=800`;

    let priceHtml = '';
    if (list.original_price && parseFloat(list.original_price) > parseFloat(list.price)) {
        priceHtml = `
            <div style="display: flex; align-items: baseline; gap: 10px;">
                <span style="text-decoration: line-through; color: var(--brand-slate); font-size: 1em;">Ksh ${parseFloat(list.original_price).toLocaleString()}</span>
                <span style="color: #ef4444; font-weight: 800; font-size: 1.5em; line-height: 1;">Ksh ${parseFloat(list.price).toLocaleString()}</span>
            </div>
        `;
    } else {
        priceHtml = `
            <span style="color: var(--brand-gold); font-weight: 800; font-size: 1.5em; line-height: 1;">${list.price ? 'Ksh ' + parseFloat(list.price).toLocaleString() : 'Negotiable'}</span>
        `;
    }

    document.getElementById('modal-listing-image').src = imageUrl;
    document.getElementById('modal-listing-image-blur').src = imageUrl;
    document.getElementById('modal-listing-title').textContent = list.title || 'Listing Details';
    document.getElementById('modal-listing-desc').textContent = list.description || 'No description provided.';
    document.getElementById('modal-listing-category').textContent = list.category || 'Fashion';
    document.getElementById('modal-listing-audience').textContent = list.target_audience || 'Unisex';
    document.getElementById('modal-listing-price').innerHTML = priceHtml;
    document.getElementById('modal-shop-avatar').innerHTML = avatarIconHtml;
    document.getElementById('modal-shop-name').textContent = shopName;

    const sizingSection = document.getElementById('modal-listing-sizing-section');
    const sizeSelect = document.getElementById('modal-listing-size');
    const heightContainer = document.getElementById('modal-listing-height-container');
    const heightSelect = document.getElementById('modal-listing-height');
    const attachCheckbox = document.getElementById('modal-attach-measurements');
    
    let hasSizing = false;
    if (sizingSection) {
        // Reset sizing form
        sizeSelect.innerHTML = '<option value="">Select Size...</option>';
        heightSelect.innerHTML = '<option value="">Select Height...</option>';
        attachCheckbox.checked = false;
        
        // Hide checkbox if no measurements saved
        if (attachCheckbox && attachCheckbox.parentElement) {
            const hasSavedMeasurements = window._allSavedMeasurementProfiles && Object.keys(window._allSavedMeasurementProfiles).length > 0;
            attachCheckbox.parentElement.style.display = hasSavedMeasurements ? 'flex' : 'none';
        }
        
        if (list.size_charts && list.size_charts.size_data) {
            hasSizing = true;
            let sizes = [];
            if (Array.isArray(list.size_charts.size_data)) {
                sizes = list.size_charts.size_data.map(item => item.size).filter(Boolean);
            } else if (typeof list.size_charts.size_data === 'object') {
                sizes = Object.keys(list.size_charts.size_data);
            }
            
            sizes.forEach(sz => {
                sizeSelect.innerHTML += `<option value="${sz}">${sz}</option>`;
            });
            
            if (list.category && list.category.toLowerCase().includes('trouser') || list.category?.toLowerCase().includes('suit') || list.title?.toLowerCase().includes('trouser') || list.title?.toLowerCase().includes('suit')) {
                heightContainer.style.display = 'block';
                ['Short', 'Regular', 'Tall'].forEach(hName => {
                    heightSelect.innerHTML += `<option value="${hName}">${hName}</option>`;
                });
            } else {
                heightContainer.style.display = 'none';
            }
        }
        
        sizingSection.style.display = hasSizing ? 'block' : 'none';
    }

    const inquireBtn = document.getElementById('modal-inquire-btn');
    inquireBtn.onclick = function(e) {
        e.preventDefault();
        
        let queryParams = `?id=${list.shop_id}&inquire=${list.id}`;
        
        if (hasSizing) {
            if (sizeSelect.value) queryParams += `&sz=${encodeURIComponent(sizeSelect.value)}`;
            if (heightSelect.value) queryParams += `&ht=${encodeURIComponent(heightSelect.value)}`;
            if (attachCheckbox.checked) queryParams += `&attach=true`;
        }
        
        window.location.href = `../../views/manager/shop.html${queryParams}`;
    };

    const visitBtn = document.getElementById('modal-visit-shop-btn');
    if (visitBtn) {
        visitBtn.href = `../../views/manager/shop.html?id=${list.shop_id}&listing=${list.id}`;
    }

    const overlay = document.getElementById('listing-modal-overlay');
    overlay.classList.add('active');
};

window.closeListingModal = function() {
    const overlay = document.getElementById('listing-modal-overlay');
    overlay.classList.remove('active');
};

document.getElementById('listing-modal-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeListingModal();
    }
});


window.addEventListener('popstate', (event) => {
    const catName = event.state?.category || '';
    const select = document.getElementById('marketplace-category-filter');
    if (select) {
        select.value = catName;
        if (activeMarketplaceMode === 'shops' || activeMarketplaceMode === 'favourites') {
            setMarketplaceMode('listings');
        } else {
            filterMarketplace();
        }
    }
});
