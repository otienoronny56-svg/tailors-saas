// ==========================================
// 💳 PAYMENTS, TRANSACTIONS & EXPENSES MODULE
// Extracted from app.js
// ==========================================

function openPaymentEditModal(paymentId) {
    SELECTED_PAYMENT_ID = paymentId;

    // Find the payment in the stored array
    const payment = window.CURRENT_PAYMENTS?.find(p => p.id === paymentId);
    if (!payment) {
        alert("Payment not found!");
        return;
    }

    // Populate the modal form
    document.getElementById('edit-payment-amount').value = payment.amount;
    document.getElementById('edit-payment-method').value = payment.payment_method || 'cash';
    document.getElementById('edit-payment-notes').value = payment.notes || '';

    // Show audit trail info
    let auditInfo = `Created: ${formatDate(payment.recorded_at)}`;
    if (payment.edited_at) {
        auditInfo += `<br>Last edited: ${formatDate(payment.edited_at)} by ${payment.edited_by ? payment.edited_by.slice(-6) : 'Admin'}`;
    }
    document.getElementById('edit-payment-audit-info').innerHTML = auditInfo;

    // Show modal
    document.getElementById('payment-edit-modal').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('payment-edit-modal').style.display = 'none';
    SELECTED_PAYMENT_ID = null;
}

async function savePaymentEdit() {
    if (!SELECTED_PAYMENT_ID || !CURRENT_ORDER_ID) {
        alert("Error: Missing payment or order ID");
        return;
    }

    const amount = parseFloat(document.getElementById('edit-payment-amount').value);
    const method = document.getElementById('edit-payment-method').value;
    const notes = document.getElementById('edit-payment-notes').value;

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount");
        return;
    }

    try {
        // Get current user ID
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            alert("You must be logged in to edit payments");
            return;
        }

        // Update payment
        const { error } = await supabaseClient
            .from('payments')
            .update({
                amount: amount,
                payment_method: method,
                notes: notes,
                edited_by: user.id,
                edited_at: new Date().toISOString()
            })
            .eq('id', SELECTED_PAYMENT_ID);

        if (error) throw error;

        logDebug("Payment updated successfully", { paymentId: SELECTED_PAYMENT_ID }, 'success');

        // Close modal and reload
        closePaymentModal();
        await loadAdminOrderDetails();

    } catch (error) {
        logDebug("Error updating payment:", error, 'error');
        alert("Error updating payment: " + error.message);
    }
}

async function deletePaymentRecord(paymentId) {
    if (!confirm("⚠️ Soft-delete this payment? It will be hidden but recoverable.")) {
        return;
    }

    try {
        // Get current user ID
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            alert("You must be logged in to delete payments");
            return;
        }

        // Soft delete by setting deleted_at and deleted_by
        const { error } = await supabaseClient
            .from('payments')
            .update({
                deleted_at: new Date().toISOString(),
                deleted_by: user.id
            })
            .eq('id', paymentId);

        if (error) throw error;

        logDebug("Payment soft-deleted successfully", { paymentId }, 'success');

        // Reload the payment history
        await loadAdminOrderDetails();

    } catch (error) {
        logDebug("Error deleting payment:", error, 'error');
        alert("Error deleting payment: " + error.message);
    }
}

async function enhancePaymentDisplay() {
    const paymentTbody = document.getElementById('payment-history-tbody');
    if (!paymentTbody || !window.CURRENT_PAYMENTS) return;

    const payments = window.CURRENT_PAYMENTS;

    // Try to recalculate financial totals excluding soft-deleted payments
    try {
        if (CURRENT_ORDER_ID) {
            const { data: freshOrder } = await supabaseClient
                .from('orders')
                .select('*')
                .eq('id', CURRENT_ORDER_ID)
                .single();

            if (freshOrder) {
                // The order.amount_paid is automatically updated by the database trigger
                // But we still calculate it here for display
                const nonDeletedPayments = payments.filter(p => !p.deleted_at);
                const paid = nonDeletedPayments.reduce((sum, p) => sum + p.amount, 0);
                const balance = freshOrder.price - paid;

                if (document.getElementById('display-total-paid')) {
                    document.getElementById('display-total-paid').textContent = `Ksh ${paid.toLocaleString()}`;
                }
                if (document.getElementById('display-balance-due')) {
                    document.getElementById('display-balance-due').textContent = `Ksh ${balance.toLocaleString()}`;
                    const balBox = document.getElementById('balance-box');
                    if (balBox) balBox.className = balance > 0 ? 'stat-box box-red' : 'stat-box box-green';
                }
            }
        }
    } catch (err) {
        logDebug("Error refreshing financial display:", err, 'warning');
        // Continue with payment display even if financial update fails
    }

    // Update the payment history table with edit/delete buttons
    paymentTbody.innerHTML = payments.length ? payments.map(p => `
        <tr style="background: ${p.deleted_at ? '#f8d7da' : 'transparent'};">
            <td>${formatDate(p.recorded_at)}</td>
            <td style="color: #28a745; font-weight: bold;">Ksh ${p.amount.toLocaleString()}</td>
            <td style="font-size: 0.75em; color: #666;">${p.payment_method || 'cash'}</td>
            <td style="max-width: 80px; overflow: hidden; text-overflow: ellipsis;">${p.notes || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
                ${p.deleted_at
            ? `<span style="color: #dc3545; font-size: 0.75em;">🗑️ Deleted</span>`
            : `<button onclick="openPaymentEditModal('${p.id}')" style="padding: 4px 8px; background: var(--brand-gold); color: black; border: none; border-radius: 3px; cursor: pointer; font-size: 0.75em;">Edit</button>
                       <button onclick="deletePaymentRecord('${p.id}')" style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 2px; font-size: 0.75em;">Del</button>`
        }
            </td>
        </tr>
        ${p.edited_at ? `<tr style="background: #f0f0f0; font-size: 0.75em; color: #666;"><td colspan="5">✏️ Last edited ${formatDate(p.edited_at)} by ${p.edited_by ? p.edited_by.slice(-6) : 'Admin'}</td></tr>` : ''}
        ${p.deleted_at ? `<tr style="background: #f0f0f0; font-size: 0.75em; color: #999;"><td colspan="5">🗑️ Soft-deleted ${formatDate(p.deleted_at)} by ${p.deleted_by ? p.deleted_by.slice(-6) : 'Admin'}</td></tr>` : ''}
    `).join('') : '<tr><td colspan="5" style="text-align:center; padding:15px;">No payments recorded yet.</td></tr>';
}

async function loadTransactionKPIs() {
    if (!USER_PROFILE) return;
    try {
        let paymentsQuery = supabaseClient.from('payments').select('amount').is('deleted_at', null).eq('organization_id', USER_PROFILE.organization_id);
        let ordersQuery = supabaseClient.from('orders').select('price').eq('organization_id', USER_PROFILE.organization_id);
        let accessoriesQuery = supabaseClient.from('order_accessories').select('price, quantity').eq('organization_id', USER_PROFILE.organization_id);

        const [paymentsRes, ordersRes, accRes] = await Promise.all([paymentsQuery, ordersQuery, accessoriesQuery]);

        const payments = paymentsRes.data || [];
        const orders = ordersRes.data || [];
        const accessories = accRes.data || [];

        const totalOrdersCount = orders.length;
        const accTotal = accessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0);
        const expectedValue = orders.reduce((sum, o) => sum + (o.price || 0), 0) + accTotal;
        const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const expectedBalance = expectedValue - totalRevenue;

        const formatCurrency = (val) => `Ksh ${val.toLocaleString()}`;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal('trans-total-orders', totalOrdersCount);
        setVal('trans-expected-value', formatCurrency(expectedValue));
        setVal('trans-total-revenue', formatCurrency(totalRevenue));
        setVal('trans-expected-balance', formatCurrency(expectedBalance));

    } catch (err) {
        logDebug("Error loading trans KPIs", err, "error");
    }
}

async function loadAllTransactions() {
    if (!USER_PROFILE) return;
    const tbody = document.getElementById('all-transactions-tbody');
    if (!tbody) return;

    loadTransactionKPIs();

    try {
        const typeFilter = document.getElementById('transaction-type-filter')?.value || 'all';

        let orderQuery = supabaseClient.from('orders').select('id, garment_type, customer_name, price, created_at, status').eq('organization_id', USER_PROFILE.organization_id).order('created_at', { ascending: false }).limit(250);
        let paymentQuery = supabaseClient.from('payments').select('id, amount, payment_method, recorded_at, order_id').eq('organization_id', USER_PROFILE.organization_id).is('deleted_at', null).order('recorded_at', { ascending: false }).limit(250);
        let expenseQuery = supabaseClient.from('expenses').select('id, amount, item_name, category, incurred_at').eq('organization_id', USER_PROFILE.organization_id).order('incurred_at', { ascending: false }).limit(250);

        const [ordersData, paymentsData, expensesData] = await Promise.all([orderQuery, paymentQuery, expenseQuery]);

        if (ordersData.error) logDebug("Orders Query Error", ordersData.error, "error");
        if (paymentsData.error) logDebug("Payments Query Error", paymentsData.error, "error");
        if (expensesData.error) logDebug("Expenses Query Error", expensesData.error, "error");

        let transactions = [];
        
        // Manual client-side mapping to avoid any PostgREST Foreign Key join issues
        const orderMap = {};
        if (ordersData.data) {
            ordersData.data.forEach(o => orderMap[o.id] = o);
        }

        if ((typeFilter === 'all' || typeFilter === 'order') && ordersData.data) {
            ordersData.data.forEach(o => transactions.push({
                type: 'Order',
                time: o.created_at,
                customer: o.customer_name,
                details: `Item: ${o.garment_type}`,
                amount: o.price || 0,
                color: '#3b82f6',
                bg: 'rgba(59, 130, 246, 0.1)',
                icon: 'fa-tshirt'
            }));
        }

        if ((typeFilter === 'all' || typeFilter === 'payment') && paymentsData.data) {
            paymentsData.data.forEach(p => {
                const relatedOrder = orderMap[p.order_id] || {};
                const isEscrow = p.payment_method?.includes('Escrow');
                transactions.push({
                    type: isEscrow ? 'Escrow Payment' : 'Payment',
                    time: p.recorded_at,
                    customer: relatedOrder.customer_name || 'Unknown',
                    details: `Method: ${p.payment_method || 'Cash'} ${relatedOrder.garment_type ? '(' + relatedOrder.garment_type + ')' : ''}`,
                    amount: p.amount || 0,
                    color: isEscrow ? 'var(--brand-gold)' : '#10b981',
                    bg: isEscrow ? 'rgba(212, 175, 55, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    icon: isEscrow ? 'fa-shield-alt' : 'fa-money-bill-wave'
                });
            });
        }

        if ((typeFilter === 'all' || typeFilter === 'expense') && expensesData.data) {
            expensesData.data.forEach(e => transactions.push({
                type: 'Expense',
                time: e.incurred_at,
                customer: 'Business Expense',
                details: `Item: ${e.item_name || 'Unnamed'} (${e.category || 'General'})`,
                amount: e.amount || 0,
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.1)',
                icon: 'fa-file-invoice-dollar'
            }));
        }

        transactions.sort((a, b) => new Date(b.time) - new Date(a.time));

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color:#94a3b8;">No transactions found for the selected filter.</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(t => `
            <tr style="transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 15px; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; background: ${t.bg}; color: ${t.color}; border-radius: 20px; font-size: 0.85em; font-weight: 600;">
                        <i class="fas ${t.icon}"></i> ${t.type}
                    </span>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 0.9em;">
                    ${formatDate(t.time)}
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #f1f5f9; font-weight: 500; color: var(--brand-navy);">
                    ${t.customer}
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 0.9em;">
                    ${t.details}
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: ${t.type === 'Expense' ? '#ef4444' : t.type === 'Payment' ? '#10b981' : 'var(--brand-navy)'};">
                    ${t.type === 'Expense' ? '-' : ''}Ksh ${Math.abs(t.amount).toLocaleString()}
                </td>
            </tr>
        `).join('');

    } catch (error) {
        logDebug("Error loading transactions:", error, 'error');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color:red;">Failed to load transactions.</td></tr>';
    }
}

async function exportTransactionsCSV() {
    try {
        const typeFilter = document.getElementById('transaction-type-filter')?.value || 'all';

        let orderQuery = supabaseClient.from('orders').select('id, garment_type, customer_name, price, created_at, status').order('created_at', { ascending: false }).limit(250);
        let paymentQuery = supabaseClient.from('payments').select('id, amount, payment_method, recorded_at, order_id').is('deleted_at', null).order('recorded_at', { ascending: false }).limit(250);
        let expenseQuery = supabaseClient.from('expenses').select('id, amount, item_name, category, incurred_at').order('incurred_at', { ascending: false }).limit(250);

        const [ordersData, paymentsData, expensesData] = await Promise.all([orderQuery, paymentQuery, expenseQuery]);

        let rawTransactions = [];
        
        const orderMap = {};
        if (ordersData.data) {
            ordersData.data.forEach(o => orderMap[o.id] = o);
        }

        if ((typeFilter === 'all' || typeFilter === 'order') && ordersData.data) {
            ordersData.data.forEach(o => rawTransactions.push({
                type: 'Order',
                time: o.created_at,
                customer: o.customer_name,
                details: `Item: ${o.garment_type}`,
                amount: o.price || 0
            }));
        }

        if ((typeFilter === 'all' || typeFilter === 'payment') && paymentsData.data) {
            paymentsData.data.forEach(p => {
                const relatedOrder = orderMap[p.order_id] || {};
                const isEscrow = p.payment_method?.includes('Escrow');
                rawTransactions.push({
                    type: isEscrow ? 'Escrow Payment' : 'Payment',
                    time: p.recorded_at,
                    customer: relatedOrder.customer_name || 'Unknown',
                    details: `Method: ${p.payment_method || 'Cash'} ${relatedOrder.garment_type ? '(' + relatedOrder.garment_type + ')' : ''}`,
                    amount: p.amount || 0
                });
            });
        }
        
        if ((typeFilter === 'all' || typeFilter === 'expense') && expensesData.data) {
            expensesData.data.forEach(e => rawTransactions.push({
                type: 'Expense',
                time: e.incurred_at,
                customer: 'Business Expense',
                details: `Item: ${e.item_name || 'Unnamed'} (${e.category || 'General'})`,
                amount: -(e.amount || 0)
            }));
        }

        rawTransactions.sort((a, b) => new Date(b.time) - new Date(a.time));

        if (rawTransactions.length === 0) {
            alert("No transactions to export.");
            return;
        }

        let csvContent = "Type,Date,Client,Details,Amount (Ksh)\n";

        rawTransactions.forEach(row => {
            let safeDetails = (row.details || '').toString().replace(/"/g, '""');
            let safeCustomer = (row.customer || '').toString().replace(/"/g, '""');
            let safeDate = formatDate(row.time).replace(/"/g, '""');

            csvContent += `"${row.type}","${safeDate}","${safeCustomer}","${safeDetails}","${row.amount}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Transactions_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        logDebug("Error exporting transactions CSV:", error, 'error');
        alert("Failed to export transactions.");
    }
}

async function loadExpensesScreen() {
    logDebug("Loading expenses screen", null, 'info');

    try {
        // Setup form
        const form = document.getElementById('expense-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                try {
                    const expenseData = {
                        organization_id: USER_PROFILE.organization_id, // ðŸ‘ˆ Multi-tenant safe
                        shop_id: USER_PROFILE.shop_id,
                        manager_id: USER_PROFILE.id,
                        item_name: document.getElementById('ex-name').value || 'General',
                        amount: parseFloat(document.getElementById('ex-amount').value) || 0,
                        category: document.getElementById('ex-cat').value,
                        notes: document.getElementById('ex-notes').value || '',
                        incurred_at: new Date().toISOString()
                    };

                    const { error } = await supabaseClient
                        .from('expenses')
                        .insert([expenseData]);

                    if (error) throw error;

                    alert("Expense added successfully!");
                    form.reset();
                    loadExpensesList();

                } catch (error) {
                    alert("Error adding expense: " + error.message);
                }
            };
        }

        // Load expenses list
        await loadExpensesList();

    } catch (error) {
        logDebug("Error loading expenses screen:", error, 'error');
    }
}

async function loadExpensesList() {
    if (!USER_PROFILE?.shop_id) return;

    try {
        const { data: expenses, error } = await supabaseClient
            .from('expenses')
            .select('*')
            .eq('shop_id', USER_PROFILE.shop_id)
            .order('incurred_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('expenses-tbody');
        if (tbody) {
            if (!expenses || expenses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No expenses recorded</td></tr>';
                return;
            }

            tbody.innerHTML = expenses.map(expense => `
                <tr>
                    <td>${formatDate(expense.incurred_at)}</td>
                    <td><b>${expense.category}</b></td>
                    <td>${expense.item_name}</td>
                    <td style="font-weight:bold;">Ksh ${parseFloat(expense.amount).toLocaleString()}</td>
                    <td>${expense.notes || '-'}</td>
                    <td>
                        <button class="small-btn" style="background:#3b82f6; width: auto;" 
                                onclick="generateExpenseInvoice('${expense.id}')">
                            ðŸ“„ Req Funds
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        logDebug(`Loaded ${expenses?.length || 0} expenses`, null, 'success');
    } catch (error) {
        logDebug("Error loading expenses list:", error, 'error');
    }
}

async function loadAdminExpensesScreen() {
    logDebug("Loading admin expenses screen", null, 'info');

    try {
        // Load Shops for filter and form
        await loadShopsForDropdown('admin-ex-shop');
        await loadShopsForDropdown('admin-exp-shop-filter');

        const form = document.getElementById('admin-expense-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                try {
                    const shopId = document.getElementById('admin-ex-shop').value || null;

                    const expenseData = {
                        organization_id: USER_PROFILE.organization_id, // ðŸ‘ˆ Multi-tenant safe
                        shop_id: shopId,
                        manager_id: USER_PROFILE.id, // Admin who recorded it
                        item_name: document.getElementById('admin-ex-name').value || 'Global Expense',
                        amount: parseFloat(document.getElementById('admin-ex-amount').value) || 0,
                        category: document.getElementById('admin-ex-cat').value,
                        notes: document.getElementById('admin-ex-notes').value || '',
                        incurred_at: new Date().toISOString()
                    };

                    const { error } = await supabaseClient
                        .from('expenses')
                        .insert([expenseData]);

                    if (error) throw error;

                    alert("Expense recorded successfully!");
                    form.reset();
                    loadAdminExpensesList();

                } catch (error) {
                    alert("Error adding expense: " + error.message);
                }
            };
        }

        const shopFilter = document.getElementById('admin-exp-shop-filter');
        if (shopFilter) {
            shopFilter.addEventListener('change', loadAdminExpensesList);
        }

        // Load list
        await loadAdminExpensesList();

    } catch (error) {
        logDebug("Error loading admin expenses screen:", error, 'error');
    }
}

async function loadAdminExpensesList() {
    try {
        const shopFilterValue = document.getElementById('admin-exp-shop-filter')?.value || '';

        let query = supabaseClient
            .from('expenses')
            .select('*, shops(name)')
            .order('incurred_at', { ascending: false });

        if (shopFilterValue === 'global') {
            query = query.is('shop_id', null);
        } else if (shopFilterValue !== '') {
            query = query.eq('shop_id', shopFilterValue);
        }

        let expenses = null;
        try {
            const res = await (window.OfflineStore
                ? window.OfflineStore.fetchWithFallback('expenses', () => query)
                : query);
            expenses = res?.data || [];
        } catch (e) {
            if (window.OfflineStore) {
                expenses = (await window.OfflineStore.getCache('expenses')) || [];
            }
        }
        expenses = expenses || [];

        // Render Summary Cards
        renderExpenseSummaryCards(expenses);

        const tbody = document.getElementById('admin-expenses-tbody');
        if (tbody) {
            if (!expenses || expenses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No expenses found</td></tr>';
                return;
            }

            tbody.innerHTML = expenses.map(expense => `
                <tr>
                    <td>${formatDate(expense.incurred_at)}</td>
                    <td>${expense.shops?.name || '<span style="color:#d4af37; font-weight:bold;">HQ Global</span>'}</td>
                    <td><b>${expense.category}</b></td>
                    <td>${expense.item_name}</td>
                    <td style="font-weight:bold;">Ksh ${parseFloat(expense.amount).toLocaleString()}</td>
                    <td>${expense.notes || '-'}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="small-btn" style="background:#3b82f6; padding: 5px 8px;" 
                                    onclick="generateExpenseInvoice('${expense.id}')" title="Invoice">
                                <i class="fas fa-file-invoice"></i>
                            </button>
                            <button class="small-btn" style="background:#10b981; padding: 5px 8px;" 
                                    onclick="openEditExpenseModal('${expense.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="small-btn" style="background:#ef4444; padding: 5px 8px;" 
                                    onclick="deleteExpense('${expense.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        logDebug("Error loading admin expenses list:", error, 'error');
    }
}

function renderExpenseSummaryCards(expenses) {
    const cardsContainer = document.getElementById('expense-summary-cards');
    if (!cardsContainer) return;

    if (!expenses || expenses.length === 0) {
        cardsContainer.innerHTML = '<p style="color: #64748b; font-style: italic;">No expense data for cards.</p>';
        return;
    }

    // Group expenses by category
    const summary = {};
    expenses.forEach(ex => {
        const cat = ex.category || 'Misc';
        if (!summary[cat]) {
            summary[cat] = { total: 0, count: 0 };
        }
        summary[cat].total += parseFloat(ex.amount || 0);
        summary[cat].count += 1;
    });

    const categoryIcons = {
        'Fabrics/Materials': 'fa-scissors',
        'Tailoring Supplies': 'fa-needle',
        'Haberdashery': 'fa-needle', // Compatibility
        'Wages': 'fa-money-bill-wave',
        'Transport': 'fa-truck',
        'Utilities': 'fa-bolt',
        'Rent': 'fa-building',
        'Food': 'fa-utensils',
        'Airtime': 'fa-mobile-alt',
        'Repairs': 'fa-tools',
        'Misc': 'fa-box-open'
    };

    cardsContainer.innerHTML = Object.keys(summary).sort((a, b) => summary[b].total - summary[a].total).map(cat => {
        const icon = categoryIcons[cat] || 'fa-tag';
        const data = summary[cat];

        // Simpler display names
        let displayName = cat.split('/')[0];
        if (cat === 'Tailoring Supplies' || cat === 'Haberdashery') displayName = 'Supplies';
        if (cat === 'Fabrics/Materials') displayName = 'Materials';
        if (cat === 'Utilities') displayName = 'Stima/Water';
        if (cat === 'Wages') displayName = 'Fundi Wages';

        return `
            <div class="expense-summary-card">
                <div class="ex-icon-circle">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="ex-info">
                    <h4>${displayName}</h4>
                    <p class="ex-amount">Ksh ${data.total.toLocaleString()}</p>
                    <p class="ex-count">${data.count} entry${data.count !== 1 ? 'ies' : ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense? This will affect financial calculations.")) return;

    try {
        const { error } = await supabaseClient
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Expense deleted successfully!");
        loadAdminExpensesList();

        // Refresh analytics if they exist in cache/system
        if (typeof loadAnalyticsDashboard === 'function') loadAnalyticsDashboard();
        if (typeof loadBIAnalytics === 'function') loadBIAnalytics();

    } catch (error) {
        alert("Error deleting expense: " + error.message);
    }
}

async function openEditExpenseModal(id) {
    try {
        const { data: expense, error } = await supabaseClient
            .from('expenses')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Load shops for the modal select
        await loadShopsForDropdown('edit-ex-shop');

        // Populate fields
        document.getElementById('edit-ex-id').value = expense.id;
        document.getElementById('edit-ex-shop').value = expense.shop_id || '';
        document.getElementById('edit-ex-cat').value = expense.category;
        document.getElementById('edit-ex-amount').value = expense.amount;
        document.getElementById('edit-ex-name').value = expense.item_name;
        document.getElementById('edit-ex-notes').value = expense.notes || '';

        // Show modal
        const modal = document.getElementById('edit-expense-modal');
        if (modal) {
            modal.style.display = 'block';

            // Setup submit handler
            const form = document.getElementById('edit-expense-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                await updateExpense(id);
            };
        }

    } catch (error) {
        alert("Error loading expense details: " + error.message);
    }
}

function closeEditExpenseModal() {
    const modal = document.getElementById('edit-expense-modal');
    if (modal) modal.style.display = 'none';
}

async function updateExpense(id) {
    try {
        const expenseData = {
            shop_id: document.getElementById('edit-ex-shop').value || null,
            item_name: document.getElementById('edit-ex-name').value,
            amount: parseFloat(document.getElementById('edit-ex-amount').value) || 0,
            category: document.getElementById('edit-ex-cat').value,
            notes: document.getElementById('edit-ex-notes').value
        };

        const { error } = await supabaseClient
            .from('expenses')
            .update(expenseData)
            .eq('id', id);

        if (error) throw error;

        alert("Expense updated successfully!");
        closeEditExpenseModal();
        loadAdminExpensesList();

        // Refresh analytics
        if (typeof loadAnalyticsDashboard === 'function') loadAnalyticsDashboard();
        if (typeof loadBIAnalytics === 'function') loadBIAnalytics();

    } catch (error) {
        alert("Error updating expense: " + error.message);
    }
}

window.generateExpenseInvoice = async function (expenseId) {
    if (!expenseId) return alert("Expense ID not found");
    try {
        const [{ data: expense }, { data: profile }] = await Promise.all([
            supabaseClient.from('expenses').select('*').eq('id', expenseId).single(),
            supabaseClient.from('user_profiles').select('full_name').eq('id', USER_PROFILE?.id).single()
        ]);
        if (!expense) throw new Error("Expense not found");

        // Fetch shop details separately
        if (expense.shop_id) {
            const { data: shop } = await supabaseClient.from('shops').select('*').eq('id', expense.shop_id).single();
            expense.shops = shop;
        }

        const amount = parseFloat(expense.amount) || 0;
        const recordedBy = profile?.full_name || USER_PROFILE?.full_name || 'Administrator';
        const year = new Date(expense.incurred_at || expense.created_at).getFullYear();
        const shop = expense.shops || {};

        const doc = buildInvoiceDocument({
            title: "EXPENSE REQUISITION",
            subtitle: shop.receipt_header_text || "Authorized Internal Request",
            companyName: shop.name || APP_CONFIG?.companyName || "Sir's 'n' Suits",
            companySubtitle: shop.receipt_header_text || "Authorized Internal Request",
            companyPhone: shop.phone_number || APP_CONFIG?.shopPhone || "",
            logoUrl: shop.logo_url || null,
            paymentMethodType: shop.payment_method_type || 'paybill',
            paybill: shop.paybill_number || APP_CONFIG?.billing?.paybill,
            account: shop.paybill_account || APP_CONFIG?.billing?.account,
            tillNumber: shop.till_number || '',
            pochiNumber: shop.pochi_number || '',
            invoiceNumber: `EXP-${year}-${String(expense.id).slice(-6).toUpperCase()}`,
            date: formatDate(expense.incurred_at || expense.created_at),
            dueDate: "Immediate",
            billToLabel: "Requested By:",
            billToName: recordedBy,
            billToSub: "Target Shop: " + (expense.shop_id ? "Production Unit" : "Global HQ"),
            items: [{
                description: `${expense.category || 'Expense'}: ${expense.item_name || ''}`,
                qty: 1,
                unitPrice: amount,
                total: amount
            }],
            totals: { subtotal: amount, paid: 0, balance: amount },
            showPaymentDetails: false,
            accountName: shop.name || APP_CONFIG?.billing?.accountName
        });

        openInvoicePrintWindow(doc, `Requisition_${String(expense.id).slice(0, 6)}`);

    } catch (error) {
        logDebug("Expense Requisition Error:", error, 'error');
        alert("Error generating requisition: " + error.message);
    }
}

