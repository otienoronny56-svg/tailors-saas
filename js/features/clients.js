// ==========================================
// 🏠 CLIENT DATABASE SYSTEM
// ==========================================

/**
 * Returns a modern SVG icon representing a garment type.
 * Used on measurement cards and order history rows.
 */
function getGarmentIcon(garmentType) {
    const g = (garmentType || '').toLowerCase();

    const wrap = (svg) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;background:rgba(212,175,55,0.12);border-radius:7px;flex-shrink:0;" aria-hidden="true">${svg}</span>`;

    const svgAttr = `width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

    // Suit / Senator / Kaunda
    if (g.includes('suit') || g.includes('senator') || g.includes('kaunda')) return wrap(`
        <svg ${svgAttr}>
            <path d="M5 4l3-1 4 5 4-5 3 1-2 6H5L3 4z"/>
            <rect x="5" y="10" width="14" height="11" rx="1"/>
            <line x1="12" y1="10" x2="12" y2="21"/>
        </svg>`);

    // Shirt / Blouse
    if (g.includes('shirt') || g.includes('blouse')) return wrap(`
        <svg ${svgAttr}>
            <path d="M3 5l5-2 4 4 4-4 5 2-2 5h-3v11H7V10H4z"/>
        </svg>`);

    // Dress
    if (g.includes('dress')) return wrap(`
        <svg ${svgAttr}>
            <path d="M9 3h6l3 18H6L9 3z"/>
            <path d="M9 3c0 0 1.5 3 3 4 1.5-1 3-4 3-4"/>
            <line x1="6" y1="12" x2="18" y2="12"/>
        </svg>`);

    // Trouser / Skirt / Pant
    if (g.includes('trouser') || g.includes('pant') || g.includes('skirt')) return wrap(`
        <svg ${svgAttr}>
            <path d="M5 3h14l-2 9-3 9h-4l-3-9L5 3z"/>
            <line x1="12" y1="7" x2="12" y2="21"/>
        </svg>`);

    // Coat / Jacket / Blazer / Half Coat
    if (g.includes('coat') || g.includes('jacket') || g.includes('blazer')) return wrap(`
        <svg ${svgAttr}>
            <path d="M4 5l4-2 4 5 4-5 4 2-2 7h-3v10H6V12H3z"/>
            <line x1="12" y1="8" x2="12" y2="22"/>
        </svg>`);

    // Shoes / Boots / Sandals
    if (g.includes('shoe') || g.includes('boot') || g.includes('sandal')) return wrap(`
        <svg ${svgAttr}>
            <path d="M2 18c0-3 5-8 9-8h5c3 0 6 2 6 4v2H2v-2z"/>
            <path d="M9 10V7a2 2 0 0 1 4 0v2"/>
        </svg>`);

    // Accessories / Belt / Hat / Watch
    if (g.includes('accessor') || g.includes('belt') || g.includes('hat') || g.includes('cap')) return wrap(`
        <svg ${svgAttr}>
            <path d="M2 12l8-5v10L2 12z"/>
            <path d="M22 12l-8-5v10l8-5z"/>
            <circle cx="12" cy="12" r="2"/>
        </svg>`);

    // Alteration / Repair
    if (g.includes('alteration') || g.includes('repair')) return wrap(`
        <svg ${svgAttr}>
            <circle cx="6" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <line x1="20" y1="4" x2="8.12" y2="15.88"/>
            <line x1="14.47" y1="14.48" x2="20" y2="20"/>
            <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>`);

    // Standard Size / Measurements
    if (g.includes('standard') || g.includes('size')) return wrap(`
        <svg ${svgAttr}>
            <rect x="2" y="7" width="20" height="10" rx="2"/>
            <line x1="6" y1="7" x2="6" y2="12"/>
            <line x1="10" y1="7" x2="10" y2="10"/>
            <line x1="14" y1="7" x2="14" y2="12"/>
            <line x1="18" y1="7" x2="18" y2="10"/>
        </svg>`);

    // Kanzu / Robe / Kaftan / Abaya
    if (g.includes('kanzu') || g.includes('robe') || g.includes('kaftan') || g.includes('abaya')) return wrap(`
        <svg ${svgAttr}>
            <path d="M12 3c-2 0-4 2-4 4v14h8V7c0-2-2-4-4-4z"/>
            <path d="M8 7H4l2 14M16 7h4l-2 14"/>
        </svg>`);

    // Default — sewing needle / thread
    return wrap(`
        <svg ${svgAttr}>
            <path d="M20.24 4.76a3 3 0 0 0-4.24 0L4 16.76V20h3.24L19.24 8a3 3 0 0 0 1-3.24z"/>
            <line x1="16" y1="8" x2="2" y2="22"/>
            <line x1="17.5" y1="15" x2="9" y2="15"/>
        </svg>`);
}


/**
 * Attaches a search dropdown listener to the phone number field
 * @param {string} phoneInputId - The ID of the phone input field
 */
function setupClientSearch(inputId) {
    const inputField = document.getElementById(inputId);
    if (!inputField) return;

    // Create a results container if it doesn't exist
    let resultsDiv = document.getElementById(`${inputId}-results`);
    if (!resultsDiv) {
        resultsDiv = document.createElement('div');
        resultsDiv.id = `${inputId}-results`;
        resultsDiv.className = 'search-results-popover';
        // Add some max height and scroll to handle more items comfortably
        resultsDiv.style.maxHeight = '250px';
        resultsDiv.style.overflowY = 'auto';
        inputField.parentNode.appendChild(resultsDiv);
    }

    const handleSearch = async (val) => {
        // [NEW] Clear global selected client if they start typing to avoid wrong auto-fills later
        window.CURRENT_SELECTED_CLIENT = null;

        if (val.length > 0 && val.length < 3) {
            resultsDiv.style.display = 'none';
            return;
        }

        try {
            let query = supabaseClient.from('clients').select('*');
            if (typeof USER_PROFILE !== 'undefined' && USER_PROFILE?.organization_id) {
                query = query.eq('organization_id', USER_PROFILE.organization_id);
            }

            if (val.length >= 3) {
                query = query.or(`name.ilike.%${val}%,phone.ilike.%${val}%`).limit(5);
            } else {
                // Fetch recent clients if empty input (val.length === 0)
                query = query.order('updated_at', { ascending: false }).limit(10);
            }

            const { data: clients, error } = await query;

            if (error) throw error;

            if (clients && clients.length > 0) {
                resultsDiv.innerHTML = clients.map(c => `
                    <div class="search-result-item" onclick="selectClient('${inputId}', ${JSON.stringify(c).replace(/"/g, '&quot;')})">
                        <strong>${c.phone}</strong> - ${c.name}
                    </div>
                `).join('');
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.style.display = 'none';
            }
        } catch (err) {
            console.error("Client search error:", err);
        }
    };

    inputField.addEventListener('input', (e) => handleSearch(e.target.value.trim()));
    inputField.addEventListener('focus', (e) => handleSearch(e.target.value.trim()));

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target !== inputField && e.target !== resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    });
}

/**
 * Global State to remember the selected client across garment type changes
 */
window.CURRENT_SELECTED_CLIENT = null;

/**
 * Handles selection of a client from search results
 */
window.selectClient = function (inputId, client) {
    // Save to global state immediately
    window.CURRENT_SELECTED_CLIENT = client;

    const isEdit = inputId.includes('edit');
    const phoneInputId = isEdit ? 'edit-customer-phone' : 'customer_phone';
    const nameInputId = isEdit ? 'edit-customer-name' : 'customer_name';
    const garmentSelectId = isEdit ? 'edit-garment-type' : 'garment-type-select';
    const notesAreaId = isEdit ? 'edit-preferences' : 'customer_preferences';

    const phoneInput = document.getElementById(phoneInputId);
    const nameInput = document.getElementById(nameInputId);
    const garmentSelect = document.getElementById(garmentSelectId);
    const notesArea = document.getElementById(notesAreaId);

    if (phoneInput) phoneInput.value = client.phone;
    if (nameInput) nameInput.value = client.name;
    if (notesArea) notesArea.value = client.notes || '';

    // Trigger garment change to let the generator auto-fill measurements
    if (garmentSelect) {
        if (client.last_garment_type) {
            garmentSelect.value = client.last_garment_type;
        }
        garmentSelect.dispatchEvent(new Event('change'));
    }

    const resultsDiv = document.getElementById(`${inputId}-results`);
    if (resultsDiv) resultsDiv.style.display = 'none';
};

/**
 * Helper to auto-fill measurements based on global state and selected garment.
 */
function autoFillMeasurementsIfAvailable(containerId, targetGarmentType) {
    const client = window.CURRENT_SELECTED_CLIENT;
    if (!client || !client.measurements_history) return;

    // Find the most recent history entry for this EXACT garment type
    const historyEntry = client.measurements_history.find(h => h.garment === targetGarmentType);
    if (!historyEntry) return;

    let latest = historyEntry.measurements;
    if (typeof latest === 'string') {
        try { latest = JSON.parse(latest); } catch (e) { latest = null; }
    }

    if (!latest) return;

    // Give DOM a tiny moment to render the new inputs before filling them
    setTimeout(() => {
        const container = document.getElementById(containerId);
        if (container) {
            container.querySelectorAll('input').forEach(input => {
                const comp = input.dataset.component || input.dataset.c;
                const meas = input.dataset.measurement || input.dataset.m;
                if (latest[comp] && latest[comp][meas] !== undefined && latest[comp][meas] !== null) {
                    input.value = latest[comp][meas];
                }
            });
        }
    }, 50);
}

/**
 * Loads the list of clients for the management page
 */
async function loadClients() {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    // Populate shop filter dropdown dynamically if empty
    const shopFilter = document.getElementById('client-shop-filter');
    if (shopFilter && shopFilter.options.length <= 1) {
        if (typeof loadShopsForDropdown === 'function') {
            await loadShopsForDropdown('client-shop-filter');
        }
    }

    try {
        const searchVal = document.getElementById('client-search')?.value.trim() || '';
        const shopFilterVal = shopFilter?.value || 'all';

        let query = supabaseClient.from('clients').select('*').eq('organization_id', USER_PROFILE.organization_id).order('name');

        if (searchVal) {
            query = query.or(`name.ilike.%${searchVal}%,phone.ilike.%${searchVal}%`);
        }

        if (shopFilterVal && shopFilterVal !== 'all') {
            query = query.eq('shop_id', shopFilterVal);
        }

        const { data: clients, error } = await query;
        if (error) throw error;

        // Update top mini stat cards dynamically
        updateClientMiniStats(clients || []);

        if (!clients || clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No clients found</td></tr>';
            return;
        }

        tbody.innerHTML = clients.map((c, index) => `
            <tr>
                <td style="text-align: center; color: #64748b; font-weight: 500;">${index + 1}</td>
                <td style="font-weight:bold;">${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.last_garment_type || '-'}</td>
                <td>${formatDate(c.last_visit || c.created_at)}</td>
                <td>
                    <button class="small-btn" onclick="viewClientDetails('${c.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        logDebug("Error loading clients:", error, 'error');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:red;">Error loading clients</td></tr>';
    }
}

/**
 * Calculates and updates mini stats cards dynamically on the global client database page
 */
function updateClientMiniStats(clients) {
    const totalClientsEl = document.getElementById('stat-total-clients');
    const newClientsEl = document.getElementById('stat-new-clients');
    const growthRateEl = document.getElementById('stat-growth-rate');
    if (!totalClientsEl || !newClientsEl || !growthRateEl) return;

    const total = clients.length;
    totalClientsEl.textContent = total;

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const newThisMonth = clients.filter(c => c.created_at && new Date(c.created_at) >= startOfThisMonth).length;
    newClientsEl.textContent = newThisMonth;

    const newLastMonth = clients.filter(c => {
        if (!c.created_at) return false;
        const d = new Date(c.created_at);
        return d >= startOfLastMonth && d < startOfThisMonth;
    }).length;

    let growthText = "0%";
    let growthColor = "#3b82f6"; // Blue default

    if (newLastMonth > 0) {
        const percent = ((newThisMonth - newLastMonth) / newLastMonth) * 100;
        growthText = (percent >= 0 ? "+" : "") + percent.toFixed(1) + "%";
        growthColor = percent >= 0 ? "#10b981" : "#ef4444"; // Green or Red
    } else if (newThisMonth > 0) {
        growthText = "+" + newThisMonth + " new";
        growthColor = "#10b981"; // Green
    }

    growthRateEl.textContent = growthText;
    growthRateEl.style.color = growthColor;
}

/**
 * Shows detailed measurement history for a client in a modal
 */
async function viewClientDetails(clientId) {
    try {
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (error) throw error;

        // Fetch client order/billing history using their phone number
        let orders = [];
        if (client.phone) {
            const { data: ordersData, error: ordersError } = await supabaseClient
                .from('orders')
                .select('created_at, garment_type, price, status')
                .eq('customer_phone', client.phone)
                .order('created_at', { ascending: false });
            if (!ordersError && ordersData) {
                orders = ordersData;
            }
        }

        const modal = document.getElementById('order-modal');
        const content = modal.querySelector('.modal-content');

        // Extract unique garments for badges
        const uniqueGarments = [...new Set((client.measurements_history || []).map(h => h.garment))].filter(Boolean);
        const garmentBadges = uniqueGarments.map(g => `
            <span style="background: var(--brand-navy); color: var(--brand-gold); padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: 600; margin-right: 5px; display: inline-block;">
                ${g}
            </span>
        `).join('');

        let historyHtml = '<p style="color: #64748b; font-style: italic; text-align: center; padding: 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">No measurement history found.</p>';
        if (client.measurements_history && client.measurements_history.length > 0) {
            historyHtml = client.measurements_history.map((h, index) => {
                const auditLog = h.audit_log || [];
                const changeCount = auditLog.length;

                // Build audit log rows
                let auditRowsHtml = '';
                if (changeCount > 0) {
                    // Reverse so newest change is first
                    auditRowsHtml = [...auditLog].reverse().map((entry, i) => {
                        const isClient = entry.source === 'client';
                        const sourceBadge = isClient
                            ? `<span style="background:#dbeafe; color:#1d4ed8; padding:1px 7px; border-radius:10px; font-size:0.75em; font-weight:700;"><i class="fas fa-mobile-alt" style="margin-right:3px;"></i>Client App</span>`
                            : `<span style="background:#f3e8ff; color:#7e22ce; padding:1px 7px; border-radius:10px; font-size:0.75em; font-weight:700;"><i class="fas fa-user-edit" style="margin-right:3px;"></i>Staff</span>`;

                        // Build field diff
                        const prev = entry.previous_measurements || {};
                        const curr = h.measurements || {};
                        let diffHtml = '';
                        const allCats = new Set([...Object.keys(prev), ...Object.keys(curr)]);
                        allCats.forEach(cat => {
                            const prevCat = prev[cat] || {};
                            const currCat = curr[cat] || {};
                            const allKeys = new Set([...Object.keys(prevCat), ...Object.keys(currCat)]);
                            allKeys.forEach(key => {
                                const oldVal = prevCat[key] || '—';
                                const newVal = currCat[key] || '—';
                                if (oldVal !== newVal) {
                                    diffHtml += `
                                        <div style="display:flex; align-items:center; gap:6px; font-size:0.8em; padding:3px 0; border-bottom:1px solid #f1f5f9;">
                                            <span style="color:#64748b; min-width:100px;">${key}</span>
                                            <span style="color:#ef4444; text-decoration:line-through;">${oldVal}"</span>
                                            <i class="fas fa-arrow-right" style="color:#94a3b8; font-size:0.7em;"></i>
                                            <span style="color:#16a34a; font-weight:700;">${newVal}"</span>
                                        </div>`;
                                }
                            });
                        });
                        if (!diffHtml) diffHtml = `<span style="color:#94a3b8; font-size:0.8em; font-style:italic;">No field-level differences captured</span>`;

                        const entryId = `audit-diff-${client.id}-${index}-${i}`;
                        return `
                            <div style="border-bottom:1px solid #f1f5f9; padding:8px 0;">
                                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; cursor:pointer;"
                                     onclick="const el=document.getElementById('${entryId}'); el.style.display=el.style.display==='none'?'block':'none';">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        ${sourceBadge}
                                        <span style="font-size:0.82em; font-weight:600; color:#1e293b;">${entry.changed_by || 'Unknown'}</span>
                                        <span style="font-size:0.75em; color:#94a3b8; font-style:italic; text-transform:capitalize;">(${entry.changed_by_role || 'unknown'})</span>
                                    </div>
                                    <span style="font-size:0.75em; color:#64748b; white-space:nowrap;">
                                        <i class="fas fa-clock" style="margin-right:3px;"></i>
                                        ${entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-KE', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}
                                    </span>
                                </div>
                                <div id="${entryId}" style="display:none; margin-top:8px; padding:8px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
                                    <div style="font-size:0.78em; font-weight:700; color:#64748b; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.4px;">Changes Made</div>
                                    ${diffHtml}
                                </div>
                            </div>`;
                    }).join('');
                }

                const auditSection = changeCount > 0 ? `
                    <div style="margin-top:12px; border-top:1px dashed #e2e8f0; padding-top:10px;">
                        <button onclick="const el=document.getElementById('audit-log-${client.id}-${index}'); el.style.display=el.style.display==='none'?'block':'none';"
                                style="background:none; border:none; cursor:pointer; font-size:0.8em; color:#64748b; font-weight:600; display:flex; align-items:center; gap:5px; padding:0;">
                            <i class="fas fa-history" style="color:#94a3b8;"></i>
                            <span style="border-bottom:1px dashed #cbd5e1;">${changeCount} change${changeCount > 1 ? 's' : ''} recorded</span>
                        </button>
                        <div id="audit-log-${client.id}-${index}" style="display:none; margin-top:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:0.78em; font-weight:700; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.4px;">Change Log</div>
                            ${auditRowsHtml}
                        </div>
                    </div>` : '';

                return `
                <div class="history-item" id="history-item-${index}" style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; margin-bottom: 20px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span style="font-weight: 800; color: var(--brand-navy); font-size: 1.1em; text-transform: uppercase; letter-spacing: 0.5px; display:flex; align-items:center; gap:8px;">
                            ${getGarmentIcon(h.garment)}${h.garment}
                        </span>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            ${changeCount > 0 ? `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:10px; font-size:0.75em; font-weight:700;"><i class="fas fa-history" style="margin-right:3px;"></i>${changeCount}</span>` : ''}
                            <span style="color: #64748b; font-size: 0.85em; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; white-space: nowrap;">${formatDate(h.date || h.updated_at)}</span>
                            <button class="small-btn" onclick="editClientMeasurement('${client.id}', ${index})" style="background: #f1f5f9; color: var(--brand-navy); border: none;">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                    <div class="history-measurements" style="font-size: 0.95em; line-height: 1.6; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px;">
                        ${formatMeasurements(JSON.stringify(h.measurements))}
                    </div>
                    ${auditSection}
                </div>`;
            }).join('');
        }


        let ordersHtml = '<p style="color: #64748b; font-style: italic; text-align: center; padding: 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">No order history found.</p>';
        if (orders && orders.length > 0) {
            ordersHtml = `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; overflow-y: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); width: 100%;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9em; min-width: 400px;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 10px 15px; color: #64748b; font-weight: 600;">Date</th>
                                <th style="padding: 10px 15px; color: #64748b; font-weight: 600;">Garment</th>
                                <th style="padding: 10px 15px; color: #64748b; font-weight: 600; text-align: right;">Price</th>
                                <th style="padding: 10px 15px; color: #64748b; font-weight: 600; text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(o => {
                                // Resolve numeric status → readable word via STATUS_MAP
                                const numericStatus = Number(o.status);
                                const statusWord = !isNaN(numericStatus) && STATUS_MAP?.[numericStatus]
                                    ? STATUS_MAP[numericStatus]
                                    : String(o.status ?? 'Unknown');

                                // Map words to colors (covers both numeric-resolved and legacy text statuses)
                                const statusColorMap = {
                                    'assigned':            { bg: '#dbeafe', text: '#1d4ed8' },
                                    'in progress':         { bg: '#e0f2fe', text: '#0369a1' },
                                    'qa check':            { bg: '#fef9c3', text: '#854d0e' },
                                    'ready':               { bg: '#d1fae5', text: '#065f46' },
                                    'collected (pending)': { bg: '#ede9fe', text: '#6d28d9' },
                                    'closed':              { bg: '#f1f5f9', text: '#475569' },
                                    // Legacy text statuses
                                    'completed':           { bg: '#d1fae5', text: '#065f46' },
                                    'delivered':           { bg: '#d1fae5', text: '#065f46' },
                                    'pending':             { bg: '#fef3c7', text: '#92400e' },
                                    'cancelled':           { bg: '#fee2e2', text: '#991b1b' },
                                };
                                const color = statusColorMap[statusWord.toLowerCase()] || { bg: '#f1f5f9', text: '#475569' };

                                return `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 10px 15px; color: #64748b;">${formatDate(o.created_at)}</td>
                                        <td style="padding: 10px 15px; font-weight: 600; color: var(--brand-navy);">
                                            <span style="display:inline-flex; align-items:center; gap:6px;">
                                                <span style="font-size:1.1em;">${getGarmentIcon(o.garment_type)}</span>${o.garment_type || '-'}
                                            </span>
                                        </td>
                                        <td style="padding: 10px 15px; text-align: right; font-weight: 700; color: #0f172a;">KES ${o.price ? Number(o.price).toLocaleString() : '0'}</td>
                                        <td style="padding: 10px 15px; text-align: center;">
                                            <span style="background: ${color.bg}; color: ${color.text}; padding: 3px 10px; border-radius: 12px; font-size: 0.78em; font-weight: 700; white-space: nowrap;">
                                                ${statusWord}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}

                        </tbody>

                    </table>
                </div>
            `;
        }

        content.innerHTML = `
            <span class="close-btn" onclick="document.getElementById('order-modal').style.display='none'">&times;</span>
            <div style="padding: 10px 0; display: flex; flex-direction: column; height: 100%;">
                <div id="client-info-header" style="margin-bottom: 10px; position: relative;">
                    <div id="client-info-view">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <h2 style="color: var(--brand-navy); margin: 0 0 5px 0; font-size: 1.8em;">${client.name}</h2>
                                <p style="color: #64748b; margin: 0 0 4px 0; font-weight: 500;"><i class="fas fa-phone" style="margin-right: 8px;"></i>${client.phone}</p>
                            </div>
                            <button class="small-btn" onclick="editClientInfo('${client.id}')" style="background: #f1f5f9; color: var(--brand-navy); border: none;">
                                <i class="fas fa-user-edit"></i> Edit Info
                            </button>
                        </div>
                        <div style="margin-top: 5px;">
                            <span style="font-size: 0.78em; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600; text-transform: uppercase;">Known Garments</span>
                            ${garmentBadges || '<span style="color: #cbd5e1; font-style: italic; font-size: 0.9em;">None yet</span>'}
                        </div>
                    </div>
                </div>
                
                <div class="client-details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex: 1; align-items: start; margin-bottom: 10px;">
                    <div style="min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 2px solid var(--brand-gold); padding-bottom: 5px; margin-bottom: 12px;">
                            <h3 style="font-size: 1.1em; color: var(--brand-navy); font-weight: 700; margin: 0;">Measurement History</h3>
                            <button class="small-btn" onclick="addNewMeasurementProfile('${client.id}')" style="background: var(--brand-navy); color: var(--brand-gold); border: none;">
                                <i class="fas fa-plus"></i> Add Profile
                            </button>
                        </div>
                        <div style="max-height: 55vh; overflow-y: auto; padding-right: 5px;">
                            ${historyHtml}
                        </div>
                    </div>
                    
                    <div style="min-width: 0;">
                        <div style="border-bottom: 2px solid var(--brand-gold); padding-bottom: 5px; margin-bottom: 12px;">
                            <h3 style="font-size: 1.1em; color: var(--brand-navy); font-weight: 700; margin: 0;">Order &amp; Billing History</h3>
                        </div>
                        <div style="max-height: 55vh; overflow-y: auto; padding-right: 5px;">
                            ${ordersHtml}
                        </div>
                    </div>
                </div>

                <div id="client-notes-container">
                    ${client.notes ? `
                        <div style="background: #fff8e1; padding: 20px; border-radius: 12px; border-left: 6px solid #ffc107; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                            <strong style="display: flex; align-items: center; margin-bottom: 8px; color: #856404;"><i class="fas fa-sticky-note" style="margin-right: 10px;"></i>Client Preferences</strong>
                            <p style="margin: 0; font-size: 0.95em; color: #856404; line-height: 1.5;">${client.notes}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        const modalContent = modal.querySelector('.modal-content');
        if(modalContent) {
            modalContent.style.width = '100%';
            modalContent.style.maxWidth = '100%';
            modalContent.style.height = '100vh';
            modalContent.style.maxHeight = '100vh';
            modalContent.style.display = 'flex';
            modalContent.style.flexDirection = 'column';
            modalContent.style.padding = window.innerWidth <= 768 ? '12px 15px' : '20px 40px'; // Tight padding to reduce whitespace
            modalContent.style.borderRadius = '0';
            modalContent.style.margin = '0';
            modalContent.style.border = 'none';
            modalContent.style.boxShadow = 'none';
            modalContent.style.overflowX = 'hidden';
            modalContent.style.overflowY = 'auto';
        }

        modal.style.display = 'block';
        modal.style.padding = '0';
        modal.style.background = '#f8fafc'; // Solid background to act as a full page
        modal.style.zIndex = '99999'; // Ensure it covers everything including sidebar

    } catch (error) {
        logDebug("Error viewing client details:", error, 'error');
        alert("Error loading client details");
    }
}

/**
 * Toggles the client info section to edit mode
 */
window.editClientInfo = async function (clientId) {
    try {
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (error) throw error;

        const header = document.getElementById('client-info-header');
        header.innerHTML = `
            <div id="client-info-edit" style="background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 0.8em; font-weight: 700; color: var(--brand-navy); margin-bottom: 4px;">Client Name</label>
                    <input type="text" id="edit-client-name" value="${client.name}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 0.8em; font-weight: 700; color: var(--brand-navy); margin-bottom: 4px;">Phone Number</label>
                    <input type="text" id="edit-client-phone" value="${client.phone}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 0.8em; font-weight: 700; color: var(--brand-navy); margin-bottom: 4px;">General Notes / Preferences</label>
                    <textarea id="edit-client-notes" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; min-height: 60px;">${client.notes || ''}</textarea>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="small-btn" onclick="saveClientInfo('${clientId}')" style="background: var(--brand-navy); color: var(--brand-gold);">
                        <i class="fas fa-save"></i> Save Info
                    </button>
                    <button class="small-btn" onclick="viewClientDetails('${clientId}')" style="background: #e2e8f0; color: #475569;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
    } catch (e) {
        alert("Error: " + e.message);
    }
};

/**
 * Saves the updated client info to the database
 */
window.saveClientInfo = async function (clientId) {
    const name = document.getElementById('edit-client-name').value.trim();
    const phone = document.getElementById('edit-client-phone').value.trim();
    const notes = document.getElementById('edit-client-notes').value.trim();

    if (!name || !phone) return alert("Name and Phone are required.");

    try {
        const { error } = await supabaseClient
            .from('clients')
            .update({
                name,
                phone,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', clientId);

        if (error) throw error;

        alert("Client info updated!");
        viewClientDetails(clientId);
        if (typeof loadClients === 'function') loadClients();
    } catch (error) {
        alert("Error saving: " + error.message);
    }
};

window.openNewClientModal = function () {
    const modal = document.getElementById('new-client-modal');
    if (modal) {
        const form = document.getElementById('new-client-form');
        if (form) form.reset();
        const measContainer = document.getElementById('new-client-measurements-container');
        if (measContainer) measContainer.innerHTML = '';
        modal.style.display = 'block';
    }
};

window.closeNewClientModal = function () {
    const modal = document.getElementById('new-client-modal');
    if (modal) modal.style.display = 'none';
};

window.generateNewClientMeasurementFields = function () {
    const type = document.getElementById('new-client-garment-type').value;
    const container = document.getElementById('new-client-measurements-container');
    if (!container) return;

    if (!type) {
        container.innerHTML = '';
        return;
    }

    const measurements = GARMENT_MEASUREMENTS[type];
    if (!measurements) {
        container.innerHTML = '<p style="color: #64748b; font-style: italic; padding: 10px;">No specific measurements defined for this garment.</p>';
        return;
    }

    let h = '<div style="margin-top: 20px; border-top: 2px dashed #e2e8f0; padding-top: 20px;">';
    h += `<h3 style="font-size: 1.1em; color: var(--brand-navy); margin-bottom: 15px;">Initial Measurements for ${type}</h3>`;

    for (const cat in measurements) {
        h += `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: var(--brand-navy); font-size: 0.9em; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${cat}</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px;">
        `;
        measurements[cat].forEach(key => {
            h += `
                <div style="display: flex; flex-direction: column;">
                    <label style="font-size: 0.75em; font-weight: 700; color: var(--brand-navy); margin-bottom: 4px;">${key}</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="text" class="new-client-meas-input" data-cat="${cat}" data-key="${key}"
                               style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.9em; box-sizing: border-box;">
                        <span style="position: absolute; right: 8px; color: #94a3b8; font-size: 0.8em; font-weight: bold;">"</span>
                    </div>
                </div>
            `;
        });
        h += '</div></div>';
    }
    h += '</div>';
    container.innerHTML = h;
};

window.saveNewClient = async function (e) {
    if (e) e.preventDefault();

    const name = document.getElementById('new-client-name').value.trim();
    const phone = document.getElementById('new-client-phone').value.trim();
    const notes = document.getElementById('new-client-notes').value.trim();
    const garmentType = document.getElementById('new-client-garment-type').value;

    if (!name || !phone) return alert("Name and Phone are required.");

    try {
        const measurements = {};
        document.querySelectorAll('.new-client-meas-input').forEach(input => {
            const cat = input.dataset.cat;
            const key = input.dataset.key;
            if (input.value) {
                if (!measurements[cat]) measurements[cat] = {};
                measurements[cat][key] = input.value;
            }
        });

        const history = [];
        if (garmentType && Object.keys(measurements).length > 0) {
            history.push({
                date: new Date().toISOString(),
                garment: garmentType,
                measurements: measurements
            });
        }

        const { error } = await supabaseClient
            .from('clients')
            .insert([{
                organization_id: USER_PROFILE.organization_id, // ☝️ Multi-tenant safe
                shop_id: USER_PROFILE.shop_id || null, // ☝️ Enforced for isolated viewing
                name,
                phone,
                notes,
                measurements_history: history,
                last_garment_type: garmentType || null,
                created_at: new Date().toISOString(),
                last_visit: new Date().toISOString()
            }]);

        if (error) throw error;

        alert("Client added successfully!");
        closeNewClientModal();
        if (typeof loadClients === 'function') loadClients();
    } catch (error) {
        logDebug("Error saving new client:", error, 'error');
        alert("Error: " + error.message);
    }
};

// Helper function to generate measurement fields HTML
function generateFieldsAreaHTML(garmentType, measurementsObj) {
    const standardFields = GARMENT_MEASUREMENTS[garmentType] || {};
    let html = '<div style="margin-top: 15px;">';

    const categories = (measurementsObj && Object.keys(measurementsObj).length > 0)
        ? Object.keys({ ...standardFields, ...measurementsObj })
        : Object.keys(standardFields);

    if (categories.length === 0) {
        html += `
            <div style="background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; padding: 15px; margin-bottom: 15px; text-align: center;">
                <p style="margin: 0; color: #856404; font-size: 0.9em;">No predefined measurement fields for "${garmentType}".</p>
            </div>
        `;
    } else {
        categories.forEach(cat => {
            html += `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: var(--brand-navy); font-size: 0.9em; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${cat} Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px;">
            `;

            const stdFieldsForCat = standardFields[cat] || [];
            const existingFieldsForCat = (measurementsObj && measurementsObj[cat]) ? Object.keys(measurementsObj[cat]) : [];
            const allKeys = [...new Set([...stdFieldsForCat, ...existingFieldsForCat])];

            allKeys.forEach(key => {
                const val = (measurementsObj && measurementsObj[cat] && measurementsObj[cat][key]) ? measurementsObj[cat][key] : '';
                html += `
                    <div style="display: flex; flex-direction: column;">
                        <label style="font-size: 0.75em; font-weight: 700; color: var(--brand-navy); margin-bottom: 4px;">${key}</label>
                        <div style="position: relative; display: flex; align-items: center;">
                            <input type="text" value="${val}" class="edit-meas-input" 
                                   data-cat="${cat}" data-key="${key}"
                                   style="width: 100%; padding: 8px; padding-right: 25px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.9em; box-sizing: border-box; font-weight: 500;">
                            <span style="position: absolute; right: 8px; color: #94a3b8; font-size: 0.8em; font-weight: bold;">"</span>
                        </div>
                    </div>
                `;
            });
            html += '</div></div>';
        });
    }
    html += '</div>';
    return html;
}

/**
 * Updates the measurement fields in the edit modal when the garment type is changed.
 */
window.updateEditGarmentFields = function (clientId, historyIndex) {
    const selectElement = document.getElementById('edit-client-garment-select');
    const newGarmentType = selectElement.value;
    const fieldsArea = document.getElementById('edit-measurements-fields-area');

    // For now, we'll just regenerate the fields based on the new garment type,
    // but keep the existing values if they match a field in the new type.
    // This requires re-fetching the original measurements or passing them around.
    // For simplicity, we'll assume a fresh start for the fields,
    // but a more robust solution would merge existing values.
    // For this change, we'll just pass an empty object for measurementsObj
    // to generate blank fields for the new garment type.
    // A full implementation would involve fetching the current measurements
    // and merging them with the new garment type's standard fields.
    // However, the instruction implies just generating the fields based on the new type.

    // To preserve existing values, we need to collect them first.
    const currentMeasurements = {};
    document.querySelectorAll(`#history-item-${historyIndex} .edit-meas-input`).forEach(input => {
        const cat = input.dataset.cat;
        const key = input.dataset.key;
        if (!currentMeasurements[cat]) currentMeasurements[cat] = {};
        currentMeasurements[cat][key] = input.value;
    });

    // Now, generate HTML for the new garment type, attempting to pre-fill with currentMeasurements
    fieldsArea.innerHTML = generateFieldsAreaHTML(newGarmentType, currentMeasurements);
};


/**
 * Replaces a history item view with an edit form
 */
async function editClientMeasurement(clientId, historyIndex) {
    try {
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('name, measurements_history')
            .eq('id', clientId)
            .single();

        if (error) throw error;

        const historyItem = client.measurements_history[historyIndex];
        let measurementsObj = historyItem.measurements;
        if (typeof measurementsObj === 'string') {
            try { measurementsObj = JSON.parse(measurementsObj); } catch (e) { measurementsObj = {}; }
        }
        const garmentType = historyItem.garment || 'Suit';

        // Remove existing editor modal if any
        const existingModal = document.getElementById('meas-edit-modal');
        if (existingModal) existingModal.remove();

        const standardFields = GARMENT_MEASUREMENTS[garmentType] || {};
        const sections = Object.keys({ ...standardFields, ...(measurementsObj || {}) });

        // Build section tabs HTML
        const tabsHtml = sections.map((sec, i) => `
            <button id="meas-tab-${i}"
                onclick="window._activeMeasTab(${i})"
                style="padding: 8px 18px; border-radius: 20px; border: 1.5px solid ${i === 0 ? 'var(--brand-navy)' : '#e2e8f0'};
                       background: ${i === 0 ? 'var(--brand-navy)' : 'white'}; color: ${i === 0 ? 'var(--brand-gold)' : '#64748b'};
                       font-weight: 700; font-size: 0.85em; cursor: pointer; white-space: nowrap; transition: all 0.2s;">
                ${sec}
            </button>
        `).join('');

        // Build section panels HTML
        const panelsHtml = sections.map((sec, i) => {
            const stdKeys = (standardFields[sec] || []);
            const existingKeys = measurementsObj && measurementsObj[sec] ? Object.keys(measurementsObj[sec]) : [];
            const allKeys = [...new Set([...stdKeys, ...existingKeys])];

            const fieldsHtml = allKeys.map(key => {
                const val = (measurementsObj && measurementsObj[sec] && measurementsObj[sec][key]) ? measurementsObj[sec][key] : '';
                return `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <label style="font-size:0.75em; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">${key}</label>
                        <div style="display:flex; align-items:center; border:1.5px solid #e2e8f0; border-radius:8px; overflow:hidden; background:white; transition: border-color 0.2s;"
                             onfocusin="this.style.borderColor='var(--brand-navy)'" onfocusout="this.style.borderColor='#e2e8f0'">
                            <input type="number" inputmode="decimal" step="0.1"
                                   value="${val}"
                                   class="meas-edit-input"
                                   data-cat="${sec}" data-key="${key}"
                                   style="flex:1; padding:12px 10px; border:none; outline:none; font-size:1.1em; font-weight:700; color:#0f172a; background:transparent; width:100%;">
                            <span style="padding:0 10px; color:#94a3b8; font-size:0.85em; font-weight:600; background:#f8fafc; height:100%; display:flex; align-items:center; border-left:1px solid #e2e8f0;">"</span>
                        </div>
                    </div>`;
            }).join('');

            return `
                <div id="meas-panel-${i}" style="display:${i === 0 ? 'grid' : 'none'}; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:14px; padding:5px 0;">
                    ${fieldsHtml || '<p style="color:#94a3b8; font-style:italic; grid-column:1/-1;">No fields defined for this section.</p>'}
                </div>`;
        }).join('');

        const garmentOptions = Object.keys(GARMENT_MEASUREMENTS).map(type =>
            `<option value="${type}" ${type === garmentType ? 'selected' : ''}>${type}</option>`
        ).join('');

        const modal = document.createElement('div');
        modal.id = 'meas-edit-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 999999;
            background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; padding: 16px;
        `;
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; width: 100%; max-width: 600px;
                        max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(0,0,0,0.25); overflow: hidden;">

                <!-- Header -->
                <div style="background: var(--brand-navy); padding: 18px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
                    <div>
                        <div style="color: var(--brand-gold); font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;">Editing Measurements</div>
                        <div style="color: white; font-size: 1.2em; font-weight: 800;">${client.name || 'Client'}</div>
                    </div>
                    <button onclick="document.getElementById('meas-edit-modal').remove()"
                            style="background: rgba(255,255,255,0.1); border: none; color: white; width:34px; height:34px; border-radius:50%; font-size:1.2em; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                </div>

                <!-- Garment Type -->
                <div style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; background: #fafafa; flex-shrink:0;">
                    <label style="font-size:0.75em; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Garment Type</label>
                    <select id="meas-edit-garment-select"
                            onchange="window._refreshMeasEditModal('${clientId}', ${historyIndex})"
                            style="width:100%; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:0.95em; font-weight:700; color:var(--brand-navy); background:white; cursor:pointer;">
                        ${garmentOptions}
                    </select>
                </div>

                <!-- Section Tabs -->
                <div style="padding: 12px 20px; display: flex; gap: 8px; overflow-x: auto; flex-shrink:0; border-bottom:1px solid #f1f5f9; scrollbar-width: none;">
                    ${tabsHtml}
                </div>

                <!-- Fields Panel (scrollable) -->
                <div style="flex:1; overflow-y:auto; padding:18px 20px;" id="meas-panels-container">
                    ${panelsHtml}
                </div>

                <!-- Footer Actions -->
                <div style="padding: 14px 20px; border-top: 1px solid #f1f5f9; display:flex; gap:10px; flex-shrink:0; background:white;">
                    <button onclick="window._saveMeasEditModal('${clientId}', ${historyIndex})"
                            style="flex:1; padding: 12px; background: var(--brand-navy); color: var(--brand-gold);
                                   border: none; border-radius: 10px; font-weight: 800; font-size: 0.95em; cursor:pointer;
                                   display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                    <button onclick="document.getElementById('meas-edit-modal').remove()"
                            style="padding: 12px 20px; background: #f1f5f9; color: #64748b;
                                   border: none; border-radius: 10px; font-weight: 700; font-size: 0.95em; cursor:pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Tab switching logic
        const totalSections = sections.length;
        window._activeMeasTab = function(activeIdx) {
            for (let i = 0; i < totalSections; i++) {
                const tab = document.getElementById(`meas-tab-${i}`);
                const panel = document.getElementById(`meas-panel-${i}`);
                if (i === activeIdx) {
                    tab.style.background = 'var(--brand-navy)';
                    tab.style.color = 'var(--brand-gold)';
                    tab.style.borderColor = 'var(--brand-navy)';
                    panel.style.display = 'grid';
                } else {
                    tab.style.background = 'white';
                    tab.style.color = '#64748b';
                    tab.style.borderColor = '#e2e8f0';
                    panel.style.display = 'none';
                }
            }
        };

        // Refresh modal when garment type changes
        window._refreshMeasEditModal = function(cId, hIdx) {
            const newType = document.getElementById('meas-edit-garment-select').value;
            // Collect current values before rebuild
            const currentVals = {};
            document.querySelectorAll('#meas-panels-container .meas-edit-input').forEach(inp => {
                if (!currentVals[inp.dataset.cat]) currentVals[inp.dataset.cat] = {};
                currentVals[inp.dataset.cat][inp.dataset.key] = inp.value;
            });
            // Rebuild with new garment type
            document.getElementById('meas-edit-modal').remove();
            // Temporarily patch historyItem garment for rebuild
            editClientMeasurementWithOverride(cId, hIdx, newType, currentVals);
        };

        // Save modal values
        window._saveMeasEditModal = async function(cId, hIdx) {
            const newGarmentType = document.getElementById('meas-edit-garment-select').value;
            const measurementsObj2 = {};
            document.querySelectorAll('#meas-panels-container .meas-edit-input').forEach(inp => {
                if (inp.value.trim()) {
                    if (!measurementsObj2[inp.dataset.cat]) measurementsObj2[inp.dataset.cat] = {};
                    measurementsObj2[inp.dataset.cat][inp.dataset.key] = inp.value.trim();
                }
            });

            try {
                const { data: freshClient, error: fetchError } = await supabaseClient
                    .from('clients').select('measurements_history').eq('id', cId).single();
                if (fetchError) throw fetchError;

                const history = [...freshClient.measurements_history];
                const item = history[hIdx];
                item.garment = newGarmentType;

                // Audit log
                if (item.measurements && Object.keys(item.measurements).length > 0) {
                    if (!item.audit_log) item.audit_log = [];
                    item.audit_log.push({
                        changed_at: new Date().toISOString(),
                        changed_by: USER_PROFILE?.full_name || USER_PROFILE?.name || 'Unknown Staff',
                        changed_by_role: USER_PROFILE?.role || 'unknown',
                        source: 'staff',
                        previous_measurements: JSON.parse(JSON.stringify(item.measurements))
                    });
                }
                item.measurements = measurementsObj2;

                const { error: updateError } = await supabaseClient
                    .from('clients')
                    .update({ measurements_history: history, last_garment_type: newGarmentType, last_visit: new Date().toISOString() })
                    .eq('id', cId);
                if (updateError) throw updateError;

                document.getElementById('meas-edit-modal').remove();
                viewClientDetails(cId);
            } catch (err) {
                alert('Error saving: ' + err.message);
            }
        };

    } catch (error) {
        logDebug("Error editing measurement:", error, 'error');
        alert("Error loading measurement data for editing");
    }
}

/**
 * Rebuilds the edit modal with an overridden garment type (for garment-type switching)
 */
async function editClientMeasurementWithOverride(clientId, historyIndex, overrideGarment, overrideValues) {
    try {
        const { data: client, error } = await supabaseClient
            .from('clients').select('name, measurements_history').eq('id', clientId).single();
        if (error) throw error;

        // Temporarily override for render
        const historyItem = { ...client.measurements_history[historyIndex], garment: overrideGarment, measurements: overrideValues };
        client.measurements_history[historyIndex] = historyItem;

        await editClientMeasurement(clientId, historyIndex);

        // Re-select the correct garment type in the dropdown
        const sel = document.getElementById('meas-edit-garment-select');
        if (sel) sel.value = overrideGarment;
    } catch (e) {
        alert('Error switching garment type: ' + e.message);
    }
}


/**
 * Creates a brand new empty measurement profile for a client and opens it in edit mode
 */
window.addNewMeasurementProfile = async function(clientId) {
    try {
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (error) throw error;

        let history = client.measurements_history || [];
        
        // Insert a completely fresh blank measurement profile
        history.unshift({
            date: new Date().toISOString(),
            garment: 'Suit',
            measurements: {}
        });

        // Commit new profile skeleton immediately
        const { error: updateError } = await supabaseClient
            .from('clients')
            .update({
                measurements_history: history,
                last_garment_type: 'Suit',
                last_visit: new Date().toISOString()
            })
            .eq('id', clientId);

        if (updateError) throw updateError;
        
        // Refresh UI and instantly throw the new item into the Edit mode
        await viewClientDetails(clientId);
        setTimeout(() => {
            editClientMeasurement(clientId, 0); 
        }, 150);

    } catch (e) {
        alert("Error adding garment profile: " + e.message);
    }
}

/**
 * Generates the HTML for measurement fields based on garment type
 */
function generateFieldsAreaHTML(garmentType, existingData = {}) {
    const standardFields = GARMENT_MEASUREMENTS[garmentType] || {};
    let html = '';

    const categories = Object.keys({ ...standardFields, ...existingData });

    categories.forEach(cat => {
        html += `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: var(--brand-navy); font-size: 0.9em; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${cat} Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px;">
        `;

        const stdFieldsForCat = standardFields[cat] || [];
        const existingFieldsForCat = (existingData && existingData[cat]) ? Object.keys(existingData[cat]) : [];
        const allKeys = [...new Set([...stdFieldsForCat, ...existingFieldsForCat])];

        allKeys.forEach(key => {
            const val = (existingData && existingData[cat] && existingData[cat][key]) ? existingData[cat][key] : '';
            html += `
                <div style="display: flex; flex-direction: column;">
                    <label style="font-size: 0.75em; font-weight: 700; color: var(--brand-navy); margin-bottom: 4px;">${key}</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="text" value="${val}" class="edit-meas-input" 
                               data-cat="${cat}" data-key="${key}"
                               style="width: 100%; padding: 8px; padding-right: 25px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.9em; box-sizing: border-box; font-weight: 500;">
                        <span style="position: absolute; right: 8px; color: #94a3b8; font-size: 0.8em; font-weight: bold;">"</span>
                    </div>
                </div>
            `;
        });
        html += '</div></div>';
    });

    if (categories.length === 0) {
        html = `<p style="text-align: center; color: #64748b; font-style: italic;">No specific fields for "${garmentType}"</p>`;
    }
    return html;
}

/**
 * Dynamically updates fields when garment type is changed in edit mode
 */
window.updateEditGarmentFields = function (clientId, index) {
    const type = document.getElementById('edit-client-garment-select').value;
    const area = document.getElementById('edit-measurements-fields-area');
    if (area) {
        area.innerHTML = generateFieldsAreaHTML(type);
    }
};

/**
 * Saves updated measurements back to the client record
 */
async function saveClientMeasurement(clientId, historyIndex) {
    try {
        const { data: client, error: fetchError } = await supabaseClient
            .from('clients')
            .select('measurements_history')
            .eq('id', clientId)
            .single();

        if (fetchError) throw fetchError;

        const history = [...client.measurements_history];
        const item = history[historyIndex];

        // Capture updated garment type
        const newGarmentType = document.getElementById('edit-client-garment-select').value;
        item.garment = newGarmentType;

        const measurementsObj = {};
        const container = document.getElementById(`history-item-${historyIndex}`);
        const inputs = container.querySelectorAll('.edit-meas-input');

        inputs.forEach(input => {
            const cat = input.dataset.cat;
            const key = input.dataset.key;
            if (input.value) {
                if (!measurementsObj[cat]) measurementsObj[cat] = {};
                measurementsObj[cat][key] = input.value;
            }
        });

        // --- AUDIT TRAIL ---
        // Snapshot the previous values before overwriting (only if there was existing data)
        if (item.measurements && Object.keys(item.measurements).length > 0) {
            if (!item.audit_log) item.audit_log = [];
            item.audit_log.push({
                changed_at: new Date().toISOString(),
                changed_by: USER_PROFILE?.full_name || USER_PROFILE?.name || 'Unknown Staff',
                changed_by_role: USER_PROFILE?.role || 'unknown',
                source: 'staff', // staff edited, not client-submitted
                previous_measurements: JSON.parse(JSON.stringify(item.measurements))
            });
        }
        // --- END AUDIT TRAIL ---

        item.measurements = measurementsObj;

        const { error: updateError } = await supabaseClient
            .from('clients')
            .update({
                measurements_history: history,
                last_garment_type: newGarmentType,
                last_visit: new Date().toISOString()
            })
            .eq('id', clientId);

        if (updateError) throw updateError;
        viewClientDetails(clientId);
    } catch (error) {
        logDebug("Error saving measurement:", error, 'error');
        alert("Error saving measurement changes");
    }
}

