
// ==========================================
// 🛡️ SYSTEM INITIALIZATION
// ==========================================
let supabaseClient = null;

try {
    if (typeof APP_CONFIG === 'undefined') {
        throw new Error("CRITICAL: 'config.js' is missing or has a syntax error.");
    }

    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
        throw new Error("CRITICAL: Supabase library failed to load.");
    }

    supabaseClient = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
    window.supabaseClient = supabaseClient;

    if (APP_CONFIG.SYSTEM_STATUS === 'SUSPENDED') {
        document.body.innerHTML = `
            <style>
                body { margin: 0; background-color: #0d0d0d; color: #fff; font-family: 'Segoe UI', sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; }
                .lock-box { text-align: center; max-width: 450px; padding: 40px; border: 1px solid #D4AF37; border-radius: 12px; background: #1a1a1a; box-shadow: 0 0 30px rgba(212, 175, 55, 0.15); }
                h1 { color: #f39c12; margin-top: 0; letter-spacing: 1px; font-size: 24px; }
                .details-box { background: #252525; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border-left: 4px solid #D4AF37; }
            </style>
            
            <div class="lock-box">
                <div style="font-size: 50px; margin-bottom: 20px;">⚙️</div>
                <h1>SYSTEM MAINTENANCE</h1>
                <p style="color: #aaa; margin-bottom: 20px;">We are currently performing scheduled maintenance and database updates for <strong>${APP_CONFIG.appName}</strong>.</p>
                <div class="details-box">
                    <p style="color: #fff; margin: 0;">This dashboard is temporarily offline to ensure data safety. Normal service will resume shortly.</p>
                </div>
                <p style="font-size: 14px; color: #888;">Expected Downtime: 1-2 Hours</p>
                <p style="font-size: 12px; color: #555;">(You can refresh the page in a bit)</p>
            </div>
        `;
        throw new Error("❌ SYSTEM OFFLINE: MAINTENANCE");
    }
    window.appInitialized = true;
    console.log("✅ System Initialized Successfully");

} catch (error) {
    console.error(error);
    alert("SYSTEM CRASH: " + error.message);
}

const SHOP_CONTACT = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG.shopPhone : "";
const CURRENCY = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG.currencySymbol : "Ksh";

// getAdminClient has been replaced by the admin-proxy Edge Function.
// Inject global footer for portals
document.addEventListener('DOMContentLoaded', () => {
    const existingFooter = document.querySelector('footer');
    if (!existingFooter && !document.getElementById('global-ronny-footer')) {
        const footerText = document.createElement('div');
        footerText.id = 'global-ronny-footer';
        footerText.style.textAlign = 'center';
        footerText.style.padding = '20px';
        footerText.style.marginTop = 'auto';
        footerText.style.fontSize = '0.85em';
        footerText.style.color = 'var(--brand-slate, #8892b0)';
        
        const hasBottomNav = document.querySelector('.bottom-nav');
        if (hasBottomNav) {
            footerText.style.paddingBottom = '80px';
        }
        
        footerText.innerHTML = `&copy; 2026 Stitch & Styles Kenya. All Rights Reserved.<br>
        <a href="https://wa.me/254745806488" target="_blank" style="color: var(--brand-gold, #D4AF37); text-decoration: none; font-size: 0.9em; margin-top: 8px; display: inline-block;">Designed and Engineered by Systems By Ronny</a>`;
        
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.appendChild(footerText);
        } else {
            const loginCard = document.querySelector('.login-card');
            if(loginCard) {
                footerText.style.position = 'absolute';
                footerText.style.bottom = '15px';
                footerText.style.left = '0';
                footerText.style.right = '0';
                footerText.style.padding = '0';
                footerText.style.fontSize = '0.75em';
                document.body.appendChild(footerText);
            } else {
                document.body.appendChild(footerText);
            }
        }
    }
});

// ==========================================
// PWA INSTALLATION LOGIC (Global)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

let globalDeferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    globalDeferredPrompt = e;
    
    // Create a floating install button if it doesn't exist
    if (!document.getElementById('globalInstallBtn')) {
        const btn = document.createElement('button');
        btn.id = 'globalInstallBtn';
        btn.innerHTML = '<i class=\"fas fa-download\"></i> Install App';
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.left = '20px';
        btn.style.zIndex = '999999';
        btn.style.padding = '12px 20px';
        btn.style.background = 'var(--brand-gold, #D4AF37)';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '30px';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '8px';
        
        btn.addEventListener('click', async () => {
            btn.style.display = 'none';
            if (globalDeferredPrompt) {
                globalDeferredPrompt.prompt();
                const { outcome } = await globalDeferredPrompt.userChoice;
                console.log(\User response to the install prompt: \\);
                globalDeferredPrompt = null;
            }
        });
        
        document.body.appendChild(btn);
    }
});

window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('globalInstallBtn');
    if (btn) btn.style.display = 'none';
    globalDeferredPrompt = null;
    console.log('PWA was installed');
});
