// ==========================================
// ⚡ OFFLINE UI STATUS BANNER & NOTIFICATIONS
// Stitch & Styles Kenya PWA Offline Component
// ==========================================

const OfflineUI = (function() {
    let bannerEl = null;

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupUI);
        } else {
            setupUI();
        }
    }

    function setupUI() {
        if (document.getElementById('stitch-offline-banner')) return;

        bannerEl = document.createElement('div');
        bannerEl.id = 'stitch-offline-banner';
        bannerEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 999999;
            background: linear-gradient(135deg, #1e1b18 0%, #2a2215 100%);
            color: #d4af37;
            border-bottom: 2px solid #d4af37;
            padding: 10px 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13.5px;
            font-weight: 500;
            display: none;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            transition: all 0.3s ease;
        `;

        bannerEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span id="stitch-offline-icon" style="font-size: 16px;">⚡</span>
                <span id="stitch-offline-text">You are currently offline. Displaying saved local data.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="stitch-offline-sync-btn" style="
                    background: #d4af37;
                    color: #0d0d0d;
                    border: none;
                    padding: 5px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    display: none;
                    transition: transform 0.2s ease;
                ">Sync Now</button>
                <button id="stitch-offline-close-btn" style="
                    background: transparent;
                    color: #888;
                    border: none;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 0 4px;
                ">&times;</button>
            </div>
        `;

        document.body.prepend(bannerEl);

        const syncBtn = document.getElementById('stitch-offline-sync-btn');
        const closeBtn = document.getElementById('stitch-offline-close-btn');

        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                if (window.OfflineStore) {
                    window.OfflineStore.processSyncQueue();
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                bannerEl.style.display = 'none';
            });
        }

        // Attach connectivity listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initial connectivity
        if (!navigator.onLine) {
            handleOffline();
        }
    }

    function handleOffline() {
        if (!bannerEl) setupUI();
        if (!bannerEl) return;

        const iconEl = document.getElementById('stitch-offline-icon');
        const textEl = document.getElementById('stitch-offline-text');
        const syncBtn = document.getElementById('stitch-offline-sync-btn');

        if (iconEl) iconEl.textContent = '⚡';
        if (textEl) textEl.textContent = 'Offline Mode: Displaying local cached data. Edits will sync when reconnected.';
        if (syncBtn) syncBtn.style.display = 'none';

        bannerEl.style.background = 'linear-gradient(135deg, #1e1b18 0%, #2a2215 100%)';
        bannerEl.style.borderBottomColor = '#d4af37';
        bannerEl.style.color = '#f39c12';
        bannerEl.style.display = 'flex';
    }

    function handleOnline() {
        if (!bannerEl) setupUI();
        if (!bannerEl) return;

        const iconEl = document.getElementById('stitch-offline-icon');
        const textEl = document.getElementById('stitch-offline-text');
        const syncBtn = document.getElementById('stitch-offline-sync-btn');

        if (iconEl) iconEl.textContent = '🟢';
        if (textEl) textEl.textContent = 'Back Online! Syncing saved offline changes with server...';
        if (syncBtn) syncBtn.style.display = 'inline-block';

        bannerEl.style.background = 'linear-gradient(135deg, #0d2818 0%, #164024 100%)';
        bannerEl.style.borderBottomColor = '#2ecc71';
        bannerEl.style.color = '#2ecc71';
        bannerEl.style.display = 'flex';

        // Trigger queue processing
        if (window.OfflineStore) {
            window.OfflineStore.processSyncQueue();
        }

        // Hide banner after 4 seconds
        setTimeout(() => {
            if (navigator.onLine && bannerEl) {
                bannerEl.style.display = 'none';
            }
        }, 4000);
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 25px;
            right: 25px;
            z-index: 999999;
            background: #111;
            color: #d4af37;
            border: 1px solid #d4af37;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            animation: fadeIn 0.3s ease-in-out;
        `;
        toast.textContent = '⚡ ' + message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    init();

    return {
        init,
        handleOnline,
        handleOffline,
        showToast
    };
})();

window.OfflineUI = OfflineUI;
