// ==========================================
// ⚡ OFFLINE DATA STORE & MUTATION QUEUE
// IndexedDB & LocalStorage Fallback for Stitch & Styles Kenya
// ==========================================

const OfflineStore = (function() {
    const DB_NAME = 'StitchStylesOfflineDB';
    const DB_VERSION = 1;
    let db = null;
    let isInitialized = false;

    // Helper: Initialize IndexedDB
    function init() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                console.warn('⚠️ IndexedDB not supported. Falling back to LocalStorage.');
                isInitialized = true;
                return resolve(false);
            }

            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.warn('⚠️ IndexedDB open error. Using LocalStorage fallback:', event.target.error);
                isInitialized = true;
                resolve(false);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                isInitialized = true;
                console.log('✅ OfflineStore IndexedDB Ready');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const dbRef = event.target.result;
                if (!dbRef.objectStoreNames.contains('table_cache')) {
                    dbRef.createObjectStore('table_cache', { keyPath: 'table' });
                }
                if (!dbRef.objectStoreNames.contains('sync_queue')) {
                    dbRef.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // Save fetched database table records locally
    async function saveCache(table, data) {
        if (!data) return;
        const entry = { table, data, timestamp: Date.now() };

        if (db && isInitialized) {
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction('table_cache', 'readwrite');
                    const store = tx.objectStore('table_cache');
                    store.put(entry);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => {
                        localStorage.setItem('stitch_cache_' + table, JSON.stringify(entry));
                        resolve(false);
                    };
                } catch (e) {
                    localStorage.setItem('stitch_cache_' + table, JSON.stringify(entry));
                    resolve(false);
                }
            });
        } else {
            localStorage.setItem('stitch_cache_' + table, JSON.stringify(entry));
            return true;
        }
    }

    // Retrieve cached database table records
    async function getCache(table) {
        if (db && isInitialized) {
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction('table_cache', 'readonly');
                    const store = tx.objectStore('table_cache');
                    const req = store.get(table);
                    req.onsuccess = () => {
                        if (req.result && req.result.data) {
                            resolve(req.result.data);
                        } else {
                            resolve(getFromLocalStorage(table));
                        }
                    };
                    req.onerror = () => resolve(getFromLocalStorage(table));
                } catch (e) {
                    resolve(getFromLocalStorage(table));
                }
            });
        } else {
            return getFromLocalStorage(table);
        }
    }

    function getFromLocalStorage(table) {
        try {
            const raw = localStorage.getItem('stitch_cache_' + table);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.data || null;
        } catch (e) {
            return null;
        }
    }

    // Queue mutation performed offline
    async function queueMutation(table, action, payload) {
        const item = { table, action, payload, timestamp: Date.now() };
        console.log(`📥 Queuing offline mutation [${action}] for table ${table}:`, payload);

        if (db && isInitialized) {
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction('sync_queue', 'readwrite');
                    const store = tx.objectStore('sync_queue');
                    store.add(item);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => {
                        queueInLocalStorage(item);
                        resolve(false);
                    };
                } catch (e) {
                    queueInLocalStorage(item);
                    resolve(false);
                }
            });
        } else {
            queueInLocalStorage(item);
            return true;
        }
    }

    function queueInLocalStorage(item) {
        try {
            const current = JSON.parse(localStorage.getItem('stitch_offline_queue') || '[]');
            current.push({ ...item, id: Date.now() });
            localStorage.setItem('stitch_offline_queue', JSON.stringify(current));
        } catch (e) {
            console.error('Failed to queue in localStorage', e);
        }
    }

    // Get all pending sync items
    async function getSyncQueue() {
        if (db && isInitialized) {
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction('sync_queue', 'readonly');
                    const store = tx.objectStore('sync_queue');
                    const req = store.getAll();
                    req.onsuccess = () => {
                        const lsQueue = JSON.parse(localStorage.getItem('stitch_offline_queue') || '[]');
                        const combined = [...(req.result || []), ...lsQueue];
                        resolve(combined);
                    };
                    req.onerror = () => {
                        resolve(JSON.parse(localStorage.getItem('stitch_offline_queue') || '[]'));
                    };
                } catch (e) {
                    resolve(JSON.parse(localStorage.getItem('stitch_offline_queue') || '[]'));
                }
            });
        } else {
            return JSON.parse(localStorage.getItem('stitch_offline_queue') || '[]');
        }
    }

    // Clear item from sync queue
    async function clearSyncQueueItem(id) {
        if (db && isInitialized && typeof id === 'number') {
            try {
                const tx = db.transaction('sync_queue', 'readwrite');
                const store = tx.objectStore('sync_queue');
                store.delete(id);
            } catch (e) {}
        }
        try {
            let lsQueue = JSON.parse(localStorage.getItem('stitch_offline_queue') || '[]');
            lsQueue = lsQueue.filter(item => item.id !== id);
            localStorage.setItem('stitch_offline_queue', JSON.stringify(lsQueue));
        } catch (e) {}
    }

    // Auto-sync queued mutations to Supabase when reconnected
    async function processSyncQueue() {
        if (!navigator.onLine || !window.supabaseClient) return;

        const queue = await getSyncQueue();
        if (!queue || queue.length === 0) return;

        console.log(`🔄 OfflineStore: Processing ${queue.length} pending offline operations...`);
        let syncedCount = 0;

        for (const item of queue) {
            try {
                const { table, action, payload, id } = item;
                let res = null;

                if (action === 'insert') {
                    res = await window.supabaseClient.from(table).insert(payload);
                } else if (action === 'update') {
                    const { matchKey, matchVal, data } = payload;
                    res = await window.supabaseClient.from(table).update(data).eq(matchKey, matchVal);
                } else if (action === 'delete') {
                    const { matchKey, matchVal } = payload;
                    res = await window.supabaseClient.from(table).delete().eq(matchKey, matchVal);
                }

                if (res && !res.error) {
                    await clearSyncQueueItem(id);
                    syncedCount++;
                } else {
                    console.warn(`⚠️ OfflineStore: Sync item #${id} failed:`, res ? res.error : 'Unknown');
                }
            } catch (e) {
                console.error('⚠️ OfflineStore: Exception syncing queue item:', e);
            }
        }

        if (syncedCount > 0) {
            console.log(`✅ OfflineStore: Successfully synced ${syncedCount} items to server.`);
            if (window.OfflineUI && typeof window.OfflineUI.showToast === 'function') {
                window.OfflineUI.showToast(`Synced ${syncedCount} offline updates to server!`);
            }
        }
    }

    // High-Level Data Helper: Fetch with cached fallback
    async function fetchWithFallback(table, fetchFn) {
        // If navigator is offline, immediately return cached data
        if (!navigator.onLine) {
            console.log(`⚡ Offline mode: Loading cached data for ${table}`);
            const cached = await getCache(table);
            return { data: cached || [], error: null, isOffline: true };
        }

        try {
            const result = await fetchFn();
            if (result && !result.error && result.data) {
                // Network fetch succeeded -> Cache results locally
                await saveCache(table, result.data);
                return { ...result, isOffline: false };
            } else if (result && result.error) {
                console.warn(`⚠️ Network fetch failed for ${table}, attempting cache fallback:`, result.error);
                const cached = await getCache(table);
                if (cached) {
                    return { data: cached, error: null, isOffline: true };
                }
            }
            return result;
        } catch (err) {
            console.warn(`⚠️ Network fetch thrown error for ${table}, attempting cache fallback:`, err);
            const cached = await getCache(table);
            return { data: cached || [], error: null, isOffline: true };
        }
    }

    // Auto-initialize
    init();

    return {
        init,
        saveCache,
        getCache,
        queueMutation,
        getSyncQueue,
        clearSyncQueueItem,
        processSyncQueue,
        fetchWithFallback
    };
})();

window.OfflineStore = OfflineStore;
