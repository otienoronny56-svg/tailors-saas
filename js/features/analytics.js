// ==========================================
// 📊 ANALYTICS, BI & DASHBOARD MODULE
// Extracted from app.js
// ==========================================

async function loadSuperadminDashboard() {
    try {
        let authUsersCount = 0;
        try {
            const adminClient = getAdminClient();
            if (adminClient) {
                const { data } = await adminClient.auth.admin.listUsers();
                if (data && data.users) authUsersCount = data.users.length;
            }
        } catch(e) {
            console.warn("Could not fetch exact auth users, falling back to profiles.");
        }

        const [{ data: orgs }, { data: profiles }] = await Promise.all([
            supabaseClient.from('organizations').select('*').order('created_at', { ascending: true }),
            supabaseClient.from('user_profiles').select('*')
        ]);

        const totalOrgs = orgs?.length || 0;
        const totalUsers = authUsersCount || profiles?.length || 0;
        
        // Calculate Online Now (within 5 mins)
        const onlineNow = profiles?.filter(p => {
            if (!p.last_seen_at) return false;
            return (new Date() - new Date(p.last_seen_at)) < 5 * 60 * 1000;
        }).length || 0;

        // Calculate SaaS Metrics
        const projectedMRR = totalOrgs * 500;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentOrgs = orgs?.filter(o => new Date(o.created_at) > thirtyDaysAgo).length || 0;

        // Update KPI Cards
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('total-orgs', totalOrgs);
        setEl('total-users', totalUsers);
        setEl('projected-mrr', `Ksh ${projectedMRR.toLocaleString()}`);
        setEl('org-growth-text', `+${recentOrgs}`);        // --- Growth Pulse Chart ---
        const canvas = document.getElementById('growthPulseChart');
        let currentGrowthFilter = 'monthly';
        
        window.setGrowthFilter = function(filter) {
            currentGrowthFilter = filter;
            // Update UI buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                if (btn.innerText.toLowerCase() === filter) {
                    btn.classList.add('active');
                    btn.style.background = document.body.classList.contains('dark-mode') ? '#1e293b' : '#ffffff';
                    btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'transparent';
                    btn.style.boxShadow = 'none';
                }
            });
            renderGrowthPulse();
        };

        function renderGrowthPulse() {
            if (!canvas || !orgs) return;
            const ctx = canvas.getContext('2d');
            
            let labels = [];
            let dataPoints = [];
            let base = orgs.length > 0 ? orgs.length : 10; // Use actual length for stepSize scaling
            
            // Helper: Count orgs created on or before a given date
            const countOrgsUpTo = (dateObj) => {
                const targetTime = dateObj.getTime();
                return orgs.filter(o => new Date(o.created_at).getTime() <= targetTime).length;
            };

            if (currentGrowthFilter === 'monthly') {
                // Last 30 days, step by 3 days
                for(let i=30; i>=0; i-=3) {
                    let d = new Date(); 
                    d.setDate(d.getDate() - i);
                    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
                    dataPoints.push(countOrgsUpTo(d)); 
                }
            } else if (currentGrowthFilter === 'quarterly') {
                // Last 12 weeks, step by 1 week
                for(let i=12; i>=0; i--) {
                    let d = new Date(); 
                    d.setDate(d.getDate() - (i*7));
                    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
                    dataPoints.push(countOrgsUpTo(d));
                }
            } else {
                // Last 12 months, step by 1 month
                for(let i=11; i>=0; i--) {
                    let d = new Date(); 
                    d.setMonth(d.getMonth() - i);
                    // End of month approximation
                    d.setDate(28); 
                    labels.push(d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
                    dataPoints.push(countOrgsUpTo(d));
                }
            }

            // Always ensure the final point accurately reflects right now
            dataPoints[dataPoints.length-1] = orgs.length;

            if (window.superadminCharts && window.superadminCharts.growthPulse) {
                window.superadminCharts.growthPulse.destroy();
            }
            if (!window.superadminCharts) window.superadminCharts = {};

            // Create gradient
            let gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

            window.superadminCharts.growthPulse = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Total Organizations',
                        data: dataPoints,
                        borderColor: '#10b981',
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { 
                            type: 'category',
                            grid: { display: false },
                            ticks: { 
                                autoSkip: true, 
                                maxRotation: 0,
                                font: { size: 10 },
                                color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#64748b'
                            }
                        },
                        y: { 
                            beginAtZero: true, 
                            grid: {
                                color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                stepSize: Math.ceil(base/4) || 1,
                                color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#64748b'
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { 
                            mode: 'index', 
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleFont: { size: 13 },
                            bodyFont: { size: 13 },
                            padding: 10,
                            cornerRadius: 8,
                            displayColors: false
                        }
                    }
                }
            });
        }
        
        // Initial render
        renderGrowthPulse();

        // --- Subscription Tier Distribution Chart ---
        const tierCanvas = document.getElementById('tierDistributionChart');
        if (tierCanvas && orgs) {
            const tierCtx = tierCanvas.getContext('2d');
            
            // Calculate distribution
            const tiers = { 'Free': 0, 'Basic': 0, 'Premium': 0 };
            orgs.forEach(o => {
                const t = o.subscription_tier || 'Free';
                if (tiers[t] !== undefined) tiers[t]++;
                else tiers[t] = 1;
            });

            if (window.superadminCharts && window.superadminCharts.tierDist) {
                window.superadminCharts.tierDist.destroy();
            }

            window.superadminCharts.tierDist = new Chart(tierCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(tiers),
                    datasets: [{
                        data: Object.values(tiers),
                        backgroundColor: [
                            'rgba(136, 146, 176, 0.8)', // Free (Slate)
                            'rgba(56, 189, 248, 0.8)',  // Basic (Blue)
                            'rgba(212, 175, 55, 0.8)'   // Premium (Gold)
                        ],
                        borderColor: document.body.classList.contains('dark-mode') ? '#1e293b' : '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#475569'
                            }
                        }
                    }
                }
            });
        }
        // --- Revenue by Tier (Bar Chart) ---
        const revCanvas = document.getElementById('revenueByTierChart');
        if (revCanvas && orgs) {
            const revCtx = revCanvas.getContext('2d');
            const revData = { 'Free': 0, 'Basic': 0, 'Premium': 0 };
            const mrrMap = { 'Free': 0, 'Basic': 1500, 'Premium': 4500 }; // Mock pricing
            
            orgs.forEach(o => {
                const t = o.subscription_tier || 'Free';
                if (revData[t] !== undefined) revData[t] += mrrMap[t];
            });

            if (window.superadminCharts && window.superadminCharts.revTier) {
                window.superadminCharts.revTier.destroy();
            }

            window.superadminCharts.revTier = new Chart(revCtx, {
                type: 'bar',
                data: {
                    labels: ['Free', 'Basic', 'Premium'],
                    datasets: [{
                        label: 'MRR (Ksh)',
                        data: [revData['Free'], revData['Basic'], revData['Premium']],
                        backgroundColor: [
                            'rgba(136, 146, 176, 0.7)', 
                            'rgba(56, 189, 248, 0.7)',  
                            'rgba(212, 175, 55, 0.7)'   
                        ],
                        borderRadius: 6,
                        borderWidth: 0
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#64748b' } },
                        y: { grid: { display: false }, ticks: { color: document.body.classList.contains('dark-mode') ? '#94a3b8' : '#64748b' } }
                    }
                }
            });
        }

        // --- Tenant Health (Doughnut Chart) ---
        const healthCanvas = document.getElementById('tenantHealthChart');
        if (healthCanvas && orgs) {
            const healthCtx = healthCanvas.getContext('2d');
            const healthStats = { 'Active': 0, 'Pending': 0, 'Suspended': 0 };
            
            orgs.forEach(o => {
                const status = o.status || 'Active';
                if (healthStats[status] !== undefined) healthStats[status]++;
                else healthStats['Suspended']++; // Treat unhandled as suspended for demo
            });

            if (window.superadminCharts && window.superadminCharts.healthDist) {
                window.superadminCharts.healthDist.destroy();
            }

            window.superadminCharts.healthDist = new Chart(healthCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Active', 'Pending', 'Suspended'],
                    datasets: [{
                        data: [healthStats['Active'], healthStats['Pending'], healthStats['Suspended']],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 2,
                        borderColor: document.body.classList.contains('dark-mode') ? '#1e293b' : '#ffffff',
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#475569' } }
                    }
                }
            });
        }

        // --- Recent Activity Feed ---
        const activityFeed = document.getElementById('platform-activity-feed');
        if (activityFeed) {
            let realEvents = [];

            // 1. Organization Events
            if (orgs) {
                orgs.forEach(o => {
                    // Registration
                    realEvents.push({
                        icon: 'fa-building', color: '#10b981', 
                        text: `New tenant registered: ${o.name}`, 
                        timestamp: new Date(o.created_at)
                    });
                    
                    // Suspended
                    if (o.status && o.status.toLowerCase() === 'suspended') {
                        realEvents.push({
                            icon: 'fa-ban', color: '#ef4444', 
                            text: `${o.name} was suspended`, 
                            timestamp: new Date(o.updated_at || o.created_at)
                        });
                    }
                    
                    // Upgraded Tier
                    if (o.subscription_tier && o.subscription_tier.toLowerCase() !== 'free') {
                        realEvents.push({
                            icon: 'fa-arrow-up', color: '#38bdf8', 
                            text: `${o.name} upgraded to ${o.subscription_tier} Tier`, 
                            timestamp: new Date(o.updated_at || o.created_at)
                        });
                    }
                });
            }

            // 2. Profile Events
            if (profiles) {
                profiles.forEach(p => {
                    if (p.role === 'owner' || p.role === 'admin') {
                        realEvents.push({
                            icon: 'fa-user-tie', color: '#8b5cf6', 
                            text: `New admin account: ${p.full_name || 'User'}`, 
                            timestamp: new Date(p.created_at)
                        });
                    }
                });
            }

            // Sort descending by date
            realEvents.sort((a, b) => b.timestamp - a.timestamp);
            
            // Take top 15
            realEvents = realEvents.slice(0, 15);

            // TimeAgo helper
            const timeAgo = (date) => {
                const seconds = Math.floor((new Date() - date) / 1000);
                if (seconds < 60) return "Just now";
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return minutes + " mins ago";
                const hours = Math.floor(minutes / 60);
                if (hours < 24) return hours + " hours ago";
                const days = Math.floor(hours / 24);
                return days + " days ago";
            };

            if (realEvents.length === 0) {
                activityFeed.innerHTML = '<div style="text-align: center; color: #94a3b8; margin-top: 50px;">No recent activity found.</div>';
            } else {
                activityFeed.innerHTML = realEvents.map(ev => `
                    <div style="display: flex; gap: 12px; align-items: flex-start; padding: 10px; background: rgba(148, 163, 184, 0.05); border-radius: 8px;">
                        <div style="background: ${ev.color}20; color: ${ev.color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas ${ev.icon}"></i>
                        </div>
                        <div>
                            <div style="font-size: 0.9em; font-weight: 500; color: var(--brand-slate);">${ev.text}</div>
                            <div style="font-size: 0.75em; color: #94a3b8; margin-top: 4px;">${timeAgo(ev.timestamp)}</div>
                        </div>
                    </div>
                `).join('');
            }
        }

    } catch (err) {
        console.error("Superadmin Dashboard Error:", err);
    }
}

document.addEventListener('themeToggled', () => {
    if (window.location.pathname.includes('superadmin-dashboard')) {
        loadSuperadminDashboard();
    }
});

async function loadAdminDashboard() {/* Lines 1587-1601 omitted */ }

async function loadAdminDashboard() {
    logDebug("Loading admin dashboard", null, 'info');

    try {
        await Promise.all([
            loadMetrics(),
            loadShopsForDropdown('shop-filter'),
            loadPendingClosureOrders()
        ]);

        addRefreshButton();

    } catch (error) {
        logDebug("Error loading admin dashboard:", error, 'error');
    }
}

async function loadMetrics() {/* Lines 1604-1625 omitted */ }

async function loadMetrics() {
    if (!USER_PROFILE) return;
    try {
        const { data: shops } = await supabaseClient.from('shops').select('id, name').eq('organization_id', USER_PROFILE.organization_id);
        if (!shops || shops.length === 0) return;
        const shopIds = shops.map(s => s.id);

        const [{ data: orders }, { data: allPayments }] = await Promise.all([
            supabaseClient.from('orders').select('id, shop_id, price, amount_paid, status, due_date').in('shop_id', shopIds),
            supabaseClient.from('payments').select('order_id, amount').is('deleted_at', null)
        ]);

        if (!orders) return;

        const paymentsByOrder = {};
        if (allPayments) {
            allPayments.forEach(p => {
                if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = 0;
                paymentsByOrder[p.order_id] += parseFloat(p.amount) || 0;
            });
        }

        // Fetch accessories in batches to avoid URL length limits
        const orderIds = orders.map(o => o.id);
        let accessories = [];
        for (let i = 0; i < orderIds.length; i += 200) {
            const batch = orderIds.slice(i, i + 200);
            const { data: accBatch } = await supabaseClient.from('order_accessories').select('*').in('order_id', batch);
            if (accBatch) accessories = accessories.concat(accBatch);
        }
        
        const accessoriesByOrder = {};
        accessories.forEach(a => {
            if (!accessoriesByOrder[a.order_id]) accessoriesByOrder[a.order_id] = [];
            accessoriesByOrder[a.order_id].push(a);
        });

        const shopMap = {};
        shops?.forEach(s => shopMap[s.id] = s.name);

        let totalRevenue = 0;
        let totalUnpaid = 0;
        let activeCount = 0;
        let readyCount = 0;
        let pendingCount = 0;
        let closedCount = 0;
        let overdueCount = 0;
        let dueTodayCount = 0;

        const shopRevenue = {};
        const shopUnpaid = {};

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        orders.forEach(o => {
            const paid = paymentsByOrder[o.id] || 0; // True dynamic revenue summing
            const price = parseFloat(o.price) || 0;
            const orderAccessories = accessoriesByOrder[o.id] || [];
            const accTotal = orderAccessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0);
            const totalPrice = price + accTotal;
            const unpaid = totalPrice - paid;

            totalRevenue += paid;
            totalUnpaid += unpaid;

            if (o.shop_id) {
                shopRevenue[o.shop_id] = (shopRevenue[o.shop_id] || 0) + paid;
                shopUnpaid[o.shop_id] = (shopUnpaid[o.shop_id] || 0) + unpaid;
            }

            // Status counts
            if (o.status === 7) closedCount++;
            else if (o.status === 6) pendingCount++;
            else if (o.status === 4) readyCount++;
            else activeCount++; // Status 1, 2, 3

            // Due status (only for non-closed orders)
            if (o.status < 7 && o.due_date) {
                const dueDate = new Date(o.due_date);
                dueDate.setHours(0, 0, 0, 0);

                if (dueDate < today) {
                    overdueCount++;
                } else if (dueDate.getTime() === today.getTime()) {
                    dueTodayCount++;
                }
            }
        });

        // Update UI
        if (document.getElementById('total-revenue')) document.getElementById('total-revenue').textContent = `Ksh ${totalRevenue.toLocaleString()}`;
        if (document.getElementById('total-unpaid')) document.getElementById('total-unpaid').textContent = `Ksh ${totalUnpaid.toLocaleString()}`;
        if (document.getElementById('active-count')) document.getElementById('active-count').textContent = activeCount;
        if (document.getElementById('ready-count')) document.getElementById('ready-count').textContent = readyCount;
        if (document.getElementById('pending-count')) document.getElementById('pending-count').textContent = pendingCount;
        if (document.getElementById('closed-count')) document.getElementById('closed-count').textContent = closedCount;
        if (document.getElementById('overdue-count')) document.getElementById('overdue-count').textContent = overdueCount;
        if (document.getElementById('due-today-count')) document.getElementById('due-today-count').textContent = dueTodayCount;
        if (document.getElementById('total-due-count')) document.getElementById('total-due-count').textContent = overdueCount + dueTodayCount;

        // Revenue Breakdown
        const revBreakdownEl = document.getElementById('revenue-breakdown');
        if (revBreakdownEl) {
            revBreakdownEl.innerHTML = Object.entries(shopRevenue).map(([id, amt]) => {
                return `<div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span>${shopMap[id] || 'Unknown'}:</span>
                    <span style="font-weight:600;">Ksh ${amt.toLocaleString()}</span>
                </div>`;
            }).join('');
        }

        // Unpaid Breakdown
        const unpaidBreakdownEl = document.getElementById('unpaid-breakdown');
        if (unpaidBreakdownEl) {
            unpaidBreakdownEl.innerHTML = Object.entries(shopUnpaid).map(([id, amt]) => {
                if (amt <= 0) return '';
                return `<div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span>${shopMap[id] || 'Unknown'}:</span>
                    <span style="font-weight:600;">Ksh ${amt.toLocaleString()}</span>
                </div>`;
            }).join('');
        }

        logDebug("Metrics loaded", { totalRevenue, totalUnpaid }, 'success');
    } catch (error) {
        logDebug("Error loading metrics:", error, 'error');
    }
}

async function loadKPIMetrics(shopId) {
    try {
        // Build queries - exclude soft-deleted payments
        // Build queries - RLS handles soft-deleted payments automatically
        let paymentsQuery = supabaseClient.from('payments').select('amount').is('deleted_at', null);
        let ordersQuery = supabaseClient.from('orders').select('id, price, status');
        let expensesQuery = supabaseClient.from('expenses').select('amount');
        let accessoriesQuery = supabaseClient.from('order_accessories').select('price, quantity');

        if (shopId !== 'all') {
            paymentsQuery = paymentsQuery.eq('orders.shop_id', shopId);
            ordersQuery = ordersQuery.eq('shop_id', shopId);
            expensesQuery = expensesQuery.eq('shop_id', shopId);
        }

        // Execute queries
        const [paymentsRes, ordersRes, expensesRes, accRes] = await Promise.all([
            paymentsQuery,
            ordersQuery,
            expensesQuery,
            accessoriesQuery
        ]);

        const payments = paymentsRes.data || [];
        const orders = ordersRes.data || [];
        const expenses = expensesRes.data || [];
        const accessories = accRes.data || [];

        // Calculate metrics
        const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const accTotal = accessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0);
        const totalOrderValue = orders.reduce((sum, o) => sum + (o.price || 0), 0) + accTotal;

        const netProfit = totalRevenue - totalExpenses;
        const outstandingBalance = totalOrderValue - totalRevenue;

        const activeOrders = orders.filter(o => o.status < 7).length;
        const completedOrders = orders.filter(o => o.status === 7).length;

        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

        // Update UI
        const updateMetric = (id, value, isCurrency = false) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = isCurrency ? `Ksh ${value.toLocaleString()}` : value.toString();
            }
        };

        updateMetric('total-revenue', totalRevenue, true);
        updateMetric('active-orders', activeOrders);
        updateMetric('avg-order-value', avgOrderValue, true);
        updateMetric('net-profit', netProfit, true);
        updateMetric('outstanding-balance', outstandingBalance, true);

        logDebug("KPI metrics loaded", { totalRevenue, activeOrders }, 'success');
    } catch (error) {
        logDebug("Error loading KPI metrics:", error, 'error');
    }
}

async function loadKPIMetrics(shopId) {
    try {
        let paymentsQuery = supabaseClient.from('payments').select('amount, recorded_at').is('deleted_at', null).eq('organization_id', USER_PROFILE.organization_id);
        let ordersQuery = supabaseClient.from('orders').select('id, price, status, created_at').eq('organization_id', USER_PROFILE.organization_id);
        let expensesQuery = supabaseClient.from('expenses').select('amount, incurred_at').eq('organization_id', USER_PROFILE.organization_id);
        let accessoriesQuery = supabaseClient.from('order_accessories').select('price, quantity').eq('organization_id', USER_PROFILE.organization_id);

        if (shopId !== 'all') {
            paymentsQuery = paymentsQuery.eq('orders.shop_id', shopId);
            ordersQuery = ordersQuery.eq('shop_id', shopId);
            expensesQuery = expensesQuery.eq('shop_id', shopId);
        }

        // Execute queries
        const [paymentsRes, ordersRes, expensesRes, accRes] = await Promise.all([
            paymentsQuery,
            ordersQuery,
            expensesQuery,
            accessoriesQuery
        ]);

        const payments = paymentsRes.data || [];
        const orders = ordersRes.data || [];
        const expenses = expensesRes.data || [];
        const accessories = accRes.data || [];

        // Calculate metrics
        const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const accTotal = accessories.reduce((sum, a) => sum + ((a.quantity || 0) * (a.price || 0)), 0);
        const totalOrderValue = orders.reduce((sum, o) => sum + (o.price || 0), 0) + accTotal;

        const netProfit = totalRevenue - totalExpenses;
        const outstandingBalance = totalOrderValue - totalRevenue;

        const activeOrders = orders.filter(o => o.status < 7).length;
        const completedOrders = orders.filter(o => o.status === 7).length;

        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

        // Trend calculations (Last 30 vs Prev 30)
        const splitByPeriod = (items, dateField) => {
            const now = new Date();
            const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const days60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

            let current = 0; let prev = 0; let currentCount = 0; let prevCount = 0;
            items.forEach(item => {
                const d = new Date(item[dateField] || item.created_at || new Date());
                const val = parseFloat(item.amount || item.price || 0);
                if (d >= days30) { current += val; currentCount++; }
                else if (d >= days60 && d < days30) { prev += val; prevCount++; }
            });
            return { current, prev, currentCount, prevCount };
        };

        const revTrend = splitByPeriod(payments, 'recorded_at');
        const expTrend = splitByPeriod(expenses, 'incurred_at');
        const orderTrend = splitByPeriod(orders, 'created_at');


        const calcTrendPct = (curr, prev) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        const revPct = calcTrendPct(revTrend.current, revTrend.prev);
        const profitCurrent = revTrend.current - expTrend.current;
        const profitPrev = revTrend.prev - expTrend.prev;
        const profitPct = calcTrendPct(profitCurrent, profitPrev);
        const orderCountPct = calcTrendPct(orderTrend.currentCount, orderTrend.prevCount);

        const avgOrderCurrent = orderTrend.currentCount > 0 ? revTrend.current / orderTrend.currentCount : 0;
        const avgOrderPrev = orderTrend.prevCount > 0 ? revTrend.prev / orderTrend.prevCount : 0;
        const avgPct = calcTrendPct(avgOrderCurrent, avgOrderPrev);

        // Update UI
        const updateMetric = (id, value, isCurrency = false) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = isCurrency ? `Ksh ${value.toLocaleString()}` : value.toString();
            }
        };

        const setTrend = (id, pct, invertColors = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = 'block';
            const isPositive = pct >= 0;
            const isGood = invertColors ? !isPositive : isPositive;
            const color = isGood ? '#10b981' : '#ef4444';
            const icon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
            const sign = isPositive ? '+' : '';
            if (pct === 0) {
                el.innerHTML = `<span style="color: #94a3b8">- 0.0%</span> <span style="color: #94a3b8; font-weight: normal; font-size: 0.8em;">vs last 30d</span>`;
            } else {
                el.innerHTML = `<span style="color: ${color}"><i class="fas ${icon}"></i> ${sign}${pct.toFixed(1)}%</span> <span style="color: #94a3b8; font-weight: normal; font-size: 0.8em;">vs last 30d</span>`;
            }
        };

        updateMetric('total-revenue', totalRevenue, true);
        setTrend('total-revenue-trend', revPct);

        updateMetric('active-orders', activeOrders);
        setTrend('active-orders-trend', orderCountPct);

        updateMetric('avg-order-value', Math.round(avgOrderValue), true);
        setTrend('avg-order-value-trend', avgPct);

        updateMetric('net-profit', netProfit, true);
        setTrend('net-profit-trend', profitPct);

        updateMetric('outstanding-balance', outstandingBalance, true);
        // Trend for outstanding balance doesn't make as much sense historically without snapshots, omitting.

        logDebug("KPI metrics loaded", { totalRevenue, activeOrders }, 'success');
    } catch (error) {
        logDebug("Error loading KPI metrics:", error, 'error');
    }
}

async function loadRevenueTrend(daysStr) {
    try {
        const days = parseInt(daysStr) || 30;

        let paymentsQuery = supabaseClient
            .from('payments')
            .select('amount, recorded_at')
            .order('recorded_at');

        // Apply Date Filter
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        paymentsQuery = paymentsQuery.gte('recorded_at', cutoffDate.toISOString());

        const { data: payments } = await paymentsQuery;

        // Group by date, filling missing days with 0
        const dailyRevenue = {};
        const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

        // Initialize all days in range to 0 to prevent cut-off charts
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dailyRevenue[dateFormat.format(d)] = 0;
        }

        if (payments) {
            payments.forEach(payment => {
                const date = new Date(payment.recorded_at);
                const dateKey = dateFormat.format(date);

                if (dailyRevenue[dateKey] !== undefined) {
                    dailyRevenue[dateKey] += payment.amount || 0;
                }
            });
        }

        const labels = Object.keys(dailyRevenue);
        const data = Object.values(dailyRevenue);

        // Create chart
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (analyticsCharts.revenueChart) {
            analyticsCharts.revenueChart.destroy();
        }

        analyticsCharts.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Revenue',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Revenue: Ksh ${context.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `Ksh ${value.toLocaleString()}`
                        }
                    }
                }
            }
        });

        logDebug("Revenue chart loaded", { dataPoints: data.length }, 'success');
    } catch (error) {
        logDebug("Error loading revenue chart:", error, 'error');
    }
}

async function loadRevenueTrend(daysStr) {
    try {
        const days = parseInt(daysStr) || 30;

        let paymentsQuery = supabaseClient
            .from('payments')
            .select('amount, recorded_at')
            .eq('organization_id', USER_PROFILE.organization_id)
            .order('recorded_at');

        // Apply Date Filter
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        paymentsQuery = paymentsQuery.gte('recorded_at', cutoffDate.toISOString());

        const { data: payments } = await paymentsQuery;

        // Group by date, filling missing days with 0
        const dailyRevenue = {};
        const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

        // Initialize all days in range to 0
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dailyRevenue[dateFormat.format(d)] = 0;
        }

        if (payments) {
            payments.forEach(payment => {
                const date = new Date(payment.recorded_at);
                const dateKey = dateFormat.format(date);

                if (dailyRevenue[dateKey] !== undefined) {
                    dailyRevenue[dateKey] += payment.amount || 0;
                }
            });
        }

        const labels = Object.keys(dailyRevenue);
        const data = Object.values(dailyRevenue);

        // Create chart
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (analyticsCharts.revenueChart) {
            analyticsCharts.revenueChart.destroy();
        }

        analyticsCharts.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Revenue',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#10b981',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: (context) => `Revenue: Ksh ${context.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [4, 4], color: '#f1f5f9' },
                        ticks: {
                            callback: (value) => `Ksh ${value.toLocaleString()}`
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

        logDebug("Revenue chart loaded", { dataPoints: data.length }, 'success');
    } catch (error) {
        logDebug("Error loading revenue chart:", error, 'error');
    }
}

async function loadShopPerformanceChart() {
    try {
        const [{ data: shops }, { data: orders }, { data: expenses }] = await Promise.all([
            supabaseClient.from('shops').select('id, name').eq('organization_id', USER_PROFILE.organization_id).order('name'),
            supabaseClient.from('orders').select('id, shop_id, price'),
            supabaseClient.from('expenses').select('shop_id, amount')
        ]);

        if (!shops) return;

        // Calculate shop performance
        const shopPerformance = shops.map(shop => {
            const shopOrders = orders?.filter(o => o.shop_id === shop.id) || [];
            const shopExpenses = expenses?.filter(e => e.shop_id === shop.id) || [];

            const revenue = shopOrders.reduce((sum, o) => sum + (o.price || 0), 0);
            const expense = shopExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            const profit = revenue - expense;

            return { name: shop.name, revenue, profit };
        }).sort((a, b) => b.revenue - b.revenue).slice(0, 10);

        const labels = shopPerformance.map(s => s.name);
        const revenueData = shopPerformance.map(s => s.revenue);
        const profitData = shopPerformance.map(s => s.profit);

        // Create chart
        const canvas = document.getElementById('shopPerformanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (analyticsCharts.shopPerformanceChart) {
            analyticsCharts.shopPerformanceChart.destroy();
        }

        analyticsCharts.shopPerformanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenueData,
                        backgroundColor: '#3b82f6'
                    },
                    {
                        label: 'Profit',
                        data: profitData,
                        backgroundColor: '#10b981'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        logDebug("Shop performance chart loaded", { shops: labels.length }, 'success');
    } catch (error) {
        logDebug("Error loading shop performance chart:", error, 'error');
    }
}

async function loadShopPerformanceChart() {
    try {
        const [{ data: shops }, { data: orders }, { data: expenses }] = await Promise.all([
            supabaseClient.from('shops').select('id, name').eq('organization_id', USER_PROFILE.organization_id).order('name'),
            supabaseClient.from('orders').select('id, shop_id, price').eq('organization_id', USER_PROFILE.organization_id),
            supabaseClient.from('expenses').select('shop_id, amount').eq('organization_id', USER_PROFILE.organization_id)
        ]);

        if (!shops) return;

        // Calculate shop performance
        const shopPerformance = shops.map(shop => {
            const shopOrders = orders?.filter(o => o.shop_id === shop.id) || [];
            const shopExpenses = expenses?.filter(e => e.shop_id === shop.id) || [];

            const revenue = shopOrders.reduce((sum, o) => sum + (o.price || 0), 0);
            const expense = shopExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            const profit = revenue - expense;
            const efficiency = revenue > 0 ? (profit / revenue) * 100 : 0;

            return { name: shop.name, revenue, profit, efficiency };
        }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

        // Store globally for tables to use
        window.shopRankings = shopPerformance;

        const labels = shopPerformance.map(s => s.name);
        const revenueData = shopPerformance.map(s => s.revenue);
        const profitData = shopPerformance.map(s => s.profit);

        // Create chart
        const canvas = document.getElementById('shopPerformanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (analyticsCharts.shopPerformanceChart) {
            analyticsCharts.shopPerformanceChart.destroy();
        }

        analyticsCharts.shopPerformanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenueData,
                        backgroundColor: 'rgba(59, 130, 246, 0.9)',
                        borderRadius: 12,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Profit',
                        data: profitData,
                        backgroundColor: 'rgba(16, 185, 129, 0.9)',
                        borderRadius: 12,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1500,
                    easing: 'easeOutBounce'
                },
                plugins: {
                    legend: {
                        labels: { usePointStyle: true, boxWidth: 10 }
                    },
                    tooltip: {
                        cornerRadius: 8,
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        grid: { borderDash: [5, 5], color: '#f1f5f9' },
                        beginAtZero: true
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

        logDebug("Shop performance chart loaded", { shops: labels.length }, 'success');
    } catch (error) {
        logDebug("Error loading shop performance chart:", error, 'error');
    }
}

async function loadPaymentMethodChart(shopId) {
    try {
        let paymentsQuery = supabaseClient
            .from('payments')
            .select('payment_method, amount');

        if (shopId !== 'all') {
            paymentsQuery = paymentsQuery.eq('orders.shop_id', shopId);
        }

        const { data: payments } = await paymentsQuery;

        // Group by method
        const methodData = {};
        if (payments) {
            payments.forEach(p => {
                // Normalize method name (capitalize first letter)
                let method = p.payment_method || 'Cash';
                method = method.charAt(0).toUpperCase() + method.slice(1);

                if (!methodData[method]) methodData[method] = 0;
                methodData[method] += p.amount || 0;
            });
        }

        const labels = Object.keys(methodData);
        const data = Object.values(methodData);

        // Create chart
        const canvas = document.getElementById('paymentMethodChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (analyticsCharts.paymentMethodChart) analyticsCharts.paymentMethodChart.destroy();

        analyticsCharts.paymentMethodChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Amount Collected',
                    data: data,
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.9)', 'rgba(59, 130, 246, 0.9)',
                        'rgba(245, 158, 11, 0.9)', 'rgba(139, 92, 246, 0.9)', 'rgba(239, 68, 68, 0.9)'
                    ],
                    borderRadius: 8,
                    barPercentage: 0.6,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1200, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: (context) => `Ksh ${context.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: { grid: { borderDash: [5, 5], color: '#f1f5f9' }, beginAtZero: true },
                    y: { grid: { display: false } }
                }
            }
        });
    } catch (error) {
        logDebug("Error loading payment method chart:", error, 'error');
    }
}

async function loadExpenseChart(shopId) {
    try {
        let expensesQuery = supabaseClient
            .from('expenses')
            .select('category, amount')
            .eq('organization_id', USER_PROFILE.organization_id);

        if (shopId !== 'all') {
            expensesQuery = expensesQuery.eq('shop_id', shopId);
        }

        const { data: expenses } = await expensesQuery;

        // Group by category
        const expenseByCategory = {};
        if (expenses) {
            expenses.forEach(expense => {
                const category = expense.category || 'Uncategorized';
                if (!expenseByCategory[category]) expenseByCategory[category] = 0;
                expenseByCategory[category] += expense.amount || 0;
            });
        }

        // Sort and take top 8
        const sortedCategories = Object.entries(expenseByCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8);

        const labels = sortedCategories.map(([category]) => category);
        const data = sortedCategories.map(([, amount]) => amount);

        // Create chart
        const canvas = document.getElementById('expenseChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (analyticsCharts.expenseChart) {
            analyticsCharts.expenseChart.destroy();
        }

        analyticsCharts.expenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expense Amount',
                    data: data,
                    backgroundColor: '#ef4444'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false
            }
        });

        logDebug("Expense chart loaded", { categories: labels.length }, 'success');
    } catch (error) {
        logDebug("Error loading expense chart:", error, 'error');
    }
}

async function loadExpenseChart(shopId) {
    try {
        let expensesQuery = supabaseClient
            .from('expenses')
            .select('category, amount')
            .eq('organization_id', USER_PROFILE.organization_id);

        if (shopId !== 'all') {
            expensesQuery = expensesQuery.eq('shop_id', shopId);
        }

        const { data: expenses } = await expensesQuery;

        // Group by category
        const expenseByCategory = {};
        if (expenses) {
            expenses.forEach(expense => {
                const category = expense.category || 'Uncategorized';
                if (!expenseByCategory[category]) expenseByCategory[category] = 0;
                expenseByCategory[category] += expense.amount || 0;
            });
        }

        // Sort and take top 8
        const sortedCategories = Object.entries(expenseByCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8);

        const labels = sortedCategories.map(([category]) => category);
        const data = sortedCategories.map(([, amount]) => amount);

        // Create chart
        const canvas = document.getElementById('expenseChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (analyticsCharts.expenseChart) {
            analyticsCharts.expenseChart.destroy();
        }

        analyticsCharts.expenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expense Amount',
                    data: data,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 10,
                    barPercentage: 0.6,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: (context) => `Ksh ${context.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { borderDash: [5, 5], color: '#f1f5f9' },
                        beginAtZero: true
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });

        logDebug("Expense chart loaded", { categories: labels.length }, 'success');
    } catch (error) {
        logDebug("Error loading expense chart:", error, 'error');
    }
}

async function loadPerformanceTables(shopId) {
    try {
        let ordersQuery = supabaseClient.from('orders').select('garment_type, price');
        if (shopId !== 'all') ordersQuery = ordersQuery.eq('shop_id', shopId);

        const { data: orders } = await ordersQuery;
        if (!orders) return;

        // --- 1. Top Products Table ---
        const productStats = {};
        orders.forEach(order => {
            const type = order.garment_type || 'Unknown';
            if (!productStats[type]) productStats[type] = { count: 0, revenue: 0 };
            productStats[type].count++;
            productStats[type].revenue += order.price || 0;
        });

        const topProducts = Object.entries(productStats)
            .map(([name, stats]) => ({
                name, count: stats.count, revenue: stats.revenue
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        const topProductsTable = document.getElementById('top-products-table');
        if (topProductsTable) {
            topProductsTable.innerHTML = topProducts.map(product => `
                <tr>
                    <td>${product.name}</td>
                    <td style="text-align: right;">${product.count}</td>
                    <td style="text-align: right; font-weight: 600;">Ksh ${product.revenue.toLocaleString()}</td>
                </tr>
            `).join('');
        }

        // --- 2. Shop Rankings Table (LIVE DATA FIX) ---
        const shopRankingTable = document.getElementById('shop-ranking-table');
        const rankings = window.shopRankings || []; // Reads from the variable set in loadShopPerformanceChart

        if (shopRankingTable) {
            if (rankings.length === 0) {
                shopRankingTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">No active shop data available.</td></tr>';
            } else {
                shopRankingTable.innerHTML = rankings.map((shop, index) => {
                    // Determine color based on efficiency score
                    const effColor = shop.efficiency >= 50 ? '#10b981' : shop.efficiency >= 20 ? '#f59e0b' : '#ef4444';

                    return `
                        <tr>
                            <td>
                                <span style="display: inline-block; width: 20px; height: 20px; background: ${index === 0 ? '#d4af37' : '#6c757d'}; color: white; border-radius: 50%; text-align: center; line-height: 20px; margin-right: 8px;">${index + 1}</span>
                                ${shop.name}
                            </td>
                            <td style="text-align: right;">Ksh ${shop.revenue.toLocaleString()}</td>
                            <td style="text-align: right; font-weight: 600; color: ${effColor};">Ksh ${shop.profit.toLocaleString()}</td>
                            <td style="text-align: right; color: ${effColor};">${shop.efficiency.toFixed(1)}%</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        logDebug("Error loading performance tables:", error, 'error');
    }
}

async function loadPerformanceTables(shopId) {
    try {
        let ordersQuery = supabaseClient.from('orders').select('garment_type, price, worker_id, workers(name)').eq('organization_id', USER_PROFILE.organization_id);

        if (shopId !== 'all') {
            ordersQuery = ordersQuery.eq('shop_id', shopId);
        }

        const { data: orders } = await ordersQuery;

        if (!orders) return;

        // Top Products
        const productStats = {};
        orders.forEach(order => {
            const type = order.garment_type || 'Unknown';
            if (!productStats[type]) productStats[type] = { count: 0, revenue: 0 };
            productStats[type].count++;
            productStats[type].revenue += order.price || 0;
        });

        const topProducts = Object.entries(productStats)
            .map(([name, stats]) => ({
                name,
                count: stats.count,
                revenue: stats.revenue
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        const topProductsTable = document.getElementById('top-products-table');
        if (topProductsTable) {
            topProductsTable.innerHTML = topProducts.map(product => `
                <tr>
                    <td>${product.name}</td>
                    <td style="text-align: right;">${product.count}</td>
                    <td style="text-align: right; font-weight: 600;">Ksh ${product.revenue.toLocaleString()}</td>
                </tr>
            `).join('');
        }

        // Top Workers Leaderboard
        const workerStats = {};
        orders.forEach(order => {
            if (order.worker_id) {
                const wName = order.workers?.name || 'Unknown Worker';
                if (!workerStats[wName]) workerStats[wName] = { count: 0, revenue: 0 };
                workerStats[wName].count++;
                workerStats[wName].revenue += order.price || 0;
            }
        });

        const topWorkers = Object.entries(workerStats)
            .map(([name, stats]) => ({
                name,
                count: stats.count,
                revenue: stats.revenue
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        const workerLeaderboardTable = document.getElementById('worker-leaderboard-table');
        if (workerLeaderboardTable) {
            if (topWorkers.length > 0) {
                workerLeaderboardTable.innerHTML = topWorkers.map(worker => `
                    <tr>
                        <td><i class="fas fa-user-circle" style="color: #8b5cf6; margin-right: 8px;"></i>${worker.name}</td>
                        <td style="text-align: right;">${worker.count}</td>
                        <td style="text-align: right; font-weight: 600; color: #10b981;">Ksh ${worker.revenue.toLocaleString()}</td>
                    </tr>
                `).join('');
            } else {
                workerLeaderboardTable.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">No worker data available</td></tr>';
            }
        }

        // Shop Rankings (Live Data)
        const shopRankingTable = document.getElementById('shop-ranking-table');
        const rankings = window.shopRankings || [];
        if (shopRankingTable) {
            shopRankingTable.innerHTML = rankings.length > 0 ? rankings.map((shop, index) => `
                <tr>
                    <td>
                        <span style="display: inline-block; width: 22px; height: 22px; background: ${index === 0 ? '#d4af37' : '#6c757d'}; color: white; border-radius: 50%; text-align: center; line-height: 22px; font-weight: bold; margin-right: 8px; font-size: 0.85em;">
                            ${index + 1}
                        </span>
                        ${shop.name}
                    </td>
                    <td style="text-align: right; font-weight: 600;">Ksh ${shop.revenue.toLocaleString()}</td>
                    <td style="text-align: right; font-weight: 600; color: ${shop.profit >= 0 ? '#10b981' : '#ef4444'};">Ksh ${shop.profit.toLocaleString()}</td>
                </tr>
            `).join('') : '<tr><td colspan="3" style="text-align:center; padding:20px;">Calculating live rankings...</td></tr>';
        }

        logDebug("Performance tables loaded", null, 'success');
    } catch (error) {
        logDebug("Error loading performance tables:", error, 'error');
    }
}

async function generateAIInsights(shopId) {
    try {
        // Get data
        const [{ data: orders }, { data: payments }, { data: expenses }] = await Promise.all([
            supabaseClient.from('orders').select('garment_type, price, status'),
            supabaseClient.from('payments').select('amount').is('deleted_at', null),
            supabaseClient.from('expenses').select('category, amount')
        ]);

        // Calculate insights
        const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
        const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

        // Generate insights HTML
        const aiContainer = document.getElementById('ai-insights-container');
        if (aiContainer) {
            aiContainer.innerHTML = `
                <div class="insights-grid">
                    <div class="insight-card">
                        <h4><i class="fas fa-lightbulb" style="color: #f59e0b;"></i> Revenue Opportunity</h4>
                        <p><span class="insight-metric">Suits</span> contribute <span class="insight-metric">42%</span> of revenue. Bundle with accessories to increase average order value.</p>
                    </div>
                    
                    <div class="insight-card">
                        <h4><i class="fas fa-chart-line" style="color: #10b981;"></i> Efficiency Score</h4>
                        <p>Current profit margin is <span class="insight-metric">${profitMargin.toFixed(1)}%</span>. Orders delivered within 3 days show <span class="insight-metric">25%</span> higher satisfaction.</p>
                    </div>
                    
                    <div class="insight-card">
                        <h4><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i> Cost Optimization</h4>
                        <p><span class="insight-metric">Material</span> costs account for <span class="insight-metric">35%</span> of expenses. Consider bulk purchasing for better rates.</p>
                    </div>
                    
                    <div class="insight-card">
                        <h4><i class="fas fa-tachometer-alt" style="color: #3b82f6;"></i> Performance Metric</h4>
                        <p>On-time delivery rate is <span class="insight-metric">92%</span>. Target <span class="insight-metric">95%</span> by optimizing workflow in alterations.</p>
                    </div>
                </div>
            `;
        }

        logDebug("AI insights generated", null, 'success');
    } catch (error) {
        logDebug("Error generating AI insights:", error, 'error');
    }
}

async function generateAIInsights(shopId) {
    try {
        // Get data
        const [{ data: orders }, { data: payments }, { data: expenses }] = await Promise.all([
            supabaseClient.from('orders').select('garment_type, price, status').eq('organization_id', USER_PROFILE.organization_id),
            supabaseClient.from('payments').select('amount').is('deleted_at', null).eq('organization_id', USER_PROFILE.organization_id),
            supabaseClient.from('expenses').select('category, amount').eq('organization_id', USER_PROFILE.organization_id)
        ]);

        // Calculate insights
        const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
        const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

        // Calculate real top product for insight
        const productRevenue = {};
        orders?.forEach(o => {
            const type = o.garment_type || 'Other';
            productRevenue[type] = (productRevenue[type] || 0) + (o.price || 0);
        });
        const topProduct = Object.keys(productRevenue).reduce((a, b) => productRevenue[a] > productRevenue[b] ? a : b, 'None');
        const topProductShare = totalRevenue > 0 ? ((productRevenue[topProduct] / totalRevenue) * 100).toFixed(0) : 0;

        // Calculate real top expense category
        const expenseCats = {};
        expenses?.forEach(e => {
            const cat = e.category || 'General';
            expenseCats[cat] = (expenseCats[cat] || 0) + (e.amount || 0);
        });
        const topExpense = Object.keys(expenseCats).reduce((a, b) => expenseCats[a] > expenseCats[b] ? a : b, 'None');
        const topExpenseShare = totalRevenue > 0 ? ((expenseCats[topExpense] / totalRevenue) * 100).toFixed(0) : 0;

        // Generate insights HTML
        const aiContainer = document.getElementById('ai-insights-container');
        if (aiContainer) {
            aiContainer.innerHTML = `
                <div class="insights-grid">
                    <div class="insight-card">
                        <h4><i class="fas fa-lightbulb" style="color: #f59e0b;"></i> Revenue Opportunity</h4>
                        <p><span class="insight-metric">${topProduct}</span> contribute <span class="insight-metric">${topProductShare}%</span> of revenue. Bundle with accessories to increase average order value.</p>
                    </div>
                    
                    <div class="insight-card">
                        <h4><i class="fas fa-chart-line" style="color: #10b981;"></i> Efficiency Score</h4>
                        <p>Current profit margin is <span class="insight-metric">${profitMargin.toFixed(1)}%</span>. Orders delivered within 3 days show <span class="insight-metric">25%</span> higher satisfaction.</p>
                    </div>
                    
                    <div class="insight-card">
                        <h4><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i> Cost Optimization</h4>
                        <p><span class="insight-metric">${topExpense}</span> costs account for <span class="insight-metric">${topExpenseShare}%</span> of revenue. Consider bulk purchasing for better rates.</p>
                    </div>
                    
                    <div class="insight-card">
                        <h4><i class="fas fa-tachometer-alt" style="color: #3b82f6;"></i> Performance Metric</h4>
                        <p>On-time delivery rate is <span class="insight-metric">92%</span>. Target <span class="insight-metric">95%</span> by optimizing workflow in alterations.</p>
                    </div>
                </div>
            `;
        }

        logDebug("AI insights generated", null, 'success');
    } catch (error) {
        logDebug("Error generating AI insights:", error, 'error');
    }
}

// --- Advanced Analytics Charts ---

async function loadRetentionChart(shopId = 'all') {
    const canvas = document.getElementById('retentionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const orders = window.advancedAnalyticsOrders || [];
    if (!orders || orders.length === 0) return;

    let newCount = 0;
    let returningCount = 0;
    const seenPhones = new Set();

    // Sort by oldest first to properly track first-time customers
    const sortedOrders = [...orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    sortedOrders.forEach(order => {
        if (!order.customer_phone) return; // Skip if no phone
        if (seenPhones.has(order.customer_phone)) {
            returningCount++;
        } else {
            newCount++;
            seenPhones.add(order.customer_phone);
        }
    });

    if (newCount === 0 && returningCount === 0) return;

    analyticsCharts.retentionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['New Customers', 'Returning Customers'],
            datasets: [{
                data: [newCount, returningCount],
                backgroundColor: ['#6366f1', '#10b981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = newCount + returningCount;
                            const percentage = Math.round((context.raw / total) * 100);
                            return ` ${context.label}: ${context.raw} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function loadEfficiencyChart(shopId = 'all') {
    const canvas = document.getElementById('efficiencyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const orders = window.advancedAnalyticsOrders || [];
    let labels = [];
    let data = [];

    if (orders && orders.length > 0) {
        const completedOrders = orders.filter(o => o.status === 5 || o.status === '5' || o.status === 6 || o.status === '6');
        
        if (completedOrders.length > 0) {
            // Group by month to show trend
            const monthMap = {};
            
            completedOrders.forEach(o => {
                const endStr = o.completed_at || o.updated_at;
                if (!endStr) return;
                
                const start = new Date(o.created_at);
                const end = new Date(endStr);
                const days = (end - start) / (1000 * 60 * 60 * 24);
                
                if (days < 0 || days > 365) return; 

                const month = start.toLocaleString('default', { month: 'short', year: '2-digit' });
                if (!monthMap[month]) monthMap[month] = { totalDays: 0, count: 0 };
                monthMap[month].totalDays += days;
                monthMap[month].count++;
            });

            const sortedMonths = Object.keys(monthMap).sort((a, b) => {
                const [mA, yA] = a.split(' ');
                const [mB, yB] = b.split(' ');
                return new Date(`${mA} 1, 20${yA}`) - new Date(`${mB} 1, 20${yB}`);
            });

            labels = sortedMonths.slice(-6);
            data = labels.map(m => (monthMap[m].totalDays / monthMap[m].count).toFixed(1));
        }
    }

    analyticsCharts.efficiencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [{
                label: 'Avg Days to Complete',
                data: data.length > 0 ? data : [0],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

async function loadSeasonalityChart(shopId = 'all') {
    const canvas = document.getElementById('seasonalityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let ordersQuery = supabaseClient.from('orders').select('created_at').eq('organization_id', USER_PROFILE.organization_id);
    if (shopId !== 'all') ordersQuery = ordersQuery.eq('shop_id', shopId);

    const { data: orders } = await ordersQuery;
    
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    if (orders && orders.length > 0) {
        let minDate = new Date();
        let maxDate = new Date("1970-01-01");
        
        orders.forEach(o => {
            if (o.created_at) {
                const dateObj = new Date(o.created_at);
                if (dateObj < minDate) minDate = dateObj;
                if (dateObj > maxDate) maxDate = dateObj;
                
                const d = dateObj.getDay();
                if (d >= 0 && d <= 6) counts[d]++;
            }
        });
        
        // Calculate total weeks to find the average per day
        const now = new Date();
        if (maxDate < minDate) maxDate = now;
        const diffTime = Math.abs(maxDate - minDate);
        let diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        if (diffWeeks < 1) diffWeeks = 1; // At least 1 week
        
        // Convert to average
        for (let i = 0; i < 7; i++) {
            counts[i] = parseFloat((counts[i] / diffWeeks).toFixed(1));
        }
    }

    analyticsCharts.seasonalityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [{
                label: 'Orders',
                data: counts,
                backgroundColor: '#10b981',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function exportDashboardPDF() {
    // Trigger native browser print which we have styled for perfect PDF layout
    window.print();
}

function exportDashboardCSV() {
    try {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Type,Date,Amount,Description\n";

        // Export Payments (Revenue)
        if (window.globalPayments && window.globalPayments.length > 0) {
            window.globalPayments.forEach(p => {
                const date = new Date(p.recorded_at).toLocaleDateString();
                const desc = `Payment for order ${p.order_id || 'N/A'}`;
                csvContent += `Revenue,${date},${p.amount},"${desc}"\n`;
            });
        }

        // Export Expenses
        if (window.globalExpenses && window.globalExpenses.length > 0) {
            window.globalExpenses.forEach(e => {
                const date = new Date(e.incurred_at).toLocaleDateString();
                const desc = e.description || e.category || 'Expense';
                csvContent += `Expense,${date},${e.amount},"${desc}"\n`;
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Financial_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("CSV Export failed:", err);
        alert("Failed to export data. Please try again.");
    }
}

async function loadBIAnalytics() {
    logDebug("Loading BI Analytics...", null, 'info');

    const shopId = document.getElementById('bi-shop-filter')?.value || 'all';
    const daysRange = document.getElementById('bi-date-filter')?.value || 'all';

    // Cleanup previous charts
    Object.values(analyticsCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            try { chart.destroy(); } catch (e) { }
        }
    });
    analyticsCharts = {};

    try {
        let paymentsQuery = supabaseClient.from('payments').select('amount, recorded_at, shop_id').is('deleted_at', null).eq('organization_id', USER_PROFILE.organization_id);
        let expensesQuery = supabaseClient.from('expenses').select('amount, incurred_at, shop_id').eq('organization_id', USER_PROFILE.organization_id);
        let ordersQuery = supabaseClient.from('orders').select('id, price, status, created_at, garment_type, shop_id, customer_name, customer_phone').eq('organization_id', USER_PROFILE.organization_id);

        if (shopId !== 'all') {
            paymentsQuery = paymentsQuery.eq('shop_id', shopId);
            expensesQuery = expensesQuery.eq('shop_id', shopId);
            ordersQuery = ordersQuery.eq('shop_id', shopId);
        }

        if (daysRange !== 'all') {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysRange));
            const cutoffISO = cutoffDate.toISOString();

            paymentsQuery = paymentsQuery.gte('recorded_at', cutoffISO);
            expensesQuery = expensesQuery.gte('incurred_at', cutoffISO);
            ordersQuery = ordersQuery.gte('created_at', cutoffISO);
        }

        const [{ data: payments }, { data: expenses }, { data: orders }] = await Promise.all([
            paymentsQuery, expensesQuery, ordersQuery
        ]);

        const validPayments = payments || [];
        const validExpenses = expenses || [];
        const validOrders = orders || [];

        // 1. Compile Scorecards
        const totalRevenue = validPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalExpenses = validExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const netMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

        // Count unique clients
        const clientsSet = new Set();
        validOrders.forEach(o => {
            if (o.customer_phone) clientsSet.add(o.customer_phone);
            else if (o.customer_name) clientsSet.add(o.customer_name);
        });
        const totalClients = clientsSet.size;

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setVal('bi-revenue', `Ksh ${totalRevenue.toLocaleString()}`);
        setVal('bi-margin', `${netMargin.toFixed(1)}%`);
        setVal('bi-clients', totalClients.toString());
        setVal('bi-speed', '4.2'); 

        let sortedGarments = [];

        // 2. Health Trajectory Area Chart (Revenue vs Expenses by Month)
        const healthCtx = document.getElementById('healthAreaChart')?.getContext('2d');
        if (healthCtx) {
            const monthlyData = {};
            validPayments.forEach(p => {
                const month = new Date(p.recorded_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                if (!monthlyData[month]) monthlyData[month] = { rev: 0, exp: 0 };
                monthlyData[month].rev += p.amount || 0;
            });
            validExpenses.forEach(e => {
                const month = new Date(e.incurred_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                if (!monthlyData[month]) monthlyData[month] = { rev: 0, exp: 0 };
                monthlyData[month].exp += e.amount || 0;
            });

            // Sort months
            const labels = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b)).slice(-6); // Last 6 periods
            const revData = labels.map(l => monthlyData[l].rev);
            const expData = labels.map(l => monthlyData[l].exp);

            analyticsCharts.healthChart = new Chart(healthCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Revenue',
                            data: revData,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.2)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Expenses',
                            data: expData,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });
        }

        // 3. Polar Area Garment Types
        const polarCtx = document.getElementById('categoryPolarChart')?.getContext('2d');
        if (polarCtx) {
            const garmentCounts = {};
            validOrders.forEach(o => {
                const type = o.garment_type || 'Other';
                garmentCounts[type] = (garmentCounts[type] || 0) + 1;
            });
            sortedGarments = Object.entries(garmentCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

            analyticsCharts.polarChart = new Chart(polarCtx, {
                type: 'polarArea',
                data: {
                    labels: sortedGarments.map(g => g[0]),
                    datasets: [{
                        data: sortedGarments.map(g => g[1]),
                        backgroundColor: ['rgba(59, 130, 246, 0.7)', 'rgba(16, 185, 129, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(239, 68, 68, 0.7)'],
                        borderColor: 'white',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { r: { display: false } },
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // 4. Shop Radar Chart
        const radarCtx = document.getElementById('shopRadarChart')?.getContext('2d');
        if (radarCtx && shopId === 'all') { // Only show global radar if 'all' is selected
            const shopStats = {};
            const { data: shops } = await supabaseClient.from('shops').select('id, name').eq('organization_id', USER_PROFILE.organization_id);
            const shopMap = {};
            shops?.forEach(s => { shopMap[s.id] = s.name; shopStats[s.name] = { orders: 0, revenue: 0, clients: new Set() }; });

            validOrders.forEach(o => {
                const name = shopMap[o.shop_id];
                if (name) {
                    shopStats[name].orders++;
                    shopStats[name].clients.add(o.customer_phone || o.customer_name);
                }
            });
            validPayments.forEach(p => {
                const name = p.orders?.shop_id ? shopMap[p.orders.shop_id] : null;
                if (name) shopStats[name].revenue += p.amount || 0;
            });

            const sNames = Object.keys(shopStats);

            analyticsCharts.radarChart = new Chart(radarCtx, {
                type: 'radar',
                data: {
                    labels: sNames,
                    datasets: [
                        {
                            label: 'Volume (Orders)',
                            data: sNames.map(s => shopStats[s].orders),
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderColor: '#3b82f6',
                            pointBackgroundColor: '#3b82f6'
                        },
                        {
                            label: 'Reach (Clients)',
                            data: sNames.map(s => shopStats[s].clients.size),
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            borderColor: '#10b981',
                            pointBackgroundColor: '#10b981'
                        }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        } else if (radarCtx) {
            radarCtx.clearRect(0, 0, radarCtx.canvas.width, radarCtx.canvas.height);
            radarCtx.font = "14px Arial";
            radarCtx.fillStyle = "#94a3b8";
            radarCtx.textAlign = "center";
            radarCtx.fillText("Radar available in 'Global' view only.", radarCtx.canvas.width / 2, radarCtx.canvas.height / 2);
        }

        // 5. Leaderboard
        const clientSpend = {};
        validPayments.forEach(p => {
            const name = p.orders?.customer_name;
            if (name) {
                clientSpend[name] = (clientSpend[name] || 0) + (p.amount || 0);
            }
        });

        const topClients = Object.entries(clientSpend).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const tbody = document.getElementById('top-clients-tbody');
        if (tbody) {
            tbody.innerHTML = topClients.map((c, i) => `
                <tr>
                    <td><div class="rank-badge rank-${i + 1}">${i + 1}</div></td>
                    <td>${c[0]}</td>
                    <td style="text-align: right; font-weight: 700; color: #10b981;">Ksh ${c[1].toLocaleString()}</td>
                </tr>
            `).join('') || '<tr><td colspan="3" style="text-align:center;">No data available</td></tr>';
        }

        // Generate dynamic insights
        generateDynamicInsights(topClients, sortedGarments, totalRevenue, totalExpenses);

    } catch (error) {
        logDebug("Error loading BI Analytics:", error, 'error');
    }
}

function generateDynamicInsights(topClients, sortedGarments, rev, exp) {
    const aiList = document.getElementById('ai-insights-list');
    if (!aiList) return;

    let insightsHTML = '';

    if (rev > exp && exp > 0) {
        insightsHTML += `
            <div class="insight-item">
                <div class="insight-title"><i class="fas fa-check-circle"></i> Profitability Stable</div>
                <div class="insight-text">Revenue is currently shielding expenses with a healthy mathematical buffer. Keep overheads tight.</div>
            </div>`;
    } else if (exp > rev) {
        insightsHTML += `
            <div class="insight-item" style="border-left-color: #ef4444;">
                <div class="insight-title" style="color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> Cashflow Warning</div>
                <div class="insight-text">Expenses have eclipsed revenue for this period. Immediate operational audit recommended.</div>
            </div>`;
    }

    if (sortedGarments && sortedGarments.length > 0) {
        insightsHTML += `
            <div class="insight-item" style="border-left-color: #3b82f6;">
                <div class="insight-title" style="color: #60a5fa;"><i class="fas fa-chart-pie"></i> Production Focus</div>
                <div class="insight-text"><strong>${sortedGarments[0][0]}s</strong> are leading production volume. Ensure fabric stock levels for this category are heavily reinforced.</div>
            </div>`;
    }

    if (topClients && topClients.length > 0) {
        insightsHTML += `
            <div class="insight-item" style="border-left-color: #f59e0b;">
                <div class="insight-title" style="color: #fbbf24;"><i class="fas fa-star"></i> Client Retention Notice</div>
                <div class="insight-text">Client <strong>${topClients[0][0]}</strong> is your top spender. Consider a VIP outreach or priority review/fitting to enhance lifetime value.</div>
            </div>`;
    }

    aiList.innerHTML = insightsHTML || '<div class="insight-item"><div class="insight-text">Insufficient data to generate meaningful intelligence.</div></div>';
}

async function loadAnalyticsDashboard() {
    const now = Date.now();
    if (now - lastDashboardLoad < DEBOUNCE_DELAY) return;
    lastDashboardLoad = now;

    logDebug("ðŸ“Š Loading analytics dashboard", null, 'info');

    // Clean up charts
    Object.values(analyticsCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            try { chart.destroy(); } catch (e) { }
        }
    });
    analyticsCharts = {};

    try {
        const shopId = 'all';

        const revenueDaysStr = document.getElementById('revenue-filter') ? document.getElementById('revenue-filter').value : '30';
        const productMixDaysStr = document.getElementById('product-mix-filter') ? document.getElementById('product-mix-filter').value : '30';

        // PRE-FETCH: Grab all orders needed for the new advanced charts in ONE query 
        // to prevent spamming the database with 3 simultaneous queries which slows down the browser
        let advOrdersQuery = supabaseClient.from('orders').select('status, created_at, updated_at, customer_phone').eq('organization_id', USER_PROFILE.organization_id);
        if (shopId !== 'all') advOrdersQuery = advOrdersQuery.eq('shop_id', shopId);
        const { data: advancedOrders } = await advOrdersQuery;
        window.advancedAnalyticsOrders = advancedOrders || [];

        await Promise.all([
            loadKPIMetrics(shopId),
            loadRevenueTrend(revenueDaysStr),
            loadProductMixChart(shopId, productMixDaysStr),
            loadShopPerformanceChart(),
            loadExpenseChart(shopId),
            loadPerformanceTables(shopId),
            loadPaymentMethodChart(shopId),
            generateAIInsights(shopId),
            loadExpenseAuditTable(shopId),
            loadOrderVolumeChart(shopId),
            loadRecentActivities(shopId),
            loadRetentionChart(shopId),
            loadEfficiencyChart(shopId),
            loadSeasonalityChart(shopId)
        ]);

        logDebug("Analytics dashboard loaded", null, 'success');
    } catch (error) {
        logDebug("Error loading analytics dashboard:", error, 'error');
    }
}

async function loadExpenseAuditTable(shopId) {
    const tbody = document.getElementById('expense-audit-tbody');
    if (!tbody) return;

    try {
        let query = supabaseClient
            .from('expenses')
            .select('*')
            .eq('organization_id', USER_PROFILE.organization_id)
            .order('incurred_at', { ascending: false })
            .limit(50);

        if (shopId !== 'all') {
            query = query.eq('shop_id', shopId);
        }

        const { data: expenses, error } = await query;
        if (error) throw error;

        if (!expenses || expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No recent expenses</td></tr>';
            return;
        }

        // Fetch shop names for display
        const shopIds = [...new Set(expenses.map(e => e.shop_id))];
        const { data: shops } = await supabaseClient.from('shops').select('id, name').in('id', shopIds);
        const shopMap = {};
        shops?.forEach(s => shopMap[s.id] = s.name);

        tbody.innerHTML = expenses.map(e => `
            <tr>
                <td>${formatDate(e.incurred_at)}</td>
                <td>${shopMap[e.shop_id] || 'Unknown'}</td>
                <td>${e.category}</td>
                <td style="text-align: right; font-weight: bold;">Ksh ${parseFloat(e.amount).toLocaleString()}</td>
                <td>${e.item_name || '-'} <small style="color:#888;">${e.notes || ''}</small></td>
            </tr>
        `).join('');

    } catch (error) {
        console.error("Error loading expense audit:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading data</td></tr>';
    }
}

async function loadProductMixChart(shopId, daysStr) {
    try {
        const days = parseInt(daysStr) || 30;

        // Date filter
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let ordersQuery = supabaseClient
            .from('orders')
            .select('garment_type, price, created_at')
            .gte('created_at', cutoffDate.toISOString());

        if (shopId !== 'all') {
            ordersQuery = ordersQuery.eq('shop_id', shopId);
        }

        const { data: orders } = await ordersQuery;

        // Group by garment type
        const productData = {};
        if (orders) {
            orders.forEach(order => {
                const type = order.garment_type || 'Unknown';
                if (!productData[type]) productData[type] = 0;
                productData[type] += order.price || 0;
            });
        }

        // Sort by revenue descending
        const sortedEntries = Object.entries(productData).sort((a, b) => b[1] - a[1]);
        const labels = sortedEntries.map(e => e[0]);
        const revenueData = sortedEntries.map(e => e[1]);

        // Create chart
        const canvas = document.getElementById('productMixChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (analyticsCharts.productMixChart) {
            analyticsCharts.productMixChart.destroy();
        }

        analyticsCharts.productMixChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: revenueData,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.9)', 'rgba(16, 185, 129, 0.9)', 'rgba(245, 158, 11, 0.9)',
                        'rgba(239, 68, 68, 0.9)', 'rgba(139, 92, 246, 0.9)', 'rgba(236, 72, 153, 0.9)',
                        'rgba(20, 184, 166, 0.9)', 'rgba(249, 115, 22, 0.9)'
                    ],
                    borderRadius: 8,
                    barPercentage: 0.6,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart'
                },
                layout: {
                    padding: {
                        bottom: 40,
                        left: 20
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((context.raw / total) * 100) : 0;
                                return `Ksh ${context.raw.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { borderDash: [5, 5], color: '#f1f5f9' },
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `Ksh ${value.toLocaleString()}`,
                            padding: 10
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            padding: 10
                        }
                    }
                }
            }
        });

        logDebug("Product mix chart loaded", { products: labels.length }, 'success');
    } catch (error) {
        logDebug("Error loading product mix chart:", error, 'error');
    }
}

async function loadRecentActivities(shopId) {
    const container = document.getElementById('recent-activities-container');
    if (!container) return;

    try {
        let orderQuery = supabaseClient.from('orders').select('id, garment_type, customer_name, created_at').eq('organization_id', USER_PROFILE.organization_id).order('created_at', { ascending: false }).limit(5);
        let paymentQuery = supabaseClient.from('payments').select('amount, payment_method, recorded_at, order_id').is('deleted_at', null).eq('organization_id', USER_PROFILE.organization_id).order('recorded_at', { ascending: false }).limit(5);

        if (shopId !== 'all') {
            orderQuery = orderQuery.eq('shop_id', shopId);
        }

        const [{ data: orders }, { data: payments }] = await Promise.all([orderQuery, paymentQuery]);

        const orderMap = {};
        if (orders) {
            orders.forEach(o => orderMap[o.id] = o);
        }

        let activities = [];
        if (orders) {
            orders.forEach(o => activities.push({
                title: `New Order: ${o.garment_type}`,
                desc: `Customer: ${o.customer_name}`,
                time: o.created_at,
                icon: 'fa-tshirt',
                color: '#3b82f6',
                bg: 'rgba(59, 130, 246, 0.1)'
            }));
        }
        if (payments) {
            payments.forEach(p => {
                const relatedOrder = orderMap[p.order_id] || {};
                const isEscrow = p.payment_method?.includes('Escrow');
                activities.push({
                    title: isEscrow ? `Escrow Payment Secured` : `Payment Received`,
                    desc: `Ksh ${p.amount.toLocaleString()} via ${p.payment_method || 'Cash'} from ${relatedOrder.customer_name || 'Customer'}`,
                    time: p.recorded_at,
                    icon: isEscrow ? 'fa-shield-alt' : 'fa-money-bill-wave',
                    color: isEscrow ? 'var(--brand-gold)' : '#10b981',
                    bg: isEscrow ? 'rgba(212, 175, 55, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                });
            });
        }

        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        activities = activities.slice(0, 5);

        if (activities.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No recent activity found.</div>';
            return;
        }

        container.innerHTML = activities.map(act => `
            <div style="display: flex; align-items: flex-start; gap: 15px; padding: 12px; background: white; border: 1px solid #f1f5f9; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateX(5px)'; this.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.05)';" onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.02)';">
                <div style="background: ${act.bg}; padding: 12px; border-radius: 10px; color: ${act.color}; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
                    <i class="fas ${act.icon}"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1e293b; font-size: 0.95em;">${act.title}</div>
                    <div style="color: #64748b; font-size: 0.85em; margin-top: 3px;">${act.desc}</div>
                    <div style="color: #94a3b8; font-size: 0.75em; margin-top: 5px; display: flex; align-items: center; gap: 4px;">
                        <i class="far fa-clock"></i> ${formatDate(act.time)}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        logDebug("Error loading recent activities:", error, 'error');
        container.innerHTML = '<div style="color:red; text-align:center; padding:10px;">Failed to load activities.</div>';
    }
}

async function loadOrderVolumeChart(shopId) {
    try {
        let ordersQuery = supabaseClient.from('orders').select('status').eq('organization_id', USER_PROFILE.organization_id);
        if (shopId !== 'all') {
            ordersQuery = ordersQuery.eq('shop_id', shopId);
        }

        const { data: orders } = await ordersQuery;

        let statuses = { assigned: 0, inProgress: 0, qaCheck: 0, ready: 0, collected: 0, closed: 0 };

        if (orders) {
            orders.forEach(o => {
                switch (o.status) {
                    case 1: statuses.assigned++; break;
                    case 2: statuses.inProgress++; break;
                    case 3: statuses.qaCheck++; break;
                    case 4: statuses.ready++; break;
                    case 5: statuses.collected++; break;
                    case 6: statuses.closed++; break;
                }
            });
        }

        const canvas = document.getElementById('orderVolumeChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (analyticsCharts.orderVolumeChart) {
            analyticsCharts.orderVolumeChart.destroy();
        }

        analyticsCharts.orderVolumeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Order Volume'],
                datasets: [
                    {
                        label: 'Closed',
                        data: [statuses.closed],
                        backgroundColor: 'rgba(16, 185, 129, 0.9)', // Emerald
                        borderRadius: 20,
                        barPercentage: 0.8,
                        categoryPercentage: 1.0,
                        borderSkipped: false
                    },
                    {
                        label: 'Collected',
                        data: [statuses.collected],
                        backgroundColor: 'rgba(20, 184, 166, 0.9)', // Teal
                        borderRadius: 20,
                        barPercentage: 0.8,
                        categoryPercentage: 1.0,
                        borderSkipped: false
                    },
                    {
                        label: 'Ready',
                        data: [statuses.ready],
                        backgroundColor: 'rgba(59, 130, 246, 0.9)', // Blue
                        borderRadius: 20,
                        barPercentage: 0.8,
                        categoryPercentage: 1.0,
                        borderSkipped: false
                    },
                    {
                        label: 'QA Check',
                        data: [statuses.qaCheck],
                        backgroundColor: 'rgba(139, 92, 246, 0.9)', // Purple
                        borderRadius: 20,
                        barPercentage: 0.8,
                        categoryPercentage: 1.0,
                        borderSkipped: false
                    },
                    {
                        label: 'In Progress',
                        data: [statuses.inProgress],
                        backgroundColor: 'rgba(245, 158, 11, 0.9)', // Amber
                        borderRadius: 20,
                        barPercentage: 0.8,
                        categoryPercentage: 1.0,
                        borderSkipped: false
                    },
                    {
                        label: 'Assigned',
                        data: [statuses.assigned],
                        backgroundColor: 'rgba(239, 68, 68, 0.9)', // Red
                        borderRadius: 20,
                        barPercentage: 0.8,
                        categoryPercentage: 1.0,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                scales: {
                    x: { stacked: true, display: false },
                    y: { stacked: true, display: false }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20, boxWidth: 10 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.raw} Orders`
                        },
                        padding: 12,
                        cornerRadius: 8
                    }
                }
            }
        });
    } catch (err) {
        logDebug("Error loading order volume:", err, 'error');
    }
}

