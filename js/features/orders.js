// ==========================================
// 📦 ORDERS & RECEIPT MODULE
// Extracted from app.js
// ==========================================

function copyReceiptToClipboard(order, paymentAmount) {
    // 1. â˜¢ï¸ NUCLEAR MATH (Strict Calculation)
    const totalCost = parseFloat(order.price) || 0;
    const existingPaid = parseFloat(order.amount_paid) || 0;
    const payingNow = parseFloat(paymentAmount) || 0;

    // Logic: If DB is updated, use it. If not, sum manual.
    let realTotalPaid = 0;
    if (order.id && existingPaid >= payingNow && existingPaid > 0) {
        realTotalPaid = existingPaid;
    } else {
        realTotalPaid = existingPaid + payingNow;
    }
    const remainingBalance = totalCost - realTotalPaid;

    // 2. ðŸŽ¨ STRICT BRANDING (No Subtitles Allowed)
    // We only take the App Name. We ignore the subtitle completely.
    const shopName = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.appName)
        ? APP_CONFIG.appName.toUpperCase()
        : "SHOP RECEIPT";

    const shopPhone = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.shopPhone)
        ? APP_CONFIG.shopPhone
        : "";

    const dateStr = new Date().toLocaleDateString();

    // 3. GENERATE CLEAN TEXT
    // Format: NAME -> PHONE -> LINE -> DETAILS
    const receiptText = `
${shopName}
${shopPhone}
--------------------------------
RECEIPT: #${order.id}
DATE:    ${dateStr}
ITEM:    ${order.garment_type}
CUSTOMER:${order.customer_name}
--------------------------------
Total Cost:   ${formatCurrency(totalCost)}
Total Paid:   ${formatCurrency(realTotalPaid)}
BALANCE DUE:  ${formatCurrency(remainingBalance)}
--------------------------------
Thank you!
`.trim();

    // 4. COPY TO CLIPBOARD
    navigator.clipboard.writeText(receiptText).then(() => {
        alert("âœ… Receipt copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert("âŒ Failed to copy receipt.");
    });
}

function shareReceiptAsText(order, paymentAmount) {
    // 1. â˜¢ï¸ NUCLEAR MATH
    const totalCost = parseFloat(order.price) || 0;
    const existingPaid = parseFloat(order.amount_paid) || 0;
    const payingNow = parseFloat(paymentAmount) || 0;

    let realTotalPaid = 0;
    if (order.id && existingPaid >= payingNow && existingPaid > 0) {
        realTotalPaid = existingPaid;
    } else {
        realTotalPaid = existingPaid + payingNow;
    }
    const remainingBalance = totalCost - realTotalPaid;

    // 2. STRICT BRANDING
    const shopName = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.appName)
        ? APP_CONFIG.appName.toUpperCase()
        : "SHOP RECEIPT";

    // 3. GENERATE MESSAGE
    const message = `*${shopName}*\nReceipt #${order.id}\nDate: ${new Date().toLocaleDateString()}\n\nItem: ${order.garment_type}\nCustomer: ${order.customer_name}\n\n*Total: ${formatCurrency(totalCost)}*\n*Paid:  ${formatCurrency(realTotalPaid)}*\n*Bal:   ${formatCurrency(remainingBalance)}*\n\nThank you!`;

    // 4. SHARE OR WHATSAPP
    if (navigator.share) {
        navigator.share({
            title: `${shopName} Receipt`,
            text: message
        }).catch(console.error);
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
}

function calculateBalance(order, payments = []) {
    const totalPrice = order.price || 0;
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    return totalPrice - totalPaid;
}

async function loadOrders(mode = 'open') {
    if (!USER_PROFILE || !USER_PROFILE.shop_id) return;

    const headerTitle = document.querySelector('header h1');
    if (headerTitle) {
        if (mode === 'urgent') headerTitle.innerHTML = '🔥 Express Attention Required';
        else headerTitle.textContent = 'Manager Dashboard (Orders In Progress)';
    }

    try {
        let query = supabaseClient.from('orders')
            .select('*')
            .eq('shop_id', USER_PROFILE.shop_id)
            .order(mode === 'all' ? 'created_at' : 'due_date', { ascending: mode !== 'all' })
            .limit(mode === 'all' ? 200 : 1000);

        if (mode === 'open' || mode === 'urgent') {
            query = query.neq('status', 7);
        }

        const statusFilter = document.getElementById('status-filter')?.value;
        if (statusFilter && mode !== 'urgent') query = query.eq('status', parseInt(statusFilter));

        const workerFilter = document.getElementById('worker-filter')?.value;
        if (workerFilter) {
            query = query.or(`worker_id.eq.${workerFilter},additional_workers.cs.["${workerFilter}"]`);
        }

        let ordersData = null;
        let queryErr = null;
        try {
            const res = await query;
            ordersData = res.data;
            queryErr = res.error;
        } catch (e) {
            queryErr = e;
        }

        if (queryErr || !ordersData) {
            if (window.OfflineStore) {
                console.log("⚡ Serving orders from offline cache...");
                ordersData = (await window.OfflineStore.getCache('orders')) || [];
            } else {
                throw queryErr || new Error("Failed to load orders");
            }
        } else if (window.OfflineStore) {
            window.OfflineStore.saveCache('orders', ordersData);
        }

        let orders = ordersData;
        if (mode === 'urgent') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            orders = ordersData.filter(o => {
                if (o.status >= 5) return false;
                const due = new Date(o.due_date);
                const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                return diffDays <= 2;
            });
        }

        const tbody = document.getElementById('orders-tbody');
        if (!tbody) return;

        if (!orders.length) {
            tbody.innerHTML = mode === 'urgent'
                ? '<tr><td colspan="8" style="text-align:center; padding:30px;">✅ Good job! No express orders.</td></tr>'
                : '<tr><td colspan="8" style="text-align:center; padding:20px;">No orders found</td></tr>';
            return;
        }

        const orderIds = orders.map(o => o.id);
        const [{ data: payments }, { data: accessories }] = await Promise.all([
            supabaseClient.from('payments').select('*').is('deleted_at', null).in('order_id', orderIds),
            supabaseClient.from('order_accessories').select('*').in('order_id', orderIds)
        ]);

        const paymentsByOrder = {};
        payments?.forEach(p => {
            if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
            paymentsByOrder[p.order_id].push(p);
        });

        const accessoriesByOrder = {};
        accessories?.forEach(a => {
            if (!accessoriesByOrder[a.order_id]) accessoriesByOrder[a.order_id] = [];
            accessoriesByOrder[a.order_id].push(a);
        });
        payments?.forEach(p => {
            if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
            paymentsByOrder[p.order_id].push(p);
        });

        const workerIds = orders.map(o => o.worker_id).filter(id => id);
        let workerMap = {};
        if (workerIds.length) {
            const { data: wData } = await supabaseClient.from('workers').select('id, name').in('id', workerIds);
            wData?.forEach(w => workerMap[w.id] = w.name);
        }

        // RENDER THE TABLE
        tbody.innerHTML = orders.map(order => {
            const orderPaymentList = (paymentsByOrder[order.id] || []);
            const activePayments = orderPaymentList; // Exclude soft-deleted - done by RLS now
            const paid = activePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const orderAccessories = accessoriesByOrder[order.id] || [];
            const accTotal = orderAccessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0);
            const grandTotal = (order.price || 0);
            const balance = grandTotal - paid;

            // Traffic Light Date Logic
            const diffDays = Math.ceil((new Date(order.due_date) - new Date()) / (86400000));
            let dueDisplay = formatDate(order.due_date);

            if (order.status < 6) {
                if (diffDays < 0) {
                    dueDisplay = `<div style="color:#dc3545; font-weight:800; line-height:1.2;">
                        <i class="fas fa-exclamation-circle"></i> ${formatDate(order.due_date)} <span style="font-size:0.85em; opacity:0.9;">(${Math.abs(diffDays)})</span>
                    </div>`;
                } else if (diffDays <= 2) {
                    dueDisplay = `<div style="color:#e67e22; font-weight:800; line-height:1.2;">
                        <i class="fas fa-stopwatch"></i> ${formatDate(order.due_date)}<br>
                        <small>${diffDays === 0 ? 'DUE TODAY' : diffDays + ' days left'}</small>
                    </div>`;
                }
            }

            const workerName = order.worker_id ? (workerMap[order.worker_id] || 'Unassigned') : 'Unassigned';

            // SQUAD CALCULATION (Correctly nested inside .map)
            let squadCount = 0;
            try {
                const raw = order.additional_workers;
                if (Array.isArray(raw)) {
                    squadCount = raw.length;
                } else if (typeof raw === 'string' && raw.trim().length > 0) {
                    squadCount = JSON.parse(raw).length;
                }
            } catch (e) {
                console.warn("Skipping bad squad data for order:", order.id);
            }

            const squadBadge = squadCount > 0
                ? ' <i class="fas fa-users" style="color:#007bff; font-size:0.8em;" title="Has Team"></i>'
                : '';

            return `<tr>
                <td>#${String(order.id).slice(-6)}</td>
                <td>${order.customer_name}<br><small>${order.customer_phone}</small></td>
                <td style="width: 120px; min-width: 100px; max-width: 120px; white-space: normal; word-break: break-word;">${order.garment_type}</td>
                <td>${dueDisplay}</td>
                <td>${workerName}${squadBadge}</td>
                <td><span class="status-indicator status-${order.status}">${STATUS_MAP[order.status]}</span></td>
                <td style="color:${balance > 0 ? '#dc3545' : '#28a745'}; font-weight:bold;">${balance.toLocaleString()}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button class="small-btn" onclick="location.href='/views/manager/order-details.html?id=${order.id}'"><i class="fas fa-eye"></i> View</button>
                        <button class="small-btn" style="background:#28a745;" onclick="generateAndShareReceipt('${order.id}')"><i class="fas fa-file-invoice"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch (e) {
        console.error("Error loading orders:", e);
        logDebug("Orders display error", e, 'error');
    }
}

async function uploadInspirationPhoto(fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
    
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `inspiration/${fileName}`;
    
    const { data, error } = await supabaseClient.storage
        .from('orders')
        .upload(filePath, file);
        
    if (error) {
        console.error("Upload error:", error);
        throw new Error("Failed to upload inspiration photo: " + error.message);
    }
    
    const { data: publicUrlData } = supabaseClient.storage.from('orders').getPublicUrl(filePath);
    return publicUrlData.publicUrl;
}

function initOrderForm() {
    loadWorkersDropdown();
    loadWorkersForSquad(USER_PROFILE.shop_id); // [NEW] Load checkboxes
    loadExtrasForShop(USER_PROFILE.shop_id); // [NEW] Load inventory extras


    const garmentSelect = document.getElementById('garment-type-select');
    if (garmentSelect) garmentSelect.addEventListener('change', generateMeasurementFieldsManager);

    // Setup Client Search
    setupClientSearch('customer_phone');
    setupClientSearch('customer_name');

    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submit-order-btn');
            submitBtn.disabled = true;

            try {
                const measurements = {};
                document.querySelectorAll('#measurement-fields-container input').forEach(input => {
                    const comp = input.dataset.component; const meas = input.dataset.measurement;
                    if (!measurements[comp]) measurements[comp] = {};
                    if (input.value) measurements[comp][meas] = parseFloat(input.value);
                });

                // [NEW] Capture Squad
                const squad = Array.from(document.querySelectorAll('.squad-checkbox:checked')).map(cb => cb.value);

                // [NEW] Calculate Extras Subtotal Total
                const extras = collectSelectedExtras();
                const extrasTotal = extras.reduce((sum, e) => sum + (e.price * e.quantity), 0);
                const basePrice = parseFloat(document.getElementById('price').value) || 0;
                const finalPrice = basePrice + extrasTotal;

                let inspirationPhotoUrl = null;
                try {
                    inspirationPhotoUrl = await uploadInspirationPhoto('order-inspiration-photo');
                } catch (e) {
                    alert(e.message);
                    submitBtn.disabled = false;
                    return;
                }

                const orderData = {
                    organization_id: USER_PROFILE.organization_id, // ☝️ Multi-tenant safety
                    shop_id: USER_PROFILE.shop_id,
                    manager_id: USER_PROFILE.id,
                    customer_name: document.getElementById('customer_name').value,
                    customer_phone: document.getElementById('customer_phone').value,
                    garment_type: document.getElementById('garment-type-select').value,
                    price: finalPrice,
                    due_date: document.getElementById('due_date').value,
                    worker_id: document.getElementById('worker-select').value || null,
                    additional_workers: JSON.stringify(squad), // [NEW] Save Squad
                    status: 1,
                    customer_preferences: document.getElementById('customer_preferences').value || '',
                    description_top: document.getElementById('order-desc-top') ? document.getElementById('order-desc-top').value : '',
                    description_pant: document.getElementById('order-desc-pant') ? document.getElementById('order-desc-pant').value : '',
                    inspiration_photo_url: inspirationPhotoUrl,
                    measurements_details: JSON.stringify(measurements),
                    created_at: new Date().toISOString()
                };

                let order = null;
                try {
                    const res = await supabaseClient.from('orders').insert([orderData]).select().single();
                    if (res.error) throw res.error;
                    order = res.data;
                } catch (insertErr) {
                    if (!navigator.onLine && window.OfflineStore) {
                        order = { ...orderData, id: 'temp_' + Date.now() };
                        await window.OfflineStore.queueMutation('orders', 'insert', orderData);
                        if (window.OfflineUI) window.OfflineUI.showToast('Order saved offline. Will sync when back online!');
                    } else {
                        throw insertErr;
                    }
                }

                // --- [NEW] Save Inventory-backed Extras with Stock Deduction ---
                await saveOrderExtrasWithStock(order.id, USER_PROFILE.shop_id);


                // [NEW] Upsert Client Data
                try {
                    const { data: existingClient } = await supabaseClient.from('clients').select('*').eq('organization_id', USER_PROFILE.organization_id).eq('phone', orderData.customer_phone).maybeSingle();
                    let history = existingClient ? (existingClient.measurements_history || []) : [];
                    history.unshift({
                        date: new Date().toISOString(),
                        garment: orderData.garment_type,
                        measurements: measurements
                    });
                    history = history.slice(0, 10); // Keep last 10

                    await supabaseClient.from('clients').upsert({
                        organization_id: USER_PROFILE.organization_id, // ☝️ Multi-tenant safe
                        shop_id: orderData.shop_id, // ☝️ RLS safe
                        name: orderData.customer_name,
                        phone: orderData.customer_phone,
                        measurements_history: history,
                        last_garment_type: orderData.garment_type,
                        notes: orderData.customer_preferences,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'organization_id,phone' }); // ☝️ Updated Conflict target
                } catch (e) {
                    console.error("Error upserting client:", e);
                }

                const deposit = parseFloat(document.getElementById('deposit_paid').value) || 0;
                if (deposit > 0) {
                    await supabaseClient.from('payments').insert([{
                        organization_id: USER_PROFILE.organization_id, // ☝️ Multi-tenant safe
                        order_id: order.id,
                        manager_id: USER_PROFILE.id,
                        amount: deposit,
                        recorded_at: new Date().toISOString()
                    }]);
                }

                window.location.href = '/views/manager/manager-dashboard.html';

            } catch (error) {
                alert("Error: " + error.message);
                submitBtn.disabled = false;
            }
        };
    }
}

async function loadOrderDetailsScreen() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    if (!orderId) return;

    CURRENT_ORDER_ID = orderId;

    try {
        // Load order data
        const [{ data: order }, { data: payments }] = await Promise.all([
            supabaseClient.from('orders')
                .select('*')
                .eq('id', orderId)
                .single(),
            supabaseClient.from('payments')
                .select('*')
                .eq('order_id', orderId)
                .order('recorded_at', { ascending: false })
        ]);

        if (!order) {
            alert("Order not found");
            window.history.back();
            return;
        }

        // [NEW] Fetch Lead + Squad Logic
        let workerDisplay = 'Unassigned';
        let squadIds = [];
        try {
            const raw = order.additional_workers;
            if (Array.isArray(raw)) squadIds = raw;
            else if (typeof raw === 'string' && raw.trim().length > 0) squadIds = JSON.parse(raw);
            else squadIds = [];
        } catch (e) { console.warn('Skipping bad squad data for order:', order.id); squadIds = []; }

        let leadName = 'Unassigned';
        if (order.worker_id) {
            const { data: lead } = await supabaseClient.from('workers').select('name').eq('id', order.worker_id).single();
            if (lead) leadName = lead.name;
        }
        let squadNames = [];
        if (squadIds.length > 0) {
            const { data: squad } = await supabaseClient.from('workers').select('name').in('id', squadIds);
            if (squad) squadNames = squad.map(w => w.name);
        }
        if (squadNames.length > 0) {
            workerDisplay = `<strong>${leadName}</strong> <span style="color:#666; font-size:0.9em;">(+ ${squadNames.join(', ')})</span>`;
        } else {
            workerDisplay = leadName;
        }

        // Calculate financials
        const paid = payments ? payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
        const balance = (order.price || 0) - paid;
        const container = document.getElementById('order-detail-container');
        if (container) {
            const orderIdStr = String(order.id);
            const shortId = orderIdStr.slice(-6);

            const headerIdSpan = document.getElementById('order-id-header');
            if (headerIdSpan) {
                headerIdSpan.innerText = shortId;
            }

            container.innerHTML = `
                <div class="pro-card-header">
                    <div class="client-identity">
                        <h2>${order.customer_name}</h2>
                        <a href="tel:${order.customer_phone}">${order.customer_phone}</a>
                    </div>
                    <div>
                        <span class="status-indicator status-${order.status}">
                            ${STATUS_MAP[order.status] || `Status ${order.status}`}
                        </span>
                    </div>
                </div>
                
                <div class="financial-strip" style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                    <div class="stat-box" style="flex: 1; min-width: 120px; background: var(--card-bg, #ffffff); border: 1px solid var(--glass-border, #e2e8f0); padding: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); text-align: left;" class="dark-mode-card">
                        <small style="display: block; font-size: 0.72em; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px;">Total</small>
                        <strong style="font-size: 1.25em; color: var(--brand-navy, #0f172a);" class="dark-mode-text">Ksh ${(order.price || 0).toLocaleString()}</strong>
                    </div>
                    <div class="stat-box" style="flex: 1; min-width: 120px; background: var(--card-bg, #ffffff); border: 1px solid var(--glass-border, #e2e8f0); padding: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); text-align: left;" class="dark-mode-card">
                        <small style="display: block; font-size: 0.72em; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px;">Paid</small>
                        <strong style="font-size: 1.25em; color: #10b981;">Ksh ${paid.toLocaleString()}</strong>
                    </div>
                    <div class="stat-box" style="flex: 1; min-width: 120px; background: var(--card-bg, #ffffff); border: 1px solid var(--glass-border, #e2e8f0); padding: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); text-align: left;" class="dark-mode-card">
                        <small style="display: block; font-size: 0.72em; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px;">Balance</small>
                        <strong style="font-size: 1.25em; color: ${balance > 0 ? '#ef4444' : '#10b981'};">Ksh ${balance.toLocaleString()}</strong>
                    </div>
                </div>
                
                <div class="quick-actions-toolbar" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                    <button class="small-btn" style="flex: 1; min-width: 130px; background: #475569; border: none; color: white; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" 
                            onclick="generateAndShareReceipt('${order.id}')">
                        <i class="fas fa-file-invoice"></i> Receipt
                    </button>
                    <button class="small-btn" style="flex: 1; min-width: 130px; background: #3b82f6; border: none; color: white; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" 
                            onclick="downloadInvoicePDF('${order.id}')">
                        <i class="fas fa-file-alt"></i> Invoice
                    </button>
                    <button class="small-btn" style="flex: 1; min-width: 130px; background: #10b981; border: none; color: white; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; ${balance <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" 
                            onclick="quickPay('${order.id}', ${balance})" ${balance <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-hand-holding-usd"></i> Record Payment
                    </button>
                    <button class="small-btn" style="flex: 1; min-width: 130px; background: #f59e0b; border: none; color: white; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" 
                            onclick="updateStatus('${order.id}')">
                        <i class="fas fa-sync-alt"></i> Update Status
                    </button>
                </div>
                
                <div class="data-tabs-container">
                    <div class="data-section">
                        <h3>Order Details</h3>
                        <p><strong>Order ID:</strong> #${shortId}</p>
                        <p><strong>Garment:</strong> ${order.garment_type}</p>
                        <p><strong>Due Date:</strong> ${formatDate(order.due_date)}</p>
                        <p><strong>Assigned Worker:</strong> ${workerDisplay}</p>
                        ${order.description_top ? `<p><strong>Description (Top):</strong> ${order.description_top}</p>` : ''}
                        ${order.description_pant ? `<p><strong>Description (Pant):</strong> ${order.description_pant}</p>` : ''}
                        ${order.customer_preferences ? `<p><strong>Customer Notes:</strong> ${order.customer_preferences}</p>` : ''}
                        ${order.inspiration_photo_url ? `<p><strong>Inspiration Photo:</strong><br><a href="${order.inspiration_photo_url}" target="_blank"><img src="${order.inspiration_photo_url}" style="max-width:200px; border-radius:8px; margin-top:8px;"></a></p>` : ''}
                        <p><strong>Measurements:</strong><br>${formatMeasurements(order.measurements_details)}</p>
                    </div>
                </div>
            `;
        }

        addRefreshButton();
        logDebug("Order details loaded", { orderId }, 'success');

    } catch (error) {
        logDebug("Error loading order details:", error, 'error');
        alert("Error loading order details: " + error.message);
    }
}

function generateSimpleReceiptHTML(order, payments, paymentAmount = 0, accessories = []) {
    const dateStr = new Date().toLocaleDateString();

    // --- ☢️ NUCLEAR ARITHMETIC (Do not touch) ☢️ ---
    const accTotal = accessories ? accessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0) : 0;
    const totalCost = parseFloat(order.price) || 0; // [NEW] order.price is now the absolute total cost
    const garmentCost = Math.max(0, totalCost - accTotal); // Back-calculate garment cost
    const existingPaid = payments ? payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
    const payingNow = parseFloat(paymentAmount) || 0;

    let realTotalPaid = 0;
    if (order.id && existingPaid >= payingNow && existingPaid > 0) {
        realTotalPaid = existingPaid;
    } else {
        realTotalPaid = existingPaid + payingNow;
    }
    const remainingBalance = totalCost - realTotalPaid;

    const shopConfig = order.shops || {};
    const receiptShopName = shopConfig.name ? shopConfig.name.toUpperCase() : ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.appName) ? APP_CONFIG.appName.toUpperCase() : "FASHION HOUSE");
    const receiptPhone = shopConfig.phone_number || (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.shopPhone ? APP_CONFIG.shopPhone : "");
    const receiptLogo = shopConfig.logo_url ? `<img src="${shopConfig.logo_url}" style="height: 60px; margin-bottom: 10px;" />` : '';
    const receiptHeader = shopConfig.receipt_header_text ? `<p style="margin: 5px 0 0 0; font-size: 0.8em; font-weight: 600; color: #555;">${shopConfig.receipt_header_text}</p>` : '';

    // --- 🎨 ULTIMATE MODERN DESIGN ---
    const orderIdStr = (order.id !== undefined && order.id !== null) ? String(order.id) : '';
    let clientPhone = '';
    if (order.phone_number && String(order.phone_number).trim() !== '') clientPhone = order.phone_number;
    else if (order.customer_phone && String(order.customer_phone).trim() !== '') clientPhone = order.customer_phone;
    else clientPhone = 'N/A';

    const paidInFull = remainingBalance <= 0;
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; width: 320px; padding: 40px 35px; background: #ffffff; color: #333; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border-radius: 12px; margin: auto;">
            
            <div style="text-align: center; margin-bottom: 40px;">
                ${receiptLogo}
                <h2 style="font-size: 1.6em; margin: 0; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; color: #000;">${receiptShopName}</h2>
                ${receiptHeader}
                ${receiptPhone ? `<p style=\"margin: 10px 0 0 0; font-size: 0.8em; letter-spacing: 2px; color: #888;\">${receiptPhone}</p>` : ''}
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 35px; border-bottom: 1px solid #f0f0f0; padding-bottom: 20px;">
                <div>
                    <p style="margin: 0; font-size: 0.7em; text-transform: uppercase; color: #999; letter-spacing: 1px; font-weight: 600;">Date</p>
                    <p style="margin: 5px 0 0 0; font-size: 1em; font-weight: 500; color: #000;">${dateStr}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-size: 0.7em; text-transform: uppercase; color: #999; letter-spacing: 1px; font-weight: 600;">Order No.</p>
                    <p style="margin: 5px 0 0 0; font-size: 1em; font-weight: 500; color: #000;">#${orderIdStr.slice(0, 8).toUpperCase()}</p>
                </div>
            </div>

            <div style="margin-bottom: 35px;">
                <p style="margin: 0 0 15px 0; font-size: 0.7em; text-transform: uppercase; color: #999; letter-spacing: 1px; font-weight: 600;">Client Details</p>
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 20px; align-items: baseline; border-bottom: 1px dashed #f0f0f0; padding-bottom: 15px; margin-bottom: 15px;">
                    <span style="font-size: 0.9em; color: #777; font-weight: 500;">Name:</span>
                    <span style="font-size: 1.1em; color: #000; font-weight: 400;">${order.customer_name}</span>

                    <span style="font-size: 0.9em; color: #777; font-weight: 500;">Phone:</span>
                    <span style="font-size: 1em; color: #333; font-weight: 400;">${clientPhone}</span>
                </div>

                <p style="margin: 0 0 10px 0; font-size: 0.7em; text-transform: uppercase; color: #999; letter-spacing: 1px; font-weight: 600;">Order Breakdown</p>
                <div style="background: #fafaf9; padding: 12px; border-radius: 8px; border: 1px solid #f3f3f2;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.95em; color: #000; font-weight: 600; margin-bottom: 5px;">
                        <span>${order.garment_type}</span>
                        <span>${formatCurrency(garmentCost)}</span>
                    </div>
                    
                    ${accessories && accessories.length > 0 ? `
                        <div style="border-top: 1px solid #e7e7e6; margin-top: 8px; padding-top: 8px;">
                            <p style="margin: 0 0 4px 0; font-size: 0.7em; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing:0.5px;">Extras / Accessories</p>
                            ${accessories.map(a => `
                                <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #444; margin-bottom: 3px;">
                                    <span>• ${a.name || a.item_name} (x${a.quantity || 1})</span>
                                    <span>${formatCurrency((a.quantity || 1) * (a.price || 0))}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>

            <table style="width: 100%; border-collapse: separate; border-spacing: 0 12px; margin-bottom: 30px;">
                <tr>
                    <td style="font-size: 1em; color: #555; font-weight: 500;">Total Amount</td>
                    <td style="text-align: right; font-weight: 700; font-size: 1.2em; color: #D4AF37;">${formatCurrency(totalCost)}</td>
                </tr>
                
                ${payingNow > 0 ? `
                <tr>
                    <td style="font-size: 0.9em; color: #777;">Paid Now</td>
                    <td style="text-align: right; font-size: 1em; color: #333;">${formatCurrency(payingNow)}</td>
                </tr>
                ` : ''}

                ${paidInFull ? `
                <tr>
                    <td colspan="2" style="text-align: center; padding-top: 10px;">
                        <span style="display: inline-block; background: #e8f5e9; color: #388e3c; font-weight: 700; font-size: 1.1em; padding: 6px 18px; border-radius: 8px; letter-spacing: 1px;">PAID IN FULL</span>
                    </td>
                </tr>
                ` : `
                <tr>
                    <td style="font-size: 0.9em; color: #777; padding-top: 5px;">Total Paid</td>
                    <td style="text-align: right; font-size: 1em; color: #333; padding-top: 5px; font-weight: 500;">${formatCurrency(realTotalPaid)}</td>
                </tr>
                ${remainingBalance > 0 ? `
                <tr><td colspan="2" style="border-bottom: 1px solid #f0f0f0; padding: 5px 0;"></td></tr>
                <tr>
                    <td style="font-size: 1em; color: #000; font-weight: 600; padding-top: 15px;">Balance Due</td>
                    <td style="text-align: right; font-weight: 700; font-size: 1.3em; color: #d32f2f; padding-top: 15px;">${formatCurrency(remainingBalance)}</td>
                </tr>
                ` : ''}`}
            </table>

            <div style="text-align: center;">
                <p style="margin: 0; font-size: 0.8em; color: #999; font-style: italic; letter-spacing: 0.5px;">Thank you for your business.</p>
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #eee; font-size: 0.75em; color: #aaa;">
                    Powered by <strong>Stitch &amp; Styles Kenya</strong><br>
                    <a href="https://tailors.co.ke" style="color: #D4AF37; text-decoration: none;">www.tailors.co.ke</a>
                </div>
            </div>
        </div>
    `;
}

function generateTextReceipt(order, payments, paymentAmount = 0, accessories = []) {
    // --- Robust Math Logic (match generateSimpleReceiptHTML) ---
    const accTotal = accessories ? accessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0) : 0;
    const totalCost = parseFloat(order.price) || 0; // [NEW] Now absolute total
    const garmentCost = Math.max(0, totalCost - accTotal);
    const existingPaid = payments ? payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
    const payingNow = parseFloat(paymentAmount) || 0;
    let realTotalPaid = 0;
    if (order.id && existingPaid >= payingNow && existingPaid > 0) {
        realTotalPaid = existingPaid;
    } else {
        realTotalPaid = existingPaid + payingNow;
    }
    const remainingBalance = totalCost - realTotalPaid;

    // --- Dynamic Branding ---
    const shopConfig = order.shops || {};
    const receiptShopName = shopConfig.name 
        ? shopConfig.name.toUpperCase() 
        : ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.appName) ? APP_CONFIG.appName.toUpperCase() : "FASHION HOUSE");
    const receiptPhone = shopConfig.phone_number || (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.shopPhone ? APP_CONFIG.shopPhone : "");
    const dateStr = new Date().toLocaleDateString('en-US');

    let lines = [];
    lines.push(`${receiptShopName}`);
    if (receiptPhone) lines.push(`Phone: ${receiptPhone}`);
    lines.push('-----------------------------');
    lines.push(`Date: ${dateStr}`);
    lines.push(`Order: #${order.id.slice(0, 8)}`);
    lines.push(`Customer: ${order.customer_name || 'Unknown'}`);
    if (order.customer_phone) lines.push(`Phone: ${order.customer_phone}`);
    if (order.garment_type) lines.push(`Garment: ${order.garment_type} (Ksh ${garmentCost.toLocaleString()})`);
    if (accessories && accessories.length > 0) {
        lines.push('');
        lines.push('--- EXTRAS & ACCESSORIES ---');
        accessories.forEach(a => {
            const price = parseFloat(a.price) || 0;
            const aName = a.name || a.item_name || 'Accessory';
            lines.push(`• ${aName} (x${a.quantity || 1}): Ksh ${(price * (a.quantity || 1)).toLocaleString()}`);
        });
    }
    lines.push('');
    lines.push(`Total Cost: Ksh ${totalCost.toLocaleString()}`);
    if (payingNow > 0) lines.push(`Paid Now: Ksh ${payingNow.toLocaleString()}`);
    lines.push(`Total Paid: Ksh ${realTotalPaid.toLocaleString()}`);
    lines.push(`Balance Due: Ksh ${remainingBalance.toLocaleString()}`);
    lines.push('-----------------------------');
    lines.push(remainingBalance > 0 ? 'Balance Due' : '✅ PAID IN FULL');
    lines.push('');
    lines.push('Thank you for your business!');
    lines.push('');
    lines.push('---');
    lines.push('Powered by Stitch & Styles Kenya');
    lines.push('www.tailors.co.ke');
    return lines.join('\n');
}

function showNuclearSharingModal(receiptHTML, receiptText, customerName, customerPhone, shopName = 'tailors.co.ke') {
    // Remove existing modal
    const existingModal = document.getElementById('receipt-sharing-modal');
    if (existingModal) existingModal.remove();

    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';

    const modalHTML = `
        <div id="receipt-sharing-modal"
             style="display:flex; position:fixed; z-index:99999; left:0; top:0; width:100%; height:100%;
                    background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
                    align-items:center; justify-content:center;">
            <div style="background:#fff; border-radius:14px; width:480px; max-width:95vw;
                        max-height:90vh; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.35);
                        display:flex; flex-direction:column;">

                <!-- Header -->
                <div style="padding:16px 20px; border-bottom:2px solid #f1f5f9;
                            display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:#d4af37; width:36px; height:36px; border-radius:50%;
                                     display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-receipt" style="color:#000; font-size:0.9em;"></i>
                        </span>
                        <div>
                            <h2 style="margin:0; font-size:1.15em; color:#0f172a;">Share Receipt</h2>
                            <p style="margin:0; font-size:0.8em; color:#64748b;">${customerName || 'Customer'}</p>
                        </div>
                    </div>
                    <button onclick="closeReceiptModal()"
                            style="background:none; border:none; font-size:1.4em; color:#94a3b8;
                                   cursor:pointer; line-height:1; padding:4px 8px; border-radius:6px;"
                            onmouseover="this.style.background='#f1f5f9'"
                            onmouseout="this.style.background='none'">&times;</button>
                </div>

                <!-- Receipt Preview — fixed height, scrollable ONLY this section -->
                <div id="receipt-preview-container"
                     style="flex:1; overflow-y:auto; padding:16px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                    ${receiptHTML}
                </div>

                <!-- Share Buttons — fixed at bottom, never scroll -->
                <div style="padding:16px 20px; display:flex; flex-direction:column; gap:10px; flex-shrink:0; background:#fff;">
                    ${cleanPhone ? `
                        <button id="whatsapp-btn"
                                style="display:flex; align-items:center; gap:10px; background:#25D366; color:#fff;
                                       border:none; padding:12px 16px; border-radius:8px; cursor:pointer;
                                       font-weight:600; font-size:0.9em; transition:opacity 0.2s;"
                                onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            <i class="fab fa-whatsapp" style="font-size:1.2em;"></i>
                            Share via WhatsApp
                        </button>
                        <button id="sms-btn"
                                style="display:flex; align-items:center; gap:10px; background:#3b82f6; color:#fff;
                                       border:none; padding:12px 16px; border-radius:8px; cursor:pointer;
                                       font-weight:600; font-size:0.9em; transition:opacity 0.2s;"
                                onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            <i class="fas fa-comment-sms" style="font-size:1.1em;"></i>
                            Share via SMS
                        </button>
                    ` : ''}
                    <div style="display:flex; gap:10px;">
                        <button id="share-image-btn"
                                style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;
                                       background:#7c3aed; color:#fff; border:none; padding:12px; border-radius:8px;
                                       cursor:pointer; font-weight:600; font-size:0.9em; transition:opacity 0.2s;"
                                onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            <i class="fas fa-image"></i> Save Image
                        </button>
                        <button id="copy-btn"
                                style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px;
                                       background:#64748b; color:#fff; border:none; padding:12px; border-radius:8px;
                                       cursor:pointer; font-weight:600; font-size:0.9em; transition:opacity 0.2s;"
                                onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            <i class="fas fa-copy"></i> Copy Text
                        </button>
                    </div>
                    <div id="share-status" style="text-align:center; min-height:20px;"></div>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstElementChild);

    // Add event listeners
    setTimeout(() => {
        if (cleanPhone) {
            document.getElementById('whatsapp-btn').onclick = () => {
                shareViaWhatsApp(receiptText, cleanPhone);
            };

            document.getElementById('sms-btn').onclick = () => {
                shareViaSMS(receiptText, cleanPhone);
            };
        }

        document.getElementById('share-image-btn').onclick = () => {
            shareReceiptAsImage(shopName);
        };

        document.getElementById('copy-btn').onclick = () => {
            copyReceiptText(receiptText);
        };
    }, 100);
}

function shareViaWhatsApp(receiptText, phoneNumber) {
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(receiptText)}`;
    window.open(whatsappUrl, '_blank');
    showStatusMessage('Opening WhatsApp...', 'success');
}

function shareViaSMS(receiptText, phoneNumber) {
    const smsUrl = /iPhone|iPad|iPod/.test(navigator.userAgent)
        ? `sms:${phoneNumber}&body=${encodeURIComponent(receiptText)}`
        : `sms:${phoneNumber}?body=${encodeURIComponent(receiptText)}`;
    window.open(smsUrl, '_blank');
    showStatusMessage('Opening SMS app...', 'success');
}

async function shareReceiptAsImage(shopName = 'tailors.co.ke') {
    const receiptContent = document.querySelector('#receipt-preview-container > div');
    if (!receiptContent) {
        showStatusMessage('❌ Receipt content not found', 'error');
        return;
    }

    showStatusMessage('🔄 Creating image...', 'info');

    try {
        // *** CRITICAL FIX: Ensure html2canvas is loaded and available ***
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        }

        const canvas = await html2canvas(receiptContent, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        // Auto-download
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const downloadLink = document.createElement('a');
        downloadLink.download = `receipt_${timestamp}.png`;
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.click();

        // Try native sharing
        canvas.toBlob(async (blob) => {
            if (blob) {
                const file = new File([blob], `receipt_${timestamp}.png`, { type: 'image/png' });

                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Tailoring Receipt',
                            text: `Receipt from ${shopName} via tailors.co.ke`
                        });
                        showStatusMessage('✅ Image shared!', 'success');
                    } catch (shareError) {
                        showStatusMessage('✅ Image downloaded!', 'success');
                    }
                } else {
                    showStatusMessage('✅ Image downloaded!', 'success');
                }
            }
        }, 'image/png');

    } catch (error) {
        logDebug("Image generation error:", error, 'error');
        showStatusMessage('❌ Error creating image', 'error');
    }
}

function copyReceiptText(receiptText) {
    navigator.clipboard.writeText(receiptText)
        .then(() => showStatusMessage('✅ Copied to clipboard!', 'success'))
        .catch(() => {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = receiptText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showStatusMessage('✅ Copied to clipboard!', 'success');
        });
}

function showStatusMessage(message, type) {
    const statusDiv = document.getElementById('share-status');
    if (statusDiv) {
        statusDiv.innerHTML = `<p style="display:flex;align-items:center;justify-content:center;gap:6px;color:${type==='success'?'#16a34a':type==='error'?'#dc2626':'#d97706'};font-weight:600;font-size:0.85em;">${message}</p>`;
        setTimeout(() => statusDiv.innerHTML = '', 3000);
    }
}

function closeReceiptModal() {
    const modal = document.getElementById('receipt-sharing-modal');
    if (modal) modal.remove();
}

async function loadPendingClosureOrders() {
    try {
        let query = supabaseClient
            .from('orders')
            .select('*')
            .eq('status', 6)
            .order('created_at', { ascending: false });

        if (USER_PROFILE && USER_PROFILE.organization_id) {
            const shopsRes = await (window.OfflineStore
                ? window.OfflineStore.fetchWithFallback('shops', () => supabaseClient.from('shops').select('id').eq('organization_id', USER_PROFILE.organization_id))
                : supabaseClient.from('shops').select('id').eq('organization_id', USER_PROFILE.organization_id));
            const orgShops = shopsRes?.data;
            const validShopIds = orgShops ? orgShops.map(s => s.id) : [];
            if (validShopIds.length > 0) {
                query = query.in('shop_id', validShopIds);
            }
        }

        const shopFilter = document.getElementById('shop-filter')?.value;
        if (shopFilter && shopFilter !== "") {
            query = query.eq('shop_id', shopFilter);
        }

        let orders = null;
        let ordersErr = null;
        try {
            const res = await query;
            orders = res.data;
            ordersErr = res.error;
        } catch (e) {
            ordersErr = e;
        }

        if (ordersErr || !orders) {
            if (window.OfflineStore) {
                orders = (await window.OfflineStore.getCache('orders')) || [];
                orders = orders.filter(o => o.status === 6);
            } else {
                throw ordersErr || new Error("Failed to load pending closure orders");
            }
        }

        const tbody = document.getElementById('orders-tbody');
        if (!tbody) return;

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No orders pending closure</td></tr>';
            return;
        }

        // Get shop names
        const shopIds = [...new Set(orders.map(o => o.shop_id).filter(id => id))];
        let shopMap = {};
        if (shopIds.length > 0) {
            const { data: shops } = await supabaseClient
                .from('shops')
                .select('id, name')
                .in('id', shopIds);

            if (shops) {
                shops.forEach(s => {
                    shopMap[s.id] = s.name;
                });
            }
        }

        // Get payments for these orders
        const orderIds = orders.map(o => o.id);
        const { data: payments } = await supabaseClient
            .from('payments')
            .select('*')
            .in('order_id', orderIds);

        const paymentsByOrder = {};
        if (payments) {
            payments.forEach(p => {
                if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
                paymentsByOrder[p.order_id].push(p);
            });
        }

        tbody.innerHTML = orders.map(order => {
            const orderPayments = paymentsByOrder[order.id] || [];
            const activePayments = orderPayments; // Exclude soft-deleted - DB now handles this
            const paid = activePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const orderIdStr = String(order.id);
            const shortId = orderIdStr.slice(-6);

            return `
                <tr>
                    <td>#${shortId}</td>
                    <td>${shopMap[order.shop_id] || 'Unknown'}</td>
                    <td>${order.customer_name}</td>
                    <td>Ksh ${paid.toLocaleString()}</td>
                    <td><span class="status-indicator status-6">Pending Closure</span></td>
                    <td>
                        <button class="small-btn" style="background:#343a40; color:white;" 
                                onclick="openReviewModal('${order.id}')">
                            Review & Close
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        logDebug(`Loaded ${orders.length} pending orders`, null, 'success');
    } catch (error) {
        logDebug("Error loading pending orders:", error, 'error');
    }
}

async function openReviewModal(orderId) {
    try {
        const [{ data: order }, { data: payments }] = await Promise.all([
            supabaseClient.from('orders')
                .select('*')
                .eq('id', orderId)
                .single(),
            supabaseClient.from('payments')
                .select('amount')
                .eq('order_id', orderId)
        ]);

        if (!order) {
            alert("Order not found");
            return;
        }

        // Get shop name
        let shopName = 'Unknown';
        if (order.shop_id) {
            const { data: shop } = await supabaseClient
                .from('shops')
                .select('name')
                .eq('id', order.shop_id)
                .single();
            if (shop) shopName = shop.name;
        }

        const totalPaid = payments ? payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const balance = order.price - totalPaid;

        // Update modal content
        document.getElementById('admin-detail-shop').textContent = shopName;
        document.getElementById('admin-detail-customer-name').textContent = order.customer_name;
        document.getElementById('admin-detail-garment-type').textContent = order.garment_type;
        document.getElementById('admin-detail-price').textContent = order.price.toLocaleString();
        document.getElementById('admin-detail-total-paid').textContent = totalPaid.toLocaleString();
        document.getElementById('admin-detail-balance-due').textContent = balance.toLocaleString();

        // Setup finalize button
        const finalizeBtn = document.getElementById('finalize-order-btn');
        if (finalizeBtn) {
            finalizeBtn.onclick = () => finalizeOrder(orderId, balance > 0);
        }

        // Show modal
        document.getElementById('admin-modal').style.display = 'flex';

    } catch (error) {
        logDebug("Error opening review modal:", error, 'error');
        alert("Error: " + error.message);
    }
}

async function finalizeOrder(orderId, hasDebt) {
    if (hasDebt && !confirm("Order has unpaid balance. Close anyway?")) return;

    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({
                status: 7
            })
            .eq('id', orderId);

        if (error) throw error;

        document.getElementById('admin-modal').style.display = 'none';
        loadPendingClosureOrders();
        loadMetrics();

        logDebug(`Order ${orderId} finalized`, null, 'success');
    } catch (error) {
        logDebug("Error finalizing order:", error, 'error');
        alert("Error closing order: " + error.message);
    }
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

async function loadAdminOrders(mode = 'current') {
    if (!USER_PROFILE) return;

    // [PERF] Debounce rapid calls
    const now = Date.now();
    if (window._lastAdminOrdersLoad && now - window._lastAdminOrdersLoad < 500) return;
    window._lastAdminOrdersLoad = now;

    logDebug(`Loading admin orders (${mode})`, null, 'info');

    try {
        // Ensure owner only sees their organization's shops
        const { data: orgShops } = await supabaseClient.from('shops').select('id').eq('organization_id', USER_PROFILE.organization_id);
        const validShopIds = orgShops ? orgShops.map(s => s.id) : [];
        if(validShopIds.length === 0) return;

        let query = supabaseClient.from('orders')
            .select('*')
            .in('shop_id', validShopIds)
            .order(mode === 'all' ? 'created_at' : 'due_date', { ascending: mode !== 'all' }) // [CHANGED] Sort correctly for history
            .limit(mode === 'all' ? 200 : 1000);

        // If mode is current or urgent, exclude closed
        if (mode === 'current' || mode === 'urgent') {
            query = query.neq('status', 7);
        }

        // Apply filters
        const shopFilter = document.getElementById('admin-shop-filter')?.value;
        if (shopFilter && shopFilter !== "") {
            query = query.eq('shop_id', shopFilter);
        }

        const statusFilter = document.getElementById('admin-status-filter')?.value;
        if (statusFilter && statusFilter !== "" && mode !== 'urgent') {
            query = query.eq('status', parseInt(statusFilter));
        }

        // [NEW] Search Filtering Logic
        const searchTerm = document.getElementById('admin-search-input')?.value?.trim();
        if (searchTerm) {
            // Search in customer_name or customer_phone
            // We use .or() for multiple column matching
            query = query.or(`customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`);
        }

        const { data: ordersData, error } = await query;
        if (error) throw error;

        await loadShopsForDropdown('admin-shop-filter');

        // [NEW] "Hot List" Filtering Logic
        let orders = ordersData;
        if (mode === 'urgent') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            orders = ordersData.filter(o => {
                if (o.status >= 5) return false;
                const due = new Date(o.due_date);
                const diffTime = due - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 2; // Late or Due in 2 days
            });
        }

        const tbody = document.getElementById('admin-orders-tbody');
        if (!tbody) return;

        if (!orders || orders.length === 0) {
            tbody.innerHTML = mode === 'urgent'
                ? '<tr><td colspan="9" style="text-align:center; padding:30px; font-size:1.2em;">✅ No express issues across shops.</td></tr>'
                : '<tr><td colspan="9" style="text-align:center; padding:20px;">No orders found</td></tr>';
            return;
        }

        // Fetch relations
        const shopIds = [...new Set(orders.map(o => o.shop_id).filter(id => id))];
        const workerIds = [...new Set(orders.map(o => o.worker_id).filter(id => id))];
        const orderIds = orders.map(o => o.id);

        const [{ data: shops }, { data: workers }, { data: payments }, { data: accessories }] = await Promise.all([
            shopIds.length > 0 ? supabaseClient.from('shops').select('id, name').in('id', shopIds) : Promise.resolve({ data: [] }),
            workerIds.length > 0 ? supabaseClient.from('workers').select('id, name').in('id', workerIds) : Promise.resolve({ data: [] }),
            supabaseClient.from('payments').select('*').is('deleted_at', null).in('order_id', orderIds),
            supabaseClient.from('order_accessories').select('*').in('order_id', orderIds)
        ]);

        const shopMap = {}; shops?.forEach(s => shopMap[s.id] = s.name);
        const workerMap = {}; workers?.forEach(w => workerMap[w.id] = w.name);
        const paymentsByOrder = {}; payments?.forEach(p => {
            if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
            paymentsByOrder[p.order_id].push(p);
        });
        const accessoriesByOrder = {}; accessories?.forEach(a => {
            if (!accessoriesByOrder[a.order_id]) accessoriesByOrder[a.order_id] = [];
            accessoriesByOrder[a.order_id].push(a);
        });

        const isSmallScreen = window.innerWidth <= 768;
        const thead = document.getElementById('admin-orders-thead');
        if (thead) {
             if (isSmallScreen) {
                 thead.innerHTML = `<tr><th>Customer</th><th>Garment</th><th>Action</th><th>Shop</th><th>References</th><th>Due Date</th><th>Worker</th><th>Status</th><th>Balance Due</th></tr>`;
             } else {
                 thead.innerHTML = `<tr><th>Shop</th><th>Customer</th><th>Garment</th><th>Due Date</th><th>Worker</th><th>Status</th><th>Balance Due</th><th>Action</th></tr>`;
             }
        }

        tbody.innerHTML = orders.map(order => {
            const orderPaymentList = (paymentsByOrder[order.id] || []);
            const activePayments = orderPaymentList.filter(p => !p.deleted_at); // Exclude soft-deleted
            const paid = activePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const orderAccessories = accessoriesByOrder[order.id] || [];
            const accTotal = orderAccessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0);
            const grandTotal = (order.price || 0);
            const balance = grandTotal - paid;
            const orderIdStr = String(order.id);
            const shortId = orderIdStr.slice(-6);
            const statusText = STATUS_MAP[order.status] || `Status ${order.status}`;
            const shopName = shopMap[order.shop_id] || 'Unknown';
            const workerName = order.worker_id ? (workerMap[order.worker_id] || 'Unassigned') : 'Unassigned';

            // [NEW] Squad Badge Logic
            let squadCount = 0;
            try {
                const raw = order.additional_workers;
                if (Array.isArray(raw)) {
                    squadCount = raw.length;
                } else if (typeof raw === 'string' && raw.trim().length > 0) {
                    try {
                        squadCount = JSON.parse(raw).length;
                    } catch (e) {
                        console.warn("Skipping bad squad data for order:", order.id);
                    }
                }
            } catch (e) {
                console.warn("Skipping bad squad data for order:", order.id);
            }

            const squadBadge = squadCount > 0
                ? ' <i class="fas fa-users" style="color:#007bff; font-size:0.8em;" title="Has Team"></i>'
                : '';

            // [NEW] Traffic Light Date Logic
            const diffDays = Math.ceil((new Date(order.due_date) - new Date()) / (86400000));
            let dueDisplay = formatDate(order.due_date);

            if (order.status < 5) {
                if (diffDays < 0) {
                    dueDisplay = `<div style="color:#dc3545; font-weight:800; line-height:1.2;">
                        <i class="fas fa-exclamation-circle"></i> ${formatDate(order.due_date)} <span style="font-size:0.85em; opacity:0.9;">(${Math.abs(diffDays)})</span>
                    </div>`;
                } else if (diffDays <= 2) {
                    dueDisplay = `<div style="color:#e67e22; font-weight:800; line-height:1.2;">
                        <i class="fas fa-stopwatch"></i> ${formatDate(order.due_date)}<br>
                        <small>${diffDays === 0 ? 'DUE TODAY' : diffDays + ' days left'}</small>
                    </div>`;
                }
            }

            const actionCell = `
                <td class="admin-actions-cell">
                    <button class="btn-compact" title="View Order" onclick="openAdminOrderView('${order.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-compact" title="Share Tracking Link" style="background:#3b82f6;" onclick="shareTrackingLink('${order.id}', '${order.customer_phone || ''}')"><i class="fas fa-location-arrow"></i></button>
                </td>
            `;

            if (isSmallScreen) {
                return `
                    <tr>
                        <td>${order.customer_name}</td>
                        <td style="max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.garment_type}">${order.garment_type}</td>
                        ${actionCell}
                        <td>${shopName}</td>
                        <td class="ref-column">${order.customer_preferences || 'None'}</td>
                        <td>${dueDisplay}</td>
                        <td>${workerName}${squadBadge}</td>
                        <td><span class="status-indicator status-${order.status}">${statusText}</span></td>
                        <td style="color:${balance > 0 ? '#dc3545' : '#28a745'}; font-weight:bold;">Ksh ${balance.toLocaleString()}</td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td>${shopName}</td>
                        <td>${order.customer_name}</td>
                        <td style="max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.garment_type}">${order.garment_type}</td>
                        <td>${dueDisplay}</td>
                        <td>${workerName}${squadBadge}</td>
                        <td><span class="status-indicator status-${order.status}">${statusText}</span></td>
                        <td style="color:${balance > 0 ? '#dc3545' : '#28a745'}; font-weight:bold;">Ksh ${balance.toLocaleString()}</td>
                        ${actionCell}
                    </tr>
                `;
            }
        }).join('');

        addRefreshButton();
        logDebug(`Loaded ${orders.length} admin orders`, null, 'success');

    } catch (error) {
        logDebug("Error loading admin orders:", error, 'error');
        const tbody = document.getElementById('admin-orders-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#dc3545;">Error: ${error.message}</td></tr>`;
        }
    }
}

function shareTrackingLink(orderId, phone) {
    const basePath = window.location.pathname.indexOf('/views/') > 0 
        ? window.location.pathname.substring(0, window.location.pathname.indexOf('/views/')) 
        : '';
    const trackingUrl = `${window.location.origin}${basePath}/views/client/track.html?id=${orderId}&utm_source=tailor_share&utm_medium=whatsapp_or_copy&utm_campaign=order_tracking`;
    const text = `Hi! You can track the live status of your custom tailoring order here:\n\n${trackingUrl}`;
    
    // Attempt to open WhatsApp if phone exists
    if (phone && phone.trim() !== '') {
        // Clean phone number
        let cleanPhone = phone.replace(/\\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.substring(1);
        if (cleanPhone.length >= 10) {
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
            return;
        }
    }
    
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        alert("Tracking link copied to clipboard! You can paste it to the client.");
    }).catch(err => {
        prompt("Copy this tracking link:", trackingUrl);
    });
}

async function openAdminOrderView(orderId) {
    logDebug("Opening admin order view:", orderId, 'info');

    try {
        const [{ data: order }, { data: payments }, { data: accessories }] = await Promise.all([
            supabaseClient.from('orders').select('*').eq('id', orderId).single(),
            supabaseClient.from('payments').select('*').is('deleted_at', null).eq('order_id', orderId).order('recorded_at', { ascending: false }),
            supabaseClient.from('order_accessories').select('*').eq('order_id', orderId)
        ]);

        if (!order) {
            alert("Order not found!");
            return;
        }

        // Get additional data
        let shopName = 'Unknown';
        let workerName = 'Unassigned';

        if (order.shop_id) {
            const { data: shop } = await supabaseClient
                .from('shops')
                .select('name')
                .eq('id', order.shop_id)
                .single();
            if (shop) shopName = shop.name;
        }

        if (order.worker_id) {
            const { data: worker } = await supabaseClient
                .from('workers')
                .select('name')
                .eq('id', order.worker_id)
                .single();
            if (worker) workerName = worker.name;
        }

        const activePayments = payments ? payments.filter(p => !p.deleted_at) : [];
        const paid = activePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const accTotal = accessories ? accessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0) : 0;
        const totalOrderPrice = (order.price || 0);
        const balance = totalOrderPrice - paid;
        const orderIdStr = String(order.id);
        const shortId = orderIdStr.slice(-6);

        // Create modal content
        const modalContent = `
            <div style="padding: 15px;">
                <span class="close-btn" onclick="document.getElementById('order-modal').style.display='none'">&times;</span>
                <h2 style="border-bottom: 2px solid #d4af37; padding-bottom: 6px; margin-bottom: 12px; font-size: 1.3em;">
                    Order #${shortId} - ${order.customer_name}
                </h2>
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:2px 15px; margin-bottom:12px; font-size:0.85em;">
                    <p style="margin:2px 0;"><strong>Shop:</strong> ${shopName}</p>
                    <p style="margin:4px 0;"><strong>Garment:</strong> ${order.garment_type}</p>
                    <p style="margin:4px 0;"><strong>Worker:</strong> ${workerName}</p>
                    <p style="margin:4px 0;"><strong>Due Date:</strong> ${formatDate(order.due_date)}</p>
                    <p style="margin:4px 0; grid-column:1/-1;"><strong>Status:</strong> <span class="status-indicator status-${order.status}">${STATUS_MAP[order.status] || 'Unknown'}</span></p>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                    <div style="flex: 1 1 30%; min-width: 80px; background: #000; color: white; padding: 8px; border-radius: 5px; text-align: center;">
                        <small style="font-size: 0.8em;">Total Price</small>
                        <p style="margin: 2px 0; font-size: 1.1em; color: #d4af37; font-weight: bold;">
                            Ksh ${totalOrderPrice.toLocaleString()}
                        </p>
                    </div>
                    <div style="flex: 1 1 30%; min-width: 80px; background: #007bff; color: white; padding: 8px; border-radius: 5px; text-align: center;">
                        <small style="font-size: 0.8em;"><i class="fas fa-shield-alt" style="color:#d4af37; margin-right:4px;"></i>Secured in Escrow</small>
                        <p style="margin: 2px 0; font-size: 1.1em; font-weight: bold;">
                            Ksh ${paid.toLocaleString()}
                        </p>
                    </div>
                    <div style="flex: 1 1 30%; min-width: 80px; background: ${balance > 0 ? '#dc3545' : '#28a745'}; color: white; padding: 8px; border-radius: 5px; text-align: center;">
                        <small style="font-size: 0.8em;">Balance</small>
                        <p style="margin: 2px 0; font-size: 1.1em; font-weight: bold;">
                            Ksh ${balance.toLocaleString()}
                        </p>
                    </div>
                </div>
                
                <div style="display: flex; gap: 6px; margin-bottom: 12px;">
                    ${balance > 0 ? `
                        <button onclick="requestBalancePayment('${order.id}', ${balance}, '${order.shop_id || order.organization_id}')" 
                                style="flex: 1; background: #10b981; color: white; padding: 10px 4px; border-radius: 4px; border: none; cursor: pointer; font-weight:600; font-size: 0.85em; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <i class="fas fa-hand-holding-usd"></i> Request Balance
                        </button>
                    ` : ''}
                    <button onclick="window.location.href='/views/admin/admin-order-details.html?id=${order.id}'" 
                            style="flex: 1; background: #000; color: #d4af37; padding: 10px 4px; border-radius: 4px; border: none; cursor: pointer; font-weight:600; font-size: 0.85em; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button onclick="generateAndShareReceipt('${order.id}')" 
                            style="flex: 1; background: #28a745; color: white; padding: 10px 4px; border-radius: 4px; border: none; cursor: pointer; font-weight:600; font-size: 0.85em; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="fas fa-receipt"></i> Receipt
                    </button>
                    <button onclick="downloadInvoicePDF('${order.id}')" 
                            style="flex: 1; background: #3b82f6; color: white; padding: 10px 4px; border-radius: 4px; border: none; cursor: pointer; font-weight:600; font-size: 0.85em; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="fas fa-file-invoice"></i> Invoice
                    </button>
                </div>
                ${accessories && accessories.length > 0 ? `
                <div style="margin-bottom:15px; background:#f8fafc; border-radius:6px; padding:12px; border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 8px 0; color:#d4af37; font-size:0.9em;"><i class="fas fa-shopping-bag"></i> Accessories</h4>
                    <ul style="padding-left:18px; margin:0;">
                        ${accessories.map(a => `<li style="font-size:0.85em;">${a.name || a.item_name || 'Accessory'} x${a.quantity}${parseFloat(a.price) > 0 ? ' - Ksh ' + parseFloat(a.price).toLocaleString() : ''}</li>`).join('')}
                    </ul>
                </div>` : ''}

                <div style="border-top:1px solid #eee; padding-top:8px; margin-bottom:12px;">
                    <h4 style="margin:0 0 6px 0; font-size:0.85em;"><i class="fas fa-history" style="color:#d4af37;"></i> Payment History</h4>
                    <div style="max-height: 80px; overflow-y: auto; padding-right: 4px;">
                    ${payments && payments.filter(p => !p.deleted_at).length > 0 ?
                        payments.filter(p => !p.deleted_at).map(p =>
                            `<div style="padding:4px 6px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; font-size:0.8em;">
                                <span style="color:#64748b;">${formatDate(p.recorded_at)}${p.edited_at ? ' <i class="fas fa-pen" style="color:#f59e0b;font-size:0.7em;"></i>' : ''}</span>
                                <span style="font-weight:700; color:#16a34a;">Ksh ${p.amount.toLocaleString()}</span>
                                <span style="color:#94a3b8;">${p.payment_method || 'cash'}</span>
                            </div>`
                        ).join('')
                    : '<p style="color:#94a3b8; text-align:center; font-size:0.8em; margin:4px 0;">No payments recorded</p>'}
                    </div>
                </div>

                <div style="display:flex; flex-wrap: wrap; gap:8px;">
                    ${balance > 0 ?
                        `<button onclick="quickPay('${order.id}', ${balance})"
                                style="flex:1; background:#ffc107; color:black; padding:8px; border-radius:4px; border:none; cursor:pointer; font-weight:600; font-size:0.9em; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <i class="fas fa-money-bill-wave"></i> Pay Ksh ${balance.toLocaleString()}
                        </button>`
                    : '<button disabled style="flex:1; background:#d1fae5; color:#065f46; padding:8px; border-radius:4px; border:1px solid #6ee7b7; font-weight:600; font-size:0.9em; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-check-circle"></i> Fully Paid</button>'
                    }
                    <button onclick="updateAdminStatus('${order.id}')"
                            style="flex:1; background:#17a2b8; color:white; padding:8px; border-radius:4px; border:none; cursor:pointer; font-weight:600; font-size:0.9em; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="fas fa-sync-alt"></i> Update Status
                    </button>
                </div>
            </div>
        `;

        // Show modal — centered, fits viewport, no scroll
        let modal = document.getElementById('order-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'order-modal';
            modal.className = 'modal';
            modal.innerHTML = '<div class="modal-content"></div>';
            document.body.appendChild(modal);
        }

        const mc = modal.querySelector('.modal-content');
        mc.style.cssText = 'width:600px; max-width:95vw; max-height:90vh; overflow-y:auto; overflow-x:hidden; border-radius:12px; background:white; box-shadow:0 20px 60px rgba(0,0,0,0.3); position:relative;';
        mc.innerHTML = modalContent;
        modal.style.cssText = 'display:flex; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.55); backdrop-filter:blur(4px); align-items:center; justify-content:center;';

    } catch (error) {
        logDebug("Error opening admin order view:", error, 'error');
        alert("Error: " + error.message);
    }
}

async function updateAdminStatus(orderId) {
    const statusCode = prompt(`Enter Status Code:
1: Assigned, 2: In Progress, 3: QA Check, 4: Ready for Review/Fitting, 5: Ready for collection, 6: Collected, 7: Closed`);

    if (!statusCode || ![1, 2, 3, 4, 5, 6, 7].includes(Number(statusCode))) return;

    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({
                status: Number(statusCode)
            })
            .eq('id', orderId);

        if (error) throw error;

        alert("Status updated!");

        // Refresh current view
        const path = window.location.pathname;
        if (path.includes('admin-current-orders') || path.includes('admin-all-orders') || path.includes('admin-orders')) {
            const mode = path.includes('all') ? 'all' : 'current';
            loadAdminOrders(mode);
        }

        // Close modal
        document.getElementById('order-modal').style.display = 'none';

    } catch (error) {
        logDebug("Error updating status:", error, 'error');
        alert("Error: " + error.message);
    }
}

async function loadAdminOrderDetails() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');
    if (!orderId) return;
    CURRENT_ORDER_ID = orderId;

    try {
        const [{ data: order }, { data: payments }, { data: accessories }] = await Promise.all([
            supabaseClient.from('orders').select('*').eq('id', orderId).single(),
            supabaseClient.from('payments').select('*').is('deleted_at', null).eq('order_id', orderId).order('recorded_at', { ascending: false }),
            supabaseClient.from('order_accessories').select('*').eq('order_id', orderId)
        ]);

        if (!order) {
            alert("Order not found!");
            window.history.back();
            return;
        }

        // --- 1. SQUAD LOGIC (Load Checkboxes & Create Display String) ---
        let squadIds = [];
        try { squadIds = order.additional_workers ? JSON.parse(order.additional_workers) : []; } catch (e) { }

        // A. Load Checkboxes (Edit Form)
        if (order.shop_id) {
            await loadWorkersForSquad(order.shop_id);
            if (Array.isArray(squadIds)) {
                squadIds.forEach(id => {
                    const cb = document.getElementById(`squad_${id}`);
                    if (cb) cb.checked = true;
                });
            }
        }

        // B. Create Display String (Summary View)
        let workerDisplay = 'Unassigned';
        let leadName = 'Unassigned';
        if (order.worker_id) {
            const { data: lead } = await supabaseClient.from('workers').select('name').eq('id', order.worker_id).single();
            if (lead) leadName = lead.name;
        }

        // Fetch squad names for display
        let squadNames = [];
        if (squadIds.length > 0) {
            const { data: squad } = await supabaseClient.from('workers').select('name').in('id', squadIds);
            if (squad) squadNames = squad.map(w => w.name);
        }

        if (squadNames.length > 0) {
            workerDisplay = `<strong>${leadName}</strong> <span style="color:#666; font-size:0.9em;">(+ ${squadNames.join(', ')})</span>`;
        } else {
            workerDisplay = leadName;
        }

        // Update the new Summary UI
        if (document.getElementById('summary-worker-display')) document.getElementById('summary-worker-display').innerHTML = workerDisplay;
        
        if (order.description_top) {
            const topCont = document.getElementById('summary-desc-top-container');
            const topEl = document.getElementById('summary-desc-top');
            if (topCont && topEl) { topCont.style.display = 'block'; topEl.textContent = order.description_top; }
        }
        if (order.description_pant) {
            const pantCont = document.getElementById('summary-desc-pant-container');
            const pantEl = document.getElementById('summary-desc-pant');
            if (pantCont && pantEl) { pantCont.style.display = 'block'; pantEl.textContent = order.description_pant; }
        }
        if (order.inspiration_photo_url) {
            const photoCont = document.getElementById('summary-inspiration-photo-container');
            const photoEl = document.getElementById('summary-inspiration-photo');
            const photoLink = document.getElementById('summary-inspiration-photo-link');
            if (photoCont && photoEl && photoLink) {
                photoCont.style.display = 'block';
                photoEl.src = order.inspiration_photo_url;
                photoLink.href = order.inspiration_photo_url;
            }
        }

        if (document.getElementById('summary-notes')) document.getElementById('summary-notes').textContent = order.customer_preferences || 'None';
        if (document.getElementById('summary-measurements')) document.getElementById('summary-measurements').innerHTML = formatMeasurements(order.measurements_details);

        // --- 2. POPULATE EDIT FORM ---
        document.getElementById('edit-customer-name').value = order.customer_name;
        document.getElementById('edit-customer-phone').value = order.customer_phone;
        document.getElementById('edit-garment-type').value = order.garment_type;
        document.getElementById('edit-price').value = order.price;
        if (order.due_date) document.getElementById('edit-due-date').value = order.due_date.split('T')[0];
        document.getElementById('edit-desc-top').value = order.description_top || '';
        document.getElementById('edit-desc-pant').value = order.description_pant || '';
        document.getElementById('edit-preferences').value = order.customer_preferences || '';
        document.getElementById('edit-status').value = order.status;

        // --- [NEW] Pre-fill Accessories ---
        if (accessories && accessories.length > 0) {
            accessories.forEach(a => {
                const name = (a.name || a.item_name || '').toLowerCase();
                if (name.includes('shirt')) {
                    const qtyEl = document.getElementById('edit_acc_shirt_qty');
                    const prcEl = document.getElementById('edit_acc_shirt_price');
                    if (qtyEl) qtyEl.value = a.quantity;
                    if (prcEl) prcEl.value = a.price || 0;
                } else if (name.includes('tie')) {
                    const qtyEl = document.getElementById('edit_acc_tie_qty');
                    const prcEl = document.getElementById('edit_acc_tie_price');
                    if (qtyEl) qtyEl.value = a.quantity;
                    if (prcEl) prcEl.value = a.price || 0;
                } else if (name.includes('shoes')) {
                    const qtyEl = document.getElementById('edit_acc_shoes_qty');
                    const prcEl = document.getElementById('edit_acc_shoes_price');
                    if (qtyEl) qtyEl.value = a.quantity;
                    if (prcEl) prcEl.value = a.price || 0;
                } else {
                    const notesEl = document.getElementById('edit_acc_notes');
                    const prcEl = document.getElementById('edit_acc_notes_price');
                    if (notesEl) notesEl.value = a.name || a.item_name || '';
                    if (prcEl) prcEl.value = a.price || 0;
                }
            });
        }

        // --- [NEW] Accessories Individual Recalculator Builder (Edit) ---
        function updateEditAccessoriesTotal() {
            const shirtQty = parseFloat(document.getElementById('edit_acc_shirt_qty')?.value) || 0;
            const shirtPrice = parseFloat(document.getElementById('edit_acc_shirt_price')?.value) || 0;
            const tieQty = parseFloat(document.getElementById('edit_acc_tie_qty')?.value) || 0;
            const tiePrice = parseFloat(document.getElementById('edit_acc_tie_price')?.value) || 0;
            const shoesQty = parseFloat(document.getElementById('edit_acc_shoes_qty')?.value) || 0;
            const shoesPrice = parseFloat(document.getElementById('edit_acc_shoes_price')?.value) || 0;
            const notesPrice = parseFloat(document.getElementById('edit_acc_notes_price')?.value) || 0;

            const total = (shirtQty * shirtPrice) + (tieQty * tiePrice) + (shoesQty * shoesPrice) + notesPrice;
            const editAccTotalInput = document.getElementById('edit_acc_total_price');
            if (editAccTotalInput) editAccTotalInput.value = total > 0 ? total.toFixed(2) : '0';

            // DYNAMIC UPDATE FOR TOP SUMMARY CARDS
            const basePrice = parseFloat(document.getElementById('edit-price')?.value) || 0;
            const grandTotal = basePrice + total;
            
            // Recalculate Balance
            const paymentsStr = document.getElementById('display-total-paid')?.textContent || '0';
            const paid = parseFloat(paymentsStr.replace(/[^0-9.]/g, '')) || 0;
            const balance = grandTotal - paid;

            if (document.getElementById('display-total-price')) document.getElementById('display-total-price').textContent = `Ksh ${grandTotal.toLocaleString()}`;
            if (document.getElementById('display-balance-due')) document.getElementById('display-balance-due').textContent = `Ksh ${balance.toLocaleString()}`;
        }

        ['edit_acc_shirt_qty', 'edit_acc_shirt_price', 'edit_acc_tie_qty', 'edit_acc_tie_price', 'edit_acc_shoes_qty', 'edit_acc_shoes_price', 'edit_acc_notes_price'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updateEditAccessoriesTotal);
        });
        
        const editMainPriceInput = document.getElementById('edit-price');
        if (editMainPriceInput) editMainPriceInput.addEventListener('input', updateEditAccessoriesTotal);
        
        // Initial Calculation Trigger
        updateEditAccessoriesTotal();

        // Populate Worker Dropdown
        const { data: workers } = await supabaseClient.from('workers').select('*').eq('shop_id', order.shop_id).order('name');
        const workerSelect = document.getElementById('edit-worker-select');
        if (workerSelect && workers) {
            workerSelect.innerHTML = workers.map(w =>
                `<option value="${w.id}" ${w.id === order.worker_id ? 'selected' : ''}>${w.name}</option>`
            ).join('');
        }

        generateAdminMeasurementFields(order.garment_type, order.measurements_details);

        // --- 3. CALCULATE FINANCIALS ---
        const paid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const balance = order.price - paid;

        // Update Top Summary Card
        if (document.getElementById('summary-customer-name')) {
            document.getElementById('summary-customer-name').textContent = order.customer_name;
            const phoneEl = document.getElementById('summary-customer-phone');
            if (phoneEl) {
                phoneEl.textContent = order.customer_phone;
                phoneEl.href = `tel:${order.customer_phone}`;
            }
            document.getElementById('summary-garment-type').textContent = order.garment_type;
            document.getElementById('summary-due-date').textContent = formatDate(order.due_date);
            document.getElementById('summary-status').textContent = STATUS_MAP[order.status] || order.status;
            document.getElementById('summary-status').className = `status-indicator status-${order.status}`;

            // Update Admin Shop Display
            if (document.getElementById('admin-detail-shop')) {
                // We need to fetch shop name if not already loaded (it's not in the main select)
                if (order.shop_id) {
                    supabaseClient.from('shops').select('name, logo_url').eq('id', order.shop_id).single()
                        .then(({ data }) => { 
                            if (data) {
                                if (document.getElementById('admin-detail-shop')) document.getElementById('admin-detail-shop').textContent = data.name; 
                                if (data.logo_url) {
                                    const logoEl = document.getElementById('pdf-logo');
                                    if (logoEl) logoEl.src = data.logo_url;
                                }
                            }
                        });
                }
            }

            document.getElementById('display-total-price').textContent = `Ksh ${order.price.toLocaleString()}`;
            document.getElementById('display-total-paid').textContent = `Ksh ${paid.toLocaleString()}`;
            document.getElementById('display-balance-due').textContent = `Ksh ${balance.toLocaleString()}`;

            const balBox = document.getElementById('balance-box');
            if (balBox) balBox.className = balance > 0 ? 'stat-box box-red' : 'stat-box box-green';
        }

        const safeOrderId = order.id ? order.id.toString() : 'UNKNOWN';
        const shortId = safeOrderId.slice(0, 6);
        document.getElementById('admin-detail-header').textContent = `Order #${shortId} - ${order.customer_name}`;

        // --- 4. POPULATE PAYMENT HISTORY TABLE ---
        const paymentTbody = document.getElementById('payment-history-tbody');
        if (paymentTbody && payments) {
            window.CURRENT_PAYMENTS = payments;
            if (typeof enhancePaymentDisplay === 'function') {
                enhancePaymentDisplay();
            } else {
                paymentTbody.innerHTML = payments.length ? payments.map(p => `
                    <tr>
                        <td>${formatDate(p.recorded_at)}</td>
                        <td style="color: #28a745; font-weight: bold;">Ksh ${p.amount.toLocaleString()}</td>
                        <td>${p.payment_method || 'cash'}</td>
                        <td>${p.notes || '-'}</td>
                        <td>-</td>
                    </tr>
                `).join('') : '<tr><td colspan="5" style="text-align:center; padding:15px;">No payments recorded yet.</td></tr>';
            }
        }

        logDebug("Admin order details loaded", { orderId }, 'success');

    } catch (error) {
        logDebug("Error loading admin order details:", error, 'error');
        // Log the error that caused the problem to the console
        console.error(error);
        alert("Error loading order details: " + error.message);
    }
}

function generateAdminMeasurementFields(type, currentJson) {
    const container = document.getElementById('admin-measurement-fields-container');
    if (!container) return;

    let current = {};
    try {
        current = currentJson ? JSON.parse(currentJson) : {};
    } catch (e) {
        logDebug("Error parsing measurements:", e, 'warning');
        current = {};
    }

    const measurements = GARMENT_MEASUREMENTS[type];
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
            const value = current[component]?.[field] || '';
            html += `
                <div class="measurement-field">
                    <label>${field}</label>
                    <input type="number" step="0.1" value="${value}" 
                           data-c="${component}" data-m="${field}">
                </div>
            `;
        });

        html += '</div></div>';
    }

    container.innerHTML = html;
}

function generateAdminMeasurementFields(type, currentJson) {
    const container = document.getElementById('admin-measurement-fields-container');
    if (!container) return;

    let current = {};
    try {
        current = currentJson ? JSON.parse(currentJson) : {};
    } catch (e) {
        logDebug("Error parsing measurements:", e, 'warning');
        current = {};
    }

    const measurements = GARMENT_MEASUREMENTS[type];
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
            const value = current[component]?.[field] || '';
            html += `
                <div class="measurement-field">
                    <label>${field}</label>
                    <input type="number" step="0.1" value="${value}" 
                           data-c="${component}" data-m="${field}">
                </div>
            `;
        });

        html += '</div></div>';
    }

    container.innerHTML = html;
}

async function saveAdminOrder() {
    if (!CURRENT_ORDER_ID) return;

    try {
        // Collect measurements
        const measurements = {};
        document.querySelectorAll('#admin-measurement-fields-container input').forEach(input => {
            const comp = input.dataset.c;
            const meas = input.dataset.m;
            if (!measurements[comp]) measurements[comp] = {};
            if (input.value) measurements[comp][meas] = parseFloat(input.value);
        });

        // Capture squad selection
        const squad = Array.from(document.querySelectorAll('.squad-checkbox:checked')).map(cb => cb.value);

        // [NEW] Calculate Extras Subtotal Total for update
        const extras = collectSelectedExtras();
        const extrasTotal = extras.reduce((sum, e) => sum + (e.price * e.quantity), 0);
        const basePrice = parseFloat(document.getElementById('edit-price').value) || 0;
        const finalPrice = basePrice + extrasTotal;

        let inspirationPhotoUrl = null;
        if (document.getElementById('edit-inspiration-photo') && document.getElementById('edit-inspiration-photo').files.length > 0) {
            inspirationPhotoUrl = await uploadInspirationPhoto('edit-inspiration-photo');
        }

        const updateData = {
            customer_name: document.getElementById('edit-customer-name').value,
            customer_phone: document.getElementById('edit-customer-phone').value,
            garment_type: document.getElementById('edit-garment-type').value,
            price: finalPrice,
            due_date: document.getElementById('edit-due-date').value,
            customer_preferences: document.getElementById('edit-preferences').value || '',
            description_top: document.getElementById('edit-desc-top') ? document.getElementById('edit-desc-top').value : '',
            description_pant: document.getElementById('edit-desc-pant') ? document.getElementById('edit-desc-pant').value : '',
            status: parseInt(document.getElementById('edit-status').value) || 1,
            worker_id: document.getElementById('edit-worker-select').value || null,
            additional_workers: JSON.stringify(squad),
            measurements_details: JSON.stringify(measurements)
        };
        
        if (inspirationPhotoUrl) {
            updateData.inspiration_photo_url = inspirationPhotoUrl;
        }

        // Save to database
        const { error } = await supabaseClient
            .from('orders')
            .update(updateData)
            .eq('id', CURRENT_ORDER_ID);

        if (error) throw error;

        // --- [NEW] Sync Accessories with Stock Management (Edit Mode) ---
        const { data: oDetails } = await supabaseClient.from('orders').select('shop_id').eq('id', CURRENT_ORDER_ID).single();
        if (oDetails && oDetails.shop_id) {
             const { data: oldAcc } = await supabaseClient.from('order_accessories').select('*').eq('order_id', CURRENT_ORDER_ID);
             if (oldAcc && oldAcc.length > 0) {
                  for (const item of oldAcc) {
                       if (item.inventory_item_id) {
                            const { data: cur } = await supabaseClient.from('inventory_items').select('stock_quantity').eq('id', item.inventory_item_id).single();
                            if (cur) {
                                 const newQty = (cur.stock_quantity || 0) + (item.quantity || 0);
                                 await supabaseClient.from('inventory_items').update({ stock_quantity: newQty }).eq('id', item.inventory_item_id);
                            }
                       }
                  }
             }
             await supabaseClient.from('order_accessories').delete().eq('order_id', CURRENT_ORDER_ID);
             await saveOrderExtrasWithStock(CURRENT_ORDER_ID, oDetails.shop_id);
        }

        alert("Order saved successfully!");
        window.location.href = '/views/admin/admin-orders.html';

    } catch (error) {
        logDebug("Error saving admin order:", error, 'error');
        console.error("FULL SAVE ERROR:", error); // Log full error object
        alert("Error saving order! " + (error.message || JSON.stringify(error)));
    }
}

function initAdminOrderForm() {
    logDebug("Initializing admin order form", null, 'info');

    // 1. Load the list of shops
    loadShopsForDropdown('shop-select');

    // 2. Listen for Shop Selection Changes
    const shopSelect = document.getElementById('shop-select');
    if (shopSelect) {
        shopSelect.addEventListener('change', async function () {
            const shopId = this.value;

            if (!shopId) return; // Do nothing if empty

            // A. Load Lead Workers (Dropdown)
            const { data: workers } = await supabaseClient
                .from('workers')
                .select('id, name')
                .eq('shop_id', shopId)
                .order('name');

            const workerSelect = document.getElementById('worker-select');
            if (workerSelect && workers) {
                workerSelect.innerHTML = '<option value="">-- Select Lead --</option>' +
                    workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
            }

            // B. Load Squad Workers (Checkboxes) - THIS WAS THE MISSING PART
            logDebug("Loading squad for shop:", shopId);
            await loadWorkersForSquad(shopId);

            // C. Load Inventory Extras for this shop
            await loadExtrasForShop(shopId);
        });
    }

    // 3. Setup Garment Type Changes
    const garmentSelect = document.getElementById('garment-type-select');
    if (garmentSelect) {
        garmentSelect.addEventListener('change', generateAdminOrderFormMeasurements);
    }

    // Setup Client Search
    setupClientSearch('customer_phone');
    setupClientSearch('customer_name');


    // 4. Handle Form Submission
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.onsubmit = async (e) => {
            e.preventDefault();
            const shopId = document.getElementById('shop-select').value;
            if (!shopId) return alert("Select a shop");

            // Collect measurements
            const measurements = {};
            document.querySelectorAll('#measurement-fields-container input').forEach(input => {
                const comp = input.dataset.component;
                const meas = input.dataset.measurement;
                if (!measurements[comp]) measurements[comp] = {};
                if (input.value) measurements[comp][meas] = parseFloat(input.value);
            });

            // Capture Squad
            const squad = Array.from(document.querySelectorAll('.squad-checkbox:checked')).map(cb => cb.value);

            // [NEW] Calculate Extras Subtotal Total
            const extras = collectSelectedExtras();
            const extrasTotal = extras.reduce((sum, e) => sum + (e.price * e.quantity), 0);
            const basePrice = parseFloat(document.getElementById('price').value) || 0;
            const finalPrice = basePrice + extrasTotal;

            let inspirationPhotoUrl = null;
            try {
                inspirationPhotoUrl = await uploadInspirationPhoto('order-inspiration-photo');
            } catch (e) {
                return alert(e.message);
            }

            const orderData = {
                organization_id: USER_PROFILE.organization_id, // ðŸ‘ˆ Multi-tenant safe
                shop_id: shopId,
                customer_name: document.getElementById('customer_name').value,
                customer_phone: document.getElementById('customer_phone').value,
                garment_type: document.getElementById('garment-type-select').value,
                price: finalPrice,
                due_date: document.getElementById('due_date').value,
                worker_id: document.getElementById('worker-select').value || null,
                additional_workers: JSON.stringify(squad),
                status: 1,
                customer_preferences: document.getElementById('customer_preferences') ? document.getElementById('customer_preferences').value : '',
                description_top: document.getElementById('order-desc-top') ? document.getElementById('order-desc-top').value : '',
                description_pant: document.getElementById('order-desc-pant') ? document.getElementById('order-desc-pant').value : '',
                inspiration_photo_url: inspirationPhotoUrl,
                measurements_details: JSON.stringify(measurements),
                created_at: new Date().toISOString()
            };

            const { data: order, error } = await supabaseClient.from('orders').insert([orderData]).select().single();
            if (error) return alert(error.message);

            // --- [NEW] Save Inventory-backed Extras with Stock Deduction ---
            await saveOrderExtrasWithStock(order.id, shopId);


            // [NEW] Upsert Client Data
            try {
                const { data: existingClient } = await supabaseClient.from('clients').select('*').eq('organization_id', USER_PROFILE.organization_id).eq('phone', orderData.customer_phone).maybeSingle();
                let history = existingClient ? (existingClient.measurements_history || []) : [];
                history.unshift({
                    date: new Date().toISOString(),
                    garment: orderData.garment_type,
                    measurements: measurements
                });
                history = history.slice(0, 10); // Keep last 10

                await supabaseClient.from('clients').upsert({
                    organization_id: USER_PROFILE.organization_id, // ðŸ‘ˆ Multi-tenant safe
                    shop_id: orderData.shop_id, // ðŸ‘ˆ RLS safe
                    name: orderData.customer_name,
                    phone: orderData.customer_phone,
                    measurements_history: history,
                    last_garment_type: orderData.garment_type,
                    notes: orderData.customer_preferences || '',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'organization_id,phone' }); // ðŸ‘ˆ Updated Conflict target
            } catch (e) {
                console.error("Error upserting client:", e);
            }

            const deposit = parseFloat(document.getElementById('deposit_paid').value) || 0;
            if (deposit > 0) {
                const { error: depErr } = await supabaseClient.from('payments').insert([{ 
                    organization_id: USER_PROFILE.organization_id,
                    shop_id: USER_PROFILE.shop_id,
                    manager_id: USER_PROFILE.id,
                    order_id: order.id, 
                    amount: deposit 
                }]);
                if (depErr) console.error("Deposit error:", depErr);
            }

            window.location.href = '/views/admin/admin-orders.html';
        };
    }
}

function initAdminOrderForm() {
    logDebug("Initializing admin order form", null, 'info');

    // 1. Load the list of shops
    loadShopsForDropdown('shop-select');

    // 2. Listen for Shop Selection Changes
    const shopSelect = document.getElementById('shop-select');
    if (shopSelect) {
        shopSelect.addEventListener('change', async function () {
            const shopId = this.value;

            if (!shopId) return; // Do nothing if empty

            // A. Load Lead Workers (Dropdown)
            const { data: workers } = await supabaseClient
                .from('workers')
                .select('id, name')
                .eq('shop_id', shopId)
                .order('name');

            const workerSelect = document.getElementById('worker-select');
            if (workerSelect && workers) {
                workerSelect.innerHTML = '<option value="">-- Select Lead --</option>' +
                    workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
            }

            // B. Load Squad Workers (Checkboxes) - THIS WAS THE MISSING PART
            logDebug("Loading squad for shop:", shopId);
            await loadWorkersForSquad(shopId);

            // C. Load Inventory Extras for this shop
            await loadExtrasForShop(shopId);
        });
    }

    // 3. Setup Garment Type Changes
    const garmentSelect = document.getElementById('garment-type-select');
    if (garmentSelect) {
        garmentSelect.addEventListener('change', generateAdminOrderFormMeasurements);
    }

    // Setup Client Search
    setupClientSearch('customer_phone');
    setupClientSearch('customer_name');

    // --- 4. Handle Order Type Toggle (Custom vs Retail) ---
    let orderType = 'custom';
    const btnCustom = document.getElementById('type-custom');
    const btnRetail = document.getElementById('type-retail');

    const updateOrderTypeUI = (type) => {
        orderType = type;
        if (btnCustom && btnRetail) {
            btnCustom.classList.toggle('active', type === 'custom');
            btnRetail.classList.toggle('active', type === 'retail');
        }

        const garmentRow = document.getElementById('garment-type-row');
        const basePriceGroup = document.getElementById('base-price-group');
        const teamGroup = document.getElementById('team-assignment-fieldset');
        const measGroup = document.getElementById('measurement-fieldset');
        
        if (garmentRow) garmentRow.style.display = type === 'custom' ? 'grid' : 'none';
        if (basePriceGroup) basePriceGroup.style.display = type === 'custom' ? 'block' : 'none';
        if (teamGroup) teamGroup.style.display = type === 'custom' ? 'block' : 'none';
        if (measGroup) measGroup.style.display = type === 'custom' ? 'block' : 'none';

        const workerSelect = document.getElementById('worker-select');
        const garmentSelect = document.getElementById('garment-type-select');
        const priceInput = document.getElementById('price');
        
        if (workerSelect) workerSelect.required = type === 'custom';
        if (garmentSelect) garmentSelect.required = type === 'custom';
        if (priceInput) priceInput.required = type === 'custom';
    };

    if (btnCustom) btnCustom.addEventListener('click', () => updateOrderTypeUI('custom'));
    if (btnRetail) btnRetail.addEventListener('click', () => updateOrderTypeUI('retail'));

    // 5. Handle Form Submission
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.onsubmit = async (e) => {
            e.preventDefault();
            const shopId = document.getElementById('shop-select').value;
            if (!shopId) return alert("Select a shop");

            // Collect measurements
            const measurements = {};
            document.querySelectorAll('#measurement-fields-container input').forEach(input => {
                const comp = input.dataset.component;
                const meas = input.dataset.measurement;
                if (!measurements[comp]) measurements[comp] = {};
                if (input.value) measurements[comp][meas] = parseFloat(input.value);
            });

            // Capture Squad
            const squad = Array.from(document.querySelectorAll('.squad-checkbox:checked')).map(cb => cb.value);

            // [NEW] Calculate Extras Subtotal Total
            const extras = collectSelectedExtras();
            const extrasTotal = extras.reduce((sum, e) => sum + (e.price * e.quantity), 0);
            const basePrice = parseFloat(document.getElementById('price').value) || 0;
            const finalPrice = basePrice + extrasTotal;

            let inspirationPhotoUrl = null;
            if (typeof uploadInspirationPhoto === 'function') {
                try {
                    inspirationPhotoUrl = await uploadInspirationPhoto('order-inspiration-photo');
                } catch (e) {
                    return alert(e.message);
                }
            }

            const orderData = {
                organization_id: USER_PROFILE.organization_id,
                shop_id: shopId,
                customer_name: document.getElementById('customer_name').value,
                customer_phone: document.getElementById('customer_phone').value,
                garment_type: orderType === 'retail' ? 'Retail Sale' : document.getElementById('garment-type-select').value,
                price: finalPrice,
                due_date: orderType === 'retail' ? new Date().toISOString().split('T')[0] : document.getElementById('due_date').value,
                worker_id: orderType === 'retail' ? null : (document.getElementById('worker-select').value || null),
                additional_workers: orderType === 'retail' ? '[]' : JSON.stringify(squad),
                status: orderType === 'retail' ? 6 : 1, // 6 = Collected
                customer_preferences: document.getElementById('customer_preferences') ? document.getElementById('customer_preferences').value : '',
                description_top: document.getElementById('order-desc-top') ? document.getElementById('order-desc-top').value : '',
                description_pant: document.getElementById('order-desc-pant') ? document.getElementById('order-desc-pant').value : '',
                inspiration_photo_url: inspirationPhotoUrl,
                measurements_details: orderType === 'retail' ? '{}' : JSON.stringify(measurements),
                created_at: new Date().toISOString()
            };

            const { data: order, error } = await supabaseClient.from('orders').insert([orderData]).select().single();
            if (error) return alert(error.message);

            // --- [NEW] Save Inventory-backed Extras with Stock Deduction (Admin Form) ---
            await saveOrderExtrasWithStock(order.id, shopId);

            // [NEW] Upsert Client Data
            try {
                const { data: existingClient } = await supabaseClient.from('clients').select('*').eq('organization_id', USER_PROFILE.organization_id).eq('phone', orderData.customer_phone).maybeSingle();
                let history = existingClient ? (existingClient.measurements_history || []) : [];
                history.unshift({
                    date: new Date().toISOString(),
                    garment: orderData.garment_type,
                    measurements: measurements
                });
                history = history.slice(0, 10); // Keep last 10

                await supabaseClient.from('clients').upsert({
                    organization_id: USER_PROFILE.organization_id, // ðŸ‘ˆ Multi-tenant safe
                    shop_id: orderData.shop_id, // ðŸ‘ˆ RLS safe
                    name: orderData.customer_name,
                    phone: orderData.customer_phone,
                    measurements_history: history,
                    last_garment_type: orderData.garment_type,
                    notes: orderData.customer_preferences || '',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'organization_id,phone' }); // ðŸ‘ˆ Updated Conflict target
            } catch (e) {
                console.error("Error upserting client:", e);
            }

            const deposit = parseFloat(document.getElementById('deposit_paid').value) || 0;
            if (deposit > 0) {
                const adminShopId = document.getElementById('shop-select').value;
                const { error: depErr } = await supabaseClient.from('payments').insert([{
                    organization_id: USER_PROFILE.organization_id,
                    shop_id: adminShopId,
                    manager_id: USER_PROFILE.id,
                    order_id: order.id, 
                    amount: deposit 
                }]);
                if (depErr) console.error("Admin deposit error:", depErr);
            }

            window.location.href = '/views/admin/admin-orders.html';
        };
    }
}

function generateAdminOrderFormMeasurements() {
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

function generateAdminOrderFormMeasurements() {
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

function downloadOrderPDF() {
    const element = document.getElementById('pdf-export-content');
    if (!element) {
        alert("PDF content area not found!");
        return;
    }

    // Get customer name for formatting the filename
    let customerName = document.getElementById('summary-customer-name')?.textContent || 'Details';
    customerName = customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const opt = {
        margin: 0.5,
        filename: `SirsNSuits_Order_${customerName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // The html2pdf script does all the heavy lifting
    html2pdf().set(opt).from(element).save();
}

function buildInvoiceDocument(options) {
    const {
        title = "INVOICE",
        subtitle = "Quality Tailoring Services",
        invoiceNumber = "INV-2026-0001",
        date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        dueDate = "Upon Receipt",
        billToLabel = "Bill To:",
        billToName = "Customer Name",
        billToSub = "",
        items = [],
        totals = { subtotal: 0, paid: 0, balance: 0 },
        showPaymentDetails = true,
        companyName = APP_CONFIG?.appName || "OTIMA FASHION HOUSE",
        companySubtitle = subtitle,
        companyPhone = APP_CONFIG?.shopPhone || "",
        companyLocation = "Nairobi, Kenya",
        paymentMethodType = "paybill",
        paybill = APP_CONFIG?.billing?.paybill || "",
        account = APP_CONFIG?.billing?.account || "",
        accountName = APP_CONFIG?.billing?.accountName || "",
        tillNumber = "",
        pochiNumber = "",
        logoUrl = null
    } = options;

    const logoAbsUrl = logoUrl || null;

    const itemRows = items.map(item => `
        <tr>
            <td class="items-desc">${item.description || ''}</td>
            <td class="items-center">${item.qty ?? 1}</td>
            <td class="items-right">${formatCurrency(item.unitPrice)}</td>
            <td class="items-right items-bold">${formatCurrency(item.total)}</td>
        </tr>`).join('');

    let paymentDetailsHtml = '';
    if (paymentMethodType === 'till') {
        paymentDetailsHtml = `<td><strong>Buy Goods (Till No):</strong> ${tillNumber}</td>`;
    } else if (paymentMethodType === 'pochi') {
        paymentDetailsHtml = `<td><strong>Pochi La Biashara:</strong> ${pochiNumber}</td>`;
    } else {
        paymentDetailsHtml = `
            <td><strong>Paybill:</strong> ${paybill}</td>
            <td><strong>Account:</strong> ${account}</td>
            <td><strong>Account Name:</strong> ${accountName}</td>
        `;
    }

    const paymentBlock = showPaymentDetails ? `
        <div class="section">
            <div class="pay-title">Payment Details</div>
            <table class="pay-table">
                <tr>
                    ${paymentDetailsHtml}
                </tr>
            </table>
        </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title} â€” ${invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4 portrait;
    margin: 18mm 15mm;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #1e293b;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* â”€â”€â”€ HEADER â”€â”€â”€ */
  .header { display: table; width: 100%; margin-bottom: 20px; }
  .header-left { display: table-cell; vertical-align: middle; width: 55%; }
  .header-right { display: table-cell; vertical-align: top; text-align: right; width: 45%; }

  .logo-row { display: table; }
  .logo-cell { display: table-cell; vertical-align: middle; padding-right: 14px; }
  .logo-cell img { height: 60px; width: auto; display: block; }
  .brand-cell { display: table-cell; vertical-align: middle; }
  .brand-name { font-size: 17px; font-weight: 800; color: #0f172a; }
  .brand-sub  { font-size: 11px; color: #64748b; margin-top: 2px; }
  .brand-contact { font-size: 10.5px; color: #64748b; margin-top: 8px; line-height: 1.7; }

  .inv-title  { font-size: 27px; font-weight: 900; color: #0f172a; text-transform: uppercase; line-height: 1.15; }
  .inv-number { font-size: 15px; font-weight: 700; color: #f59e0b; margin: 6px 0; }
  .inv-dates  { font-size: 11px; color: #64748b; line-height: 1.8; }

  /* â”€â”€â”€ DIVIDER â”€â”€â”€ */
  .divider { border: none; border-top: 2px solid #0f172a; margin: 18px 0; }

  /* â”€â”€â”€ BILL TO â”€â”€â”€ */
  .bill-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 24px;
  }
  .bill-label { font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; }
  .bill-name  { font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
  .bill-sub   { font-size: 12px; color: #475569; margin-top: 3px; }

  /* â”€â”€â”€ ITEMS TABLE â”€â”€â”€ */
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  .items-table thead tr { border-bottom: 2px solid #0f172a; }
  .items-table th {
    padding: 9px 8px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: #64748b;
    text-align: left;
  }
  .items-table th.items-center { text-align: center; }
  .items-table th.items-right  { text-align: right; }
  .items-desc   { padding: 11px 8px 11px 0; border-bottom: 1px dotted #e2e8f0; vertical-align: top; }
  .items-center { padding: 11px 8px; border-bottom: 1px dotted #e2e8f0; text-align: center; }
  .items-right  { padding: 11px 8px; border-bottom: 1px dotted #e2e8f0; text-align: right; }
  .items-bold   { font-weight: 700; }

  /* â”€â”€â”€ TOTALS â”€â”€â”€ */
  .totals-wrap { display: table; width: 100%; margin-bottom: 24px; }
  .totals-spacer { display: table-cell; width: 58%; }
  .totals-box    { display: table-cell; width: 42%; }
  .totals-row { display: table; width: 100%; padding: 6px 0; }
  .totals-row.separator { border-bottom: 1px solid #e2e8f0; }
  .totals-label { display: table-cell; font-size: 13px; color: #64748b; }
  .totals-value { display: table-cell; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; }
  .totals-value.green  { color: #10b981; }
  .totals-value.big    { font-size: 17px; font-weight: 900; color: #ef4444; }
  .totals-label.big    { font-size: 15px; font-weight: 800; color: #0f172a; }

  /* â”€â”€â”€ PAYMENT DETAILS â”€â”€â”€ */
  .section { margin-bottom: 22px; }
  .pay-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-top: 1.5px solid #e2e8f0; padding-top: 14px; margin-bottom: 10px; }
  .pay-table { width: 100%; border-collapse: collapse; font-size: 12px; color: #475569; }
  .pay-table td { padding: 3px 10px 3px 0; }
  .pay-table td strong { color: #0f172a; }

  /* â”€â”€â”€ FOOTER â”€â”€â”€ */
  .footer { text-align: center; border-top: 1px dashed #e2e8f0; padding-top: 18px; margin-top: 40px; }
  .footer-text { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  .footer-bar { width: 30px; height: 2px; background: #f59e0b; border-radius: 2px; margin: 10px auto 0; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <div class="logo-row">
      <div class="logo-cell">${logoAbsUrl ? `<img src="${logoAbsUrl}" alt="Logo" onerror="this.style.display='none'">` : ''}</div>
      <div class="brand-cell">
        <div class="brand-name">${companyName}</div>
        <div class="brand-sub">${companySubtitle}</div>
        <div class="brand-contact">Phone: ${companyPhone}</div>
      </div>
    </div>
  </div>
  <div class="header-right">
    <div class="inv-title">${title}</div>
    <div class="inv-number">${invoiceNumber}</div>
    <div class="inv-dates">Date: ${date}<br>Due Date: ${dueDate}</div>
  </div>
</div>

<hr class="divider">

<!-- BILL TO -->
<div class="bill-box">
  <div class="bill-label">${billToLabel}</div>
  <div class="bill-name">${billToName}</div>
  <div class="bill-sub">${billToSub}</div>
</div>

<!-- ITEMS TABLE -->
<table class="items-table">
  <thead>
    <tr>
      <th>Description</th>
      <th class="items-center">Qty</th>
      <th class="items-right">Unit Price</th>
      <th class="items-right">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- TOTALS -->
<div class="totals-wrap">
  <div class="totals-spacer"></div>
  <div class="totals-box">
    ${totals.garmentSubtotal !== undefined ? `
    <div class="totals-row">
      <span class="totals-label">Garment Cost:</span>
      <span class="totals-value">${formatCurrency(totals.garmentSubtotal)}</span>
    </div>
    ` : ''}
    ${totals.extrasSubtotal !== undefined && totals.extrasSubtotal > 0 ? `
    <div class="totals-row">
      <span class="totals-label">Extras / Accessories:</span>
      <span class="totals-value">${formatCurrency(totals.extrasSubtotal)}</span>
    </div>
    ` : ''}
    <div class="totals-row" style="border-top: 1px dotted #e2e8f0; margin-top: 4px; padding-top: 4px;">
      <span class="totals-label" style="font-weight:700;">Grand Total:</span>
      <span class="totals-value" style="font-weight:800; color: #000;">${formatCurrency(totals.subtotal)}</span>
    </div>
    <div class="totals-row separator">
      <span class="totals-label">Paid:</span>
      <span class="totals-value green">${formatCurrency(totals.paid)}</span>
    </div>
    <div class="totals-row" style="padding-top:10px;">
      <span class="totals-label big">Balance Due:</span>
      <span class="totals-value big">${formatCurrency(totals.balance)}</span>
    </div>
  </div>
</div>

${paymentBlock}

<!-- FOOTER -->
<div class="footer">
  <div class="footer-text">Thank you for choosing ${companyName}!</div>
  <div class="footer-bar"></div>
</div>

<script>
  // Auto-print once the logo image has loaded (or after 1.5s max)
  window.onload = function () {
    var img = document.querySelector('img');
    function doPrint() { window.print(); }
    if (!img || img.complete) {
      setTimeout(doPrint, 300);
    } else {
      img.onload = img.onerror = function() { setTimeout(doPrint, 300); };
      setTimeout(doPrint, 1500); // fallback
    }
  };
<\/script>
</body>
</html>`;
}

function openInvoicePrintWindow(htmlDoc, filenameHint) {
    const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (!win) {
        alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
        return;
    }
    win.document.write(htmlDoc);
    win.document.close();
}

async function deleteOrder() {
    if (!CURRENT_ORDER_ID) return;

    if (!confirm("Are you absolutely sure you want to delete this order? This action cannot be undone.")) {
        return;
    }

    try {
        logDebug("Attempting to delete order", { orderId: CURRENT_ORDER_ID }, 'info');

        // [FIX] Hard delete orphaned child records to keep financials accurate
        await supabaseClient.from('payments').delete().eq('order_id', CURRENT_ORDER_ID);
        await supabaseClient.from('order_accessories').delete().eq('order_id', CURRENT_ORDER_ID);


        const { error } = await supabaseClient
            .from('orders')
            .delete()
            .eq('id', CURRENT_ORDER_ID);

        if (error) throw error;

        alert("Order deleted successfully!");
        window.location.href = '/views/admin/admin-orders.html';

    } catch (error) {
        logDebug("Error deleting order:", error, 'error');
        alert("Error deleting order: " + error.message);
    }
}

async function saveOrderExtrasWithStock(orderId, shopId) {
    const extras = collectSelectedExtras();
    if (extras.length === 0) return;

    const accessories = extras.map(e => ({
        order_id: orderId,
        inventory_item_id: e.inventory_item_id,
        name: e.item_name,
        price: e.price,
        quantity: e.quantity,
        organization_id: USER_PROFILE.organization_id,
        shop_id: shopId
    }));

    // Insert accessories
    const { error: accError } = await supabaseClient.from('order_accessories').insert(accessories);
    if (accError) {
        console.error("Error saving accessories:", accError);
        throw accError;
    }

    // Deduct stock for each item
    for (const extra of extras) {
        const { data: currentItem } = await supabaseClient
            .from('inventory_items')
            .select('stock_quantity')
            .eq('id', extra.inventory_item_id)
            .single();

        if (currentItem) {
            const newQty = Math.max(0, currentItem.stock_quantity - extra.quantity);
            await supabaseClient.from('inventory_items').update({
                stock_quantity: newQty,
                updated_at: new Date().toISOString()
            }).eq('id', extra.inventory_item_id);
        }
    }

    logDebug(`Saved ${extras.length} extras and updated stock levels`, null, 'success');
}

window.generateAndShareReceipt = async function (orderId) {
    logDebug("Generating receipt for order:", orderId, 'info');

    try {
        const [{ data: order }, { data: payments }, { data: accessories }] = await Promise.all([
            supabaseClient.from('orders').select('*').eq('id', orderId).single(),
            supabaseClient.from('payments').select('*').is('deleted_at', null).eq('order_id', orderId),
            supabaseClient.from('order_accessories').select('*').eq('order_id', orderId)
        ]);

        if (!order) {
            alert("Order not found!");
            return;
        }

        // Fetch shop details separately
        if (order.shop_id) {
            const { data: shop } = await supabaseClient.from('shops').select('*').eq('id', order.shop_id).single();
            order.shops = shop;
        }

        const receiptHTML = generateSimpleReceiptHTML(order, payments, 0, accessories);
        const receiptText = generateTextReceipt(order, payments, 0, accessories);

        showNuclearSharingModal(receiptHTML, receiptText, order.customer_name, order.customer_phone, order.shops?.name);

    } catch (error) {
        logDebug("Error generating receipt:", error, 'error');
        alert("Error generating receipt: " + error.message);
    }
}

window.debounceLoadOrders = function (mode) {
    if (adminSearchTimeout) clearTimeout(adminSearchTimeout);
    adminSearchTimeout = setTimeout(() => {
        loadAdminOrders(mode);
    }, 400); // 400ms delay
}

window.quickPay = async function (orderId, balance) {
    let modal = document.getElementById('quickpay-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quickpay-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:99999;';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="background:white;padding:30px;border-radius:12px;width:90%;max-width:400px;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;">
            <h3 style="margin-top:0;font-family:'Playfair Display', serif;color:#1e293b;">Record Payment</h3>
            <p style="color:#64748b;margin-bottom:20px;">Current Balance: <strong>Ksh ${balance.toLocaleString()}</strong></p>
            <div style="text-align:left;margin-bottom:20px;">
                <label style="display:block;margin-bottom:8px;font-weight:600;color:#334155;">Amount Receiving (Ksh):</label>
                <input type="number" id="quickpay-amount" value="${balance}" max="${balance}" style="width:100%;padding:12px;border:2px solid #e2e8f0;border-radius:8px;font-size:1.1em;box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;">
                <button id="quickpay-cancel" style="flex:1;padding:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                <button id="quickpay-confirm" style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Submit Payment</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('quickpay-cancel').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('quickpay-confirm').onclick = async () => {
        const amountStr = document.getElementById('quickpay-amount').value;
        const amount = parseFloat(amountStr);
        if (!amountStr || isNaN(amount) || amount <= 0) { alert("Please enter a valid amount greater than 0."); return; }
        if (amount > balance) { alert(`Amount cannot exceed balance of Ksh ${balance.toLocaleString()}`); return; }

        modal.innerHTML = '<div style="background:white;padding:30px;border-radius:12px;"><h3 style="margin:0;">Processing Payment...</h3></div>';

        try {
            const { data: ord } = await supabaseClient.from('orders').select('shop_id').eq('id', orderId).single();
            const { error } = await supabaseClient.from('payments').insert([{
                organization_id: USER_PROFILE.organization_id,
                shop_id: ord ? ord.shop_id : USER_PROFILE.shop_id,
                order_id: orderId,
                manager_id: USER_PROFILE?.id,
                amount: amount
            }]);

            if (error) throw error;
            modal.style.display = 'none';
            alert(`Payment of Ksh ${amount.toLocaleString()} recorded successfully!`);
            if (typeof refreshCurrentView === 'function') refreshCurrentView();
            
            // Automatically safely close the stale modal to reveal the freshly updated background table
            const parentModal = document.getElementById('order-modal');
            if (parentModal) parentModal.remove();
        } catch (error) {
            modal.style.display = 'none';
            alert("Error recording payment: " + error.message);
        }
    };
}

window.quickPay = async function (orderId, balance) {
    let modal = document.getElementById('quickpay-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quickpay-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:99999;';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="background:white;padding:30px;border-radius:12px;width:90%;max-width:400px;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;">
            <h3 style="margin-top:0;font-family:'Playfair Display', serif;color:#1e293b;">Record Payment</h3>
            <p style="color:#64748b;margin-bottom:20px;">Current Balance: <strong>Ksh ${balance.toLocaleString()}</strong></p>
            <div style="text-align:left;margin-bottom:20px;">
                <label style="display:block;margin-bottom:8px;font-weight:600;color:#334155;">Amount Receiving (Ksh):</label>
                <input type="number" id="quickpay-amount" value="${balance}" max="${balance}" style="width:100%;padding:12px;border:2px solid #e2e8f0;border-radius:8px;font-size:1.1em;box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;">
                <button id="quickpay-cancel" style="flex:1;padding:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                <button id="quickpay-confirm" style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Submit Payment</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('quickpay-cancel').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('quickpay-confirm').onclick = async () => {
        const amountStr = document.getElementById('quickpay-amount').value;
        const amount = parseFloat(amountStr);
        if (!amountStr || isNaN(amount) || amount <= 0) { alert("Please enter a valid amount greater than 0."); return; }
        if (amount > balance) { alert(`Amount cannot exceed balance of Ksh ${balance.toLocaleString()}`); return; }

        modal.innerHTML = '<div style="background:white;padding:30px;border-radius:12px;"><h3 style="margin:0;">Processing Payment...</h3></div>';

        try {
            const { data: ord } = await supabaseClient.from('orders').select('shop_id').eq('id', orderId).single();
            const { error } = await supabaseClient.from('payments').insert([{
                organization_id: USER_PROFILE.organization_id,
                shop_id: ord ? ord.shop_id : null,
                order_id: orderId,
                manager_id: USER_PROFILE?.id,
                amount: amount
            }]);

            if (error) throw error;
            modal.style.display = 'none';
            alert(`Payment of Ksh ${amount.toLocaleString()} recorded successfully!`);
            if (typeof refreshCurrentView === 'function') refreshCurrentView();
            
            // Automatically safely close the stale modal to reveal the freshly updated background table
            const parentModal = document.getElementById('order-modal');
            if (parentModal) parentModal.remove();
        } catch (error) {
            modal.style.display = 'none';
            alert("Error recording payment: " + error.message);
        }
    };
}

window.updateStatus = async function (orderId) {
    const statusCode = prompt(`Enter Status Code:
1: Assigned, 2: In Progress, 3: QA Check, 4: Ready for fitting, 5: Ready for collection, 6: Collected, 7: Closed`);

    if (!statusCode || ![1, 2, 3, 4, 5, 6, 7].includes(Number(statusCode))) return;

    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({
                status: Number(statusCode)
            })
            .eq('id', orderId);

        if (error) throw error;

        alert("Status updated!");
        refreshCurrentView();

    } catch (error) {
        alert("Error updating status: " + error.message);
    }
}

window.updateStatus = async function (orderId) {
    const statusCode = prompt(`Enter Status Code:
1: Assigned
2: In Progress
3: QA Check
4: Ready
5: Collected (Pending)
6: Closed`);

    if (!statusCode || ![1, 2, 3, 4, 5, 6].includes(Number(statusCode))) return;

    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({
                status: Number(statusCode)
            })
            .eq('id', orderId);

        if (error) throw error;

        alert("Status updated!");
        refreshCurrentView();

    } catch (error) {
        alert("Error updating status: " + error.message);
    }
}

window.downloadInvoicePDF = async function (orderId) {
    if (!orderId) {
        if (typeof CURRENT_ORDER_ID !== 'undefined') orderId = CURRENT_ORDER_ID;
        else return alert("Order ID not found");
    }
    try {

        const [{ data: order }, { data: payments }, { data: accessories }] = await Promise.all([
            supabaseClient.from('orders').select('*').eq('id', orderId).single(),
            supabaseClient.from('payments').select('*').is('deleted_at', null).eq('order_id', orderId),
            supabaseClient.from('order_accessories').select('*').eq('order_id', orderId)
        ]);
        if (!order) throw new Error("Order not found");

        // Fetch shop details separately
        if (order.shop_id) {
            const { data: shop } = await supabaseClient.from('shops').select('*').eq('id', order.shop_id).single();
            order.shops = shop;
        }

        const accTotal = accessories ? accessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0) : 0;
        const totalCost = parseFloat(order.price) || 0; // [NEW] order.price is already absolute total
        const garmentCost = Math.max(0, totalCost - accTotal);
        const paid = payments ? payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
        const balance = totalCost - paid;
        const year = new Date(order.created_at || new Date()).getFullYear();

        const invoiceItems = [{
            description: `Bespoke Tailoring: ${order.garment_type}`,
            qty: 1,
            unitPrice: garmentCost,
            total: garmentCost
        }];

        if (accessories && accessories.length > 0) {
            accessories.forEach(a => {
                const itemPrice = parseFloat(a.price) || 0;
                invoiceItems.push({
                    description: `Accessory: ${a.name || a.item_name}`,
                    qty: a.quantity || 1,
                    unitPrice: itemPrice,
                    total: (a.quantity || 1) * itemPrice
                });
            });
        }
        const shop = order.shops || {};

        const doc = buildInvoiceDocument({
            title: "INVOICE",
            companyName: shop.name || APP_CONFIG?.companyName || "Sir's 'n' Suits",
            subtitle: shop.receipt_header_text || "Quality Tailoring Services",
            companySubtitle: shop.receipt_header_text || "Quality Tailoring Services",
            companyPhone: shop.phone_number || APP_CONFIG?.shopPhone || "",
            logoUrl: shop.logo_url || null,
            invoiceNumber: `INV-${year}-${String(order.id).slice(-4).toUpperCase()}`,
            date: formatDate(new Date().toISOString()),
            dueDate: order.due_date ? formatDate(order.due_date) : "Upon Receipt",
            billToLabel: "Bill To:",
            billToName: order.customer_name,
            billToSub: order.customer_phone || order.phone_number || '',
            items: invoiceItems,
            totals: { 
                garmentSubtotal: garmentCost,
                extrasSubtotal: accTotal,
                subtotal: totalCost, 
                paid: paid, 
                balance: Math.max(0, balance) 
            },
            showPaymentDetails: true,
            paymentMethodType: shop.payment_method_type || 'paybill',
            paybill: shop.paybill_number || APP_CONFIG?.billing?.paybill,
            account: shop.paybill_account || APP_CONFIG?.billing?.account,
            tillNumber: shop.till_number || '',
            pochiNumber: shop.pochi_number || '',
            accountName: shop.name || APP_CONFIG?.billing?.accountName
        });

        openInvoicePrintWindow(doc, `Invoice_${(order.customer_name || 'customer').replace(/\s+/g, '_')}`);

    } catch (error) {
        logDebug("Invoice Error:", error, 'error');
        alert("Error generating invoice: " + error.message);
    }
}

window.requestBalancePayment = async function(orderId, balanceAmount, shopId) {
    alert('This M-Pesa payment request feature is currently in final testing and will be officially releasing in September. Thank you for your patience!');
    return;
    
    if (!USER_PROFILE) return alert("Please log in first.");
    
    try {
        // Fetch the order details to get the customer details
        const { data: orderData, error: orderErr } = await supabaseClient
            .from('orders')
            .select('customer_name, customer_phone')
            .eq('id', orderId)
            .single();
            
        if (orderErr) throw orderErr;

        if (!orderData.customer_phone) {
            alert("This order does not have a customer phone number attached. Cannot send M-Pesa request.");
            return;
        }

        const promptMsg = `Enter the amount to request from ${orderData.customer_name} (${orderData.customer_phone}):`;
        let inputAmount = prompt(promptMsg, balanceAmount);
        
        if (inputAmount === null) return; // User clicked Cancel
        
        let requestAmount = parseFloat(inputAmount);
        
        if (isNaN(requestAmount) || requestAmount <= 0) {
            alert("Please enter a valid amount greater than 0.");
            return;
        }

        if (requestAmount > balanceAmount) {
            if (!confirm(`The amount requested (Ksh ${requestAmount.toLocaleString()}) is greater than the remaining balance (Ksh ${balanceAmount.toLocaleString()}). Are you sure you want to proceed?`)) {
                return;
            }
        }

        // Trigger STK Push directly to the customer's phone!
        // We invoke the edge function. The client_id will default to the admin's ID, which is fine for manual orders.
        const { data, error } = await supabaseClient.functions.invoke('mpesa-stk-push', {
            body: { 
                order_id: orderId,
                tailor_id: USER_PROFILE.id, 
                amount: requestAmount,
                phone_number: orderData.customer_phone
            }
        });

        if (error) {
            console.error("STK Push Error:", error);
            alert("Failed to send M-Pesa prompt. Please check the phone number and try again.");
            return;
        }

        alert(`Success! M-Pesa prompt for Ksh ${requestAmount.toLocaleString()} has been sent to ${orderData.customer_phone}. The balance will automatically update once they enter their PIN.`);

    } catch (err) {
        alert("Failed to send payment request. " + err.message);
    }
};



