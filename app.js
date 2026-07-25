// ==========================================
// 📋 COPY & SHARE FUNCTIONS (FINAL CLEAN)
// ==========================================




// ==========================================
// 🛠️ CORE UTILITIES
// ==========================================
// ==========================================

function initDebugger() { }

window.cycleCardImage = function(listingId, direction) {
    const wrap = document.getElementById(`card-img-wrap-${listingId}`);
    if (!wrap) return;
    const imagesStr = wrap.getAttribute('data-images');
    if (!imagesStr) return;
    
    try {
        const images = JSON.parse(imagesStr);
        if (images.length <= 1) return;
        
        let currentIndex = parseInt(wrap.getAttribute('data-current-idx') || '0');
        currentIndex += direction;
        
        if (currentIndex >= images.length) currentIndex = 0;
        if (currentIndex < 0) currentIndex = images.length - 1;
        
        wrap.setAttribute('data-current-idx', currentIndex);
        
        const newImgUrl = images[currentIndex];
        const imgEl = wrap.querySelector('.listing-img');
        const blurEl = wrap.querySelector('.listing-img-blur');
        
        if (imgEl) imgEl.style.backgroundImage = `url('${newImgUrl}')`;
        if (blurEl) blurEl.style.backgroundImage = `url('${newImgUrl}')`;
    } catch (e) {
        console.error("Error cycling image:", e);
    }
};

function formatMeasurements(json) {
    try {
        if (!json || json === '{}') return 'No measurements recorded';

        let m = JSON.parse(json);
        // Handle double-encoded JSON from legacy migrations
        if (typeof m === 'string') {
            try { m = JSON.parse(m); } catch (e) { }
        }

        let h = '';
        for (let k in m) {
            h += `<div class="dm-meas-card" style="break-inside: avoid; margin-bottom: 6px; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box;">
                    <b class="dm-meas-header" style="color: var(--brand-navy); font-size: 0.9em; text-transform: uppercase; border-bottom: 2px solid var(--brand-gold); padding-bottom: 5px; display: inline-block; margin-bottom: 8px; width: 100%;">${k} Details</b>
                    <div style="display: grid; grid-template-columns: repeat(3, auto); gap: 8px 35px; justify-content: flex-start;">`;
            for (let s in m[k]) {
                h += `<div class="dm-meas-field" style="display: flex; flex-direction: column; border-bottom: 1px dashed #cbd5e1; padding: 4px 0; min-width: 60px;">
                        <span class="dm-meas-label" style="color:#64748b; font-size: 0.85em; margin-bottom: 2px;">${s}</span> 
                        <b class="dm-meas-value" style="color:var(--brand-navy); font-size: 0.95em;">${m[k][s]}"</b>
                      </div>`;
            }
            h += '</div></div>';
        }
        return h || 'No measurements';
    } catch (e) {
        return 'Invalid measurement data';
    }
}


function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Invalid date';
    }
}



// ==========================================
// ðŸ”„ VIEW MANAGEMENT
// ==========================================

function refreshCurrentView() {
    const path = window.location.pathname;
    logDebug(`Refreshing view for: ${path}`, null, 'info');

    if (path.includes('manager-dashboard')) {
        loadOrders('open');
    } else if (path.includes('all-orders')) {
        loadOrders('all');
    } else if (path.includes('admin-current-orders')) {
        loadAdminOrders('current');
    } else if (path.includes('admin-orders')) {
        loadAdminOrders('current');
    } else if (path.includes('admin-all-orders')) {
        loadAdminOrders('all');
    } else if (path.includes('admin-dashboard')) {
        loadAdminDashboard();
    } else if (path.includes('admin-order-details')) {
        loadAdminOrderDetails();
    } else if (path.includes('order-details')) {
        if (USER_PROFILE?.role === 'owner') {
            loadAdminOrderDetails();
        } else {
            loadOrderDetailsScreen();
        }

    } else if (path.includes('financial-overview')) {
        loadAnalyticsDashboard();
    } else if (path.includes('admin-management')) {
        loadAdminManagementScreen();
    } else if (path.includes('admin-clients')) {
        loadClients();
    } else if (path.includes('admin-inventory')) {
        loadInventoryScreen();
    } else if (path.includes('worker-management')) {
        loadWorkerScreen();
    } else if (path.includes('admin-expenses')) {
        loadAdminExpensesScreen();
    } else if (path.includes('admin-settings')) {
        if (typeof initSettingsPage === 'function') initSettingsPage();
    } else if (path.includes('expenses')) {
        loadExpensesScreen();
    } else if (path.includes('worker-assignments')) {
        loadWorkerAssignments();
    } else if (path.includes('order-form')) {
        if (USER_PROFILE?.role === 'owner') {
            initAdminOrderForm();
        } else {
            initOrderForm();
        }
    } else if (path.includes('admin-analytics')) {
        loadBIAnalytics();
    }
}

function addRefreshButton() {
    // Refresh buttons are now built into header HTML, so this function is kept for compatibility
    // but no longer adds the button programmatically
}

// ==========================================
// ðŸ‘‘ SUPERADMIN MODULE
// ==========================================











async function updateLastSeen() {
    if (!USER_PROFILE || !USER_PROFILE.id) return;

    // Throttle: Only update if last update was more than 1 minute ago
    const lastUpdate = localStorage.getItem('last_seen_update');
    const now = Date.now();
    if (lastUpdate && (now - parseInt(lastUpdate)) < 60000) return;

    try {
        await supabaseClient
            .from('user_profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', USER_PROFILE.id);
        
        localStorage.setItem('last_seen_update', now.toString());
    } catch (err) {
        console.error("Heartbeat error:", err);
    }
}



function getRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}





;

;

;

;

// ==========================================
// ðŸ‘” MANAGER MODULE - ORDERS
// ==========================================



// ==========================================
// ðŸ‘” MANAGER MODULE - WORKER MANAGEMENT
// ==========================================




// [NEW] Load Workers into Checkbox List for Squad Selection






// ==========================================
// ðŸ‘” MANAGER MODULE - ORDER FORM
// ==========================================



function generateMeasurementFieldsManager() {
    const garmentType = document.getElementById('garment-type-select').value;
    const container = document.getElementById('measurement-fields-container');
    const fieldset = document.getElementById('measurement-fieldset');

    if (!container || !garmentType) return;

    if (fieldset) {
        fieldset.style.display = 'block';
    }

    const measurements = GARMENT_MEASUREMENTS[garmentType];
    if (!measurements) {
        container.innerHTML = '<p>No measurements needed for this garment type.</p>';
        return;
    }

    let html = '';
    for (const [component, fields] of Object.entries(measurements)) {
        html += `<div class="measurement-group">
            <h4>${component}</h4>
            <div class="measurement-fields">`;

        fields.forEach(field => {
            html += `
                <div class="measurement-field">
                    <label>${field}</label>
                    <input type="number" step="0.1" placeholder="inches" 
                           data-component="${component}" data-measurement="${field}">
                </div>
            `;
        });

        html += '</div></div>';
    }
    container.innerHTML = html;

    // [NEW] Intelligently auto-fill measurements if there's a selected client with history for this garment
    if (window.CURRENT_SELECTED_CLIENT) {
        autoFillMeasurementsIfAvailable('measurement-fields-container', garmentType);
    }
}

// ==========================================
// ðŸ‘” MANAGER MODULE - EXPENSES
// ==========================================





// ==========================================
// ðŸ‘” MANAGER MODULE - ORDER DETAILS
// ==========================================



// ==========================================
// ðŸ“„ RECEIPT SYSTEM (CORE LOGIC FOR GENERATE RECEIPT FIX)
// ==========================================





;















async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN ORDERS

// Redundant loadAdminOrders removed - moved and updated below at line 2082






// ==========================================













// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN ORDERS
// ==========================================



// [NEW] Tracking Link Sharing Function



// [NEW] Debounce Helper for Search
let adminSearchTimeout = null;
;





// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN ORDER DETAILS (FIXED)
// ==========================================







// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN MANAGEMENT
// ==========================================





;

// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN ORDER FORM
// ==========================================

























// ==========================================
// ðŸ’° PAYMENT FUNCTIONS
// ==========================================

;

;

// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN ORDER DETAILS (FINAL VERSION)
// ==========================================









// ==========================================
// ðŸ“„ INVOICING ENGINE â€” NUCLEAR REWRITE
// Uses window.open + browser print (pixel-perfect, no html2canvas bugs)
// ==========================================

/**
 * Builds a complete, standalone print-ready HTML page for invoices & requisitions.
 * Opens it in a new window and triggers the browser's print dialog.
 */


/**
 * Opens the invoice in a new window and triggers the browser print dialog.
 * Works for both expense requisitions and order invoices.
 */


// â”€â”€â”€ EXPENSE REQUISITION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

;

// â”€â”€â”€ ORDER INVOICE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

;



// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN MANAGEMENT
// ==========================================

















;

// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN ORDER FORM
// ==========================================







// ==========================================
// ðŸ‘‘ OWNER MODULE - ADMIN EXPENSES
// ==========================================















// ==========================================
// ðŸš€ MODERN BI & ANALYTICS MODULE
// ==========================================


























// ==========================================
// ðŸ’° PAYMENT FUNCTIONS
// ==========================================

;

;

// ==========================================
// ðŸ APPLICATION INITIALIZATION
// ==========================================




window.addEventListener('DOMContentLoaded', function () {
    // --- 🎨 AUTO-BRANDING (Master Template Feature) ---
    if (typeof APP_CONFIG !== 'undefined') {
        // B. Update Dashboard Sidebar (Initial guess from config)
        updateSidebarBranding();

        // C. Update Login Screen (If on login page) [NEW FIX]
        const loginName = document.getElementById('dynamic-login-name');
        if (loginName) {
            loginName.textContent = APP_CONFIG.appName;
            loginName.style.fontSize = "1.8em";
        }

        const loginSubtitle = document.getElementById('dynamic-login-subtitle');
        if (loginSubtitle) loginSubtitle.textContent = APP_CONFIG.appSubtitle;
    }

    logDebug("DOM loaded, initializing application", null, 'info');

    // Initialize debugger (now just for compatibility)
    initDebugger();

    // Setup login form
    const loginForm = document.getElementById('auth-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Enable login button
    const loginBtn = document.getElementById('login-button');
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }

    // Setup logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Setup new order button (manager)
    const addOrderBtn = document.getElementById('add-order-btn');
    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/views/manager/order-form.html';
        });
    }

    // Setup filters
    const filterIds = [
        'admin-shop-filter', 'admin-status-filter',
        'financial-shop-filter', 'shop-filter',
        'status-filter', 'worker-filter'
    ];

    filterIds.forEach(id => {
        const filter = document.getElementById(id);
        if (filter) {
            filter.addEventListener('change', () => {
                const path = window.location.pathname;

                if (id.includes('financial')) {
                    loadAnalyticsDashboard();
                }
                else if (id.includes('admin')) {
                    if (id === 'admin-shop-filter') {
                        const shopSelect = document.getElementById('admin-shop-filter');
                        const selectedOption = shopSelect.options[shopSelect.selectedIndex];
                        const selectedText = selectedOption?.text;
                        const businessType = selectedOption?.getAttribute('data-business-type') || 'tailor';
                        
                        // Update dynamic CRM body class
                        document.body.className = document.body.className.replace(/\bbusiness-type-\S+/g, '');
                        document.body.classList.add('business-type-' + businessType);

                        if (selectedText && !selectedText.includes('All')) {
                            updateSidebarBranding(selectedText);
                        } else {
                            updateSidebarBranding(); // Reset to default
                        }
                    }
                    if (path.includes('current-orders')) {
                        loadAdminOrders('current');
                    } else if (path.includes('all-orders')) {
                        loadAdminOrders('all');
                    }
                }
                else if (id.includes('shop-filter') && !id.includes('admin')) {
                    loadPendingClosureOrders();
                }
                else if (id.includes('status-filter') || id.includes('worker-filter')) {
                    if (path.includes('manager-dashboard')) {
                        loadOrders('open');
                    }
                    else if (path.includes('all-orders') && !path.includes('admin')) {
                        loadOrders('all');
                    }
                }
            });
        }
    });

    // Load session
    checkSession();

    // FIX 2: Explicitly attach core functions to window to prevent "ReferenceError: XXX is not defined"
    if (typeof refreshCurrentView !== 'undefined') window.refreshCurrentView = refreshCurrentView;
    if (typeof generateAndShareReceipt !== 'undefined') window.generateAndShareReceipt = generateAndShareReceipt;
    if (typeof saveAdminOrder !== 'undefined') window.saveAdminOrder = saveAdminOrder;
    if (typeof downloadOrderPDF !== 'undefined') window.downloadOrderPDF = downloadOrderPDF;
    if (typeof deleteOrder !== 'undefined') window.deleteOrder = deleteOrder;
    if (typeof openResetPasswordModal !== 'undefined') window.openResetPasswordModal = openResetPasswordModal;
    if (typeof handlePasswordReset !== 'undefined') window.handlePasswordReset = handlePasswordReset;
    if (typeof fireManager !== 'undefined') window.fireManager = fireManager;
    if (typeof deleteShop !== 'undefined') window.deleteShop = deleteShop;
    if (typeof deleteWorker !== 'undefined') window.deleteWorker = deleteWorker;
    if (typeof closeAdminModal !== 'undefined') window.closeAdminModal = closeAdminModal;
    if (typeof handleLogin !== 'undefined') window.handleLogin = handleLogin;
    if (typeof handleLogout !== 'undefined') window.handleLogout = handleLogout;

    // GLOBAL REFRESH ANIMATION
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('button[title*="Refresh"]');
        if (btn) {
            const icon = btn.querySelector('.fa-sync-alt, .fa-arrows-rotate, .fa-sync');
            if (icon) {
                icon.classList.add('fa-spin');
                setTimeout(() => icon.classList.remove('fa-spin'), 1000);
            }
        }
    });

    logDebug("Application initialized successfully", null, 'success');
});

// Clean up charts on page unload
window.addEventListener('beforeunload', function () {
    Object.values(analyticsCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (e) {
                // Ignore
            }
        }
    });
});

// ==========================================
// 💰 PAYMENT EDITING FUNCTIONS
// ==========================================

let SELECTED_PAYMENT_ID = null; // Track which payment is being edited









// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    const modal = document.getElementById('payment-edit-modal');
    if (e.target === modal) {
        closePaymentModal();
    }
});

// ==========================================
// 💰 PAYMENT DISPLAY ENHANCEMENT
// ==========================================
// This function transforms the payment history display to add edit/delete buttons


// Override the original loadAdminOrderDetails to call our enhancement
if (typeof loadAdminOrderDetails !== 'undefined') {
    const originalLoadAdminOrderDetails = loadAdminOrderDetails;
}

// ==========================================
// 🚀 NEW ANALYTICS FEATURES
// ==========================================












// ============================================
// CUSTOM INVOICE GENERATOR (Admin Dashboard)
// ============================================

window.calcCustomInvoiceTotals = function () {
    const qty = parseFloat(document.getElementById('ci-qty')?.value) || 1;
    const unitPrice = parseFloat(document.getElementById('ci-amount')?.value) || 0;
    const discount = parseFloat(document.getElementById('ci-discount')?.value) || 0;
    const deposit = parseFloat(document.getElementById('ci-deposit')?.value) || 0;

    const subtotal = qty * unitPrice;
    const balance = Math.max(0, subtotal - discount - deposit);

    const balanceInput = document.getElementById('ci-balance');
    if (balanceInput) {
        balanceInput.value = balance.toFixed(2);
    }
};

window.openCustomInvoiceModal = async function () {
    const modal = document.getElementById('custom-invoice-modal');
    if (modal) {
        // Pre-fill today's date
        const dateInput = document.getElementById('ci-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        // Attempt to auto-prefill shop payment details from database
        try {
            if (typeof USER_PROFILE !== 'undefined' && USER_PROFILE?.shop_id && typeof supabaseClient !== 'undefined') {
                const { data: shop } = await supabaseClient.from('shops')
                    .select('name, paybill_number, till_number, account_number, bank_details, payment_type')
                    .eq('id', USER_PROFILE.shop_id)
                    .single();
                if (shop) {
                    if (document.getElementById('ci-business-name')) document.getElementById('ci-business-name').value = shop.name || '';
                    if (document.getElementById('ci-bank')) document.getElementById('ci-bank').value = shop.bank_details || '';
                    if (document.getElementById('ci-account-no')) document.getElementById('ci-account-no').value = shop.account_number || '';

                    let mpesaInfo = '';
                    if (shop.payment_type === 'till' && shop.till_number) {
                        mpesaInfo = 'Till: ' + shop.till_number;
                    } else if (shop.paybill_number) {
                        mpesaInfo = 'Paybill: ' + shop.paybill_number + (shop.account_number ? ' (Acc: ' + shop.account_number + ')' : '');
                    }
                    if (document.getElementById('ci-mpesa')) document.getElementById('ci-mpesa').value = mpesaInfo;
                }
            }
        } catch (e) {
            console.error("Error pre-filling shop invoice details:", e);
        }

        calcCustomInvoiceTotals();
        modal.style.display = 'flex';
    }
};

window.closeCustomInvoiceModal = function () {
    const modal = document.getElementById('custom-invoice-modal');
    if (modal) {
        modal.style.display = 'none';
        // Clear form
        if (document.getElementById('ci-billed-to')) document.getElementById('ci-billed-to').value = '';
        if (document.getElementById('ci-phone')) document.getElementById('ci-phone').value = '';
        if (document.getElementById('ci-email')) document.getElementById('ci-email').value = '';
        if (document.getElementById('ci-description')) document.getElementById('ci-description').value = '';
        if (document.getElementById('ci-qty')) document.getElementById('ci-qty').value = '1';
        if (document.getElementById('ci-amount')) document.getElementById('ci-amount').value = '';
        if (document.getElementById('ci-discount')) document.getElementById('ci-discount').value = '0.00';
        if (document.getElementById('ci-deposit')) document.getElementById('ci-deposit').value = '0.00';
        if (document.getElementById('ci-notes')) document.getElementById('ci-notes').value = '';
    }
};

window.generateCustomInvoice = async function () {
    try {
        const billedTo = document.getElementById('ci-billed-to')?.value.trim() || '';
        const clientPhone = document.getElementById('ci-phone')?.value.trim() || '';
        const clientEmail = document.getElementById('ci-email')?.value.trim() || '';
        const description = document.getElementById('ci-description')?.value.trim() || '';
        const qtyStr = document.getElementById('ci-qty')?.value || '1';
        const amountStr = document.getElementById('ci-amount')?.value || '0';
        const dateVal = document.getElementById('ci-date')?.value || new Date().toISOString().split('T')[0];
        const discountStr = document.getElementById('ci-discount')?.value || '0';
        const depositStr = document.getElementById('ci-deposit')?.value || '0';
        const businessName = document.getElementById('ci-business-name')?.value.trim() || ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.appName) ? APP_CONFIG.appName : "Gentleman Standards");
        const bankName = document.getElementById('ci-bank')?.value.trim() || '';
        const accountNo = document.getElementById('ci-account-no')?.value.trim() || '';
        const mpesaDetails = document.getElementById('ci-mpesa')?.value.trim() || '';
        const notes = document.getElementById('ci-notes')?.value.trim() || '';

        if (!billedTo || !description || !amountStr || !dateVal) {
            return alert("Please fill in all required fields (Billed To, Description, Unit Price, and Date).");
        }

        const qty = parseFloat(qtyStr) || 1;
        const unitPrice = parseFloat(amountStr) || 0;
        const subtotal = qty * unitPrice;
        const discount = parseFloat(discountStr) || 0;
        const depositPaid = parseFloat(depositStr) || 0;
        const balanceDue = Math.max(0, subtotal - discount - depositPaid);

        const dateStr = new Date(dateVal).toLocaleDateString('en-GB');
        const invoiceId = 'CUST-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

        const btn = document.querySelector('#custom-invoice-modal button[type="submit"]');
        const origText = btn ? btn.innerHTML : '';
        if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; btn.disabled = true; }

        // Load jsPDF if not already loaded
        if (typeof window.jspdf === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // A4 = 210mm wide. 15mm margins = 180mm content width
        const pageW = 210;
        const margin = 15;
        const contentW = pageW - (margin * 2);
        let y = margin;

        const fmt = (n) => 'Ksh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtNeg = (n) => '-Ksh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // ─── HEADER ─────────────────────────────────────────────────────────
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text(businessName, margin, y + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('OFFICIAL INVOICE', margin, y + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(180, 83, 9);
        doc.text('INVOICE', pageW - margin, y + 8, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text('Date: ' + dateStr, pageW - margin, y + 15, { align: 'right' });
        doc.text('Invoice ID: #' + invoiceId, pageW - margin, y + 21, { align: 'right' });

        y += 28;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        // ─── BILL TO ────────────────────────────────────────────────────────
        const billLines = [clientPhone, clientEmail].filter(Boolean).length;
        const billBoxH = 18 + (billLines * 5);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, contentW, billBoxH, 2, 2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('BILL TO', margin + 5, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(billedTo, margin + 5, y + 13);

        let billY = y + 13;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        if (clientPhone) { billY += 5; doc.text('Phone: ' + clientPhone, margin + 5, billY); }
        if (clientEmail) { billY += 5; doc.text('Email: ' + clientEmail, margin + 5, billY); }
        y += billBoxH + 8;

        // ─── ITEMS TABLE ─────────────────────────────────────────────────────
        const colQty = margin + 95;
        const colUnit = margin + 125;
        const colAmt = pageW - margin;

        doc.setFillColor(15, 23, 42);
        doc.rect(margin, y, contentW, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('Description', margin + 3, y + 6);
        doc.text('Qty', colQty, y + 6, { align: 'center' });
        doc.text('Unit Price', colUnit + 12, y + 6, { align: 'right' });
        doc.text('Amount', colAmt, y + 6, { align: 'right' });
        y += 9;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentW, 10, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(description, margin + 3, y + 7);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(String(qty), colQty, y + 7, { align: 'center' });
        doc.text(fmt(unitPrice), colUnit + 12, y + 7, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(fmt(subtotal), colAmt, y + 7, { align: 'right' });
        y += 10;

        if (notes) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y, contentW, 8, 'F');
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text('Notes: ' + notes, margin + 3, y + 5);
            y += 8;
        }
        y += 10;

        // ─── TOTALS ──────────────────────────────────────────────────────────
        const totalsX = margin + 90;

        const drawRow = (label, value, color, bold, topBorder) => {
            if (topBorder) {
                doc.setDrawColor(15, 23, 42);
                doc.setLineWidth(0.5);
                doc.line(totalsX, y, pageW - margin, y);
                y += 3;
            }
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.setFontSize(bold ? 12 : 10);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(label, totalsX, y + 5);
            doc.text(value, pageW - margin, y + 5, { align: 'right' });
            y += 8;
        };

        drawRow('Subtotal:', fmt(subtotal), [71, 85, 105], false, false);
        if (discount > 0) drawRow('Discount:', fmtNeg(discount), [220, 38, 38], false, false);
        if (depositPaid > 0) drawRow('Deposit Paid:', fmtNeg(depositPaid), [22, 163, 74], false, false);
        drawRow('Balance Due:', fmt(balanceDue), [15, 23, 42], true, true);
        y += 8;

        // ─── PAYMENT DETAILS ─────────────────────────────────────────────────
        const payFields = [businessName, bankName, accountNo, mpesaDetails].filter(Boolean);
        if (payFields.length) {
            const payBoxH = 14 + (payFields.length * 7);
            doc.setFillColor(255, 253, 245);
            doc.roundedRect(margin, y, contentW, payBoxH, 2, 2, 'F');
            doc.setDrawColor(253, 230, 138);
            doc.setLineWidth(0.3);
            doc.roundedRect(margin, y, contentW, payBoxH, 2, 2);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(146, 64, 14);
            doc.text('PAYMENT DETAILS', margin + 5, y + 7);
            doc.line(margin + 5, y + 9, pageW - margin - 5, y + 9);

            let py = y + 14;
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);

            const payLine = (label, val) => {
                doc.setFont('helvetica', 'bold');
                const lw = doc.getTextWidth(label);
                doc.text(label, margin + 5, py);
                doc.setFont('helvetica', 'normal');
                doc.text(val, margin + 5 + lw + 1, py);
                py += 7;
            };

            if (businessName) payLine('Business Name: ', businessName);
            if (bankName) payLine('Bank: ', bankName);
            if (accountNo) payLine('Account No.: ', accountNo);
            if (mpesaDetails) payLine('M-Pesa Paybill/Till: ', mpesaDetails);

            y += payBoxH + 8;
        }

        // ─── FOOTER ──────────────────────────────────────────────────────────
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Thank you for choosing ' + businessName + '. We appreciate your business!', pageW / 2, y, { align: 'center' });

        // ─── SAVE ────────────────────────────────────────────────────────────
        let cName = billedTo.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save('Invoice_' + cName + '_' + invoiceId + '.pdf');

        if (btn) { btn.innerHTML = origText; btn.disabled = false; }
        closeCustomInvoiceModal();

    } catch (error) {
        logDebug("Error generating custom invoice", error, 'error');
        alert("An error occurred while generating the invoice: " + error.message);
        const btn = document.querySelector('#custom-invoice-modal button[type="submit"]');
        if (btn) { btn.innerHTML = '<i class="fas fa-file-pdf"></i> Download PDF Invoice'; btn.disabled = false; }
    }
};

// ==========================================
// 👔 OWNER MODULE - MANAGEMENT & SETUP
// ==========================================















