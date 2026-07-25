
// ==========================================
// ⚙️ MASTER CONFIGURATION FILE
// ==========================================

const APP_CONFIG = {
    // === 1. CONTROL SWITCH (THE KILL SWITCH) ===
    // Options: "ACTIVE" (App works) or "SUSPENDED" (Shows Payment Screen)
    SYSTEM_STATUS: "ACTIVE",

    // === 2. PAYMENT & SUPPORT DETAILS (For the Lock Screen) ===
    billing: {
        paybill: "600100",
        account: "200800",
        accountName: "TWO MILLION WAYS LTD",
        supportPhone: "0745806488"
    },

    // === 3. BRANDING IDENTITY ===
    appName: "STITCH & STYLES KENYA",
    appSubtitle: "FIND YOUR PERFECT FIT",
    logoPath: "logo.jpeg",

    // === 4. CONTACT DETAILS (For Receipts) ===
    shopPhone: "0721401495",
    currencySymbol: "Ksh",

    // === 5. BACKEND CONNECTION (Supabase) ===
    supabaseUrl: "https://ouuhirckiavcvgqlpriw.supabase.co",
    supabaseKey: "sb_publishable_cwzaqLI3RB-h_ZxVY2xFMA_bUgp5UcU",
    serviceRoleKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dWhpcmNraWF2Y3ZncWxwcml3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkxNjI0NSwiZXhwIjoyMDg5NDkyMjQ1fQ.yC10d9Lu9cNB0JALqr5WCLuWBblw_6at8vuy0MXSyWA"
};

// Global function for cycling images on garment cards
window.cycleCardImage = function(listingId, direction) {
    const wrap = document.getElementById(`card-img-wrap-${listingId}`);
    if (!wrap) return;
    
    const imagesAttr = wrap.getAttribute('data-images');
    if (!imagesAttr) return;
    
    try {
        const images = JSON.parse(imagesAttr);
        if (!images || images.length <= 1) return;
        
        let currentIdx = parseInt(wrap.getAttribute('data-current-idx') || '0', 10);
        currentIdx += direction;
        
        if (currentIdx >= images.length) currentIdx = 0;
        if (currentIdx < 0) currentIdx = images.length - 1;
        
        wrap.setAttribute('data-current-idx', currentIdx);
        
        const newUrl = images[currentIdx].startsWith('http') 
            ? images[currentIdx] 
            : `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/marketplace-assets/${images[currentIdx]}`;
            
        const blurImg = wrap.querySelector('.listing-img-blur');
        const mainImg = wrap.querySelector('.listing-img');
        
        if (blurImg) blurImg.style.backgroundImage = `url('${newUrl}')`;
        if (mainImg) mainImg.style.backgroundImage = `url('${newUrl}')`;
    } catch(e) {
        console.error("Error parsing images for cycling", e);
    }
};
