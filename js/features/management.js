// ==========================================
// ⚙️ SYSTEM MANAGEMENT (SHOPS, WORKERS, ADMINS)
// Extracted from app.js
// ==========================================

async function loadPendingApprovals() {
    const tbody = document.getElementById('pending-approvals-tbody');
    const badge = document.getElementById('pending-badge');
    const section = document.getElementById('pending-approvals-section');
    if (!tbody) return;

    try {
        const adminClient = window.supabaseClient;

        // Step 1: Fetch all Pending profiles (no nested join to avoid schema cache error)
        const { data: pending, error } = await adminClient
            .from('user_profiles')
            .select('id, full_name, email, shop_id, organization_id')
            .eq('status', 'Pending');

        if (error) throw error;

        const count = pending?.length || 0;

        // Update badge
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (section) {
            section.style.borderLeftColor = count > 0 ? '#ef4444' : 'rgba(16,185,129,0.3)';
            section.style.borderColor = count > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.15)';
        }
        
        // Blink effects
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.classList.toggle('blink-alert', count > 0);
        }
        if (badge) {
            badge.classList.toggle('blink-alert', count > 0);
        }
        const sidebarTenantsLink = document.getElementById('nav-orgs');
        if (sidebarTenantsLink) {
            const li = sidebarTenantsLink.closest('li');
            if (li) li.classList.toggle('blink-alert', count > 0);
        }

        if (count === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding:30px; color:#10b981;">
                        <i class="fas fa-check-circle" style="font-size:1.5em; margin-bottom:8px; display:block;"></i>
                        No pending approvals! You're all caught up ✨
                    </td>
                </tr>`;
            return;
        }

        // Step 2: Fetch shop names for the shop_ids we have
        const shopIds = pending.map(p => p.shop_id).filter(Boolean);
        let shopMap = {};
        if (shopIds.length > 0) {
            const { data: shops } = await adminClient
                .from('shops')
                .select('id, name')
                .in('id', shopIds);
            if (shops) shops.forEach(s => shopMap[s.id] = s.name);
        }

        tbody.innerHTML = pending.map(p => {
            const shopName = shopMap[p.shop_id] || '(no shop name)';
            const safeShopName = shopName.replace(/'/g, "\\'");
            return `
                <tr>
                    <td><strong style="color:var(--brand-white);">${shopName}</strong></td>
                    <td>${p.full_name || 'â€”'}</td>
                    <td style="font-size:0.85em;">${p.email || 'â€”'}</td>
                    <td style="text-align:center; white-space:nowrap;">
                        <button onclick="approveShop('${p.id}', '${p.shop_id}', '${p.organization_id}')"
                            class="small-btn"
                            style="background:#10b981; color:white; border:none; margin-right:6px;">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button onclick="rejectShop('${p.id}', '${p.shop_id}', '${p.organization_id}', '${safeShopName}')"
                            class="small-btn"
                            style="background:transparent; border:1px solid #ef4444; color:#ef4444;">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </td>
                </tr>`;
        }).join('');

    } catch (err) {
        console.error('loadPendingApprovals error:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:20px;">Error loading pending approvals: ${err.message}</td></tr>`;
    }
}

async function approveShop(profileId, shopId, orgId) {
    if (!confirm('Approve this shop? They will gain full access to their dashboard.')) return;
    try {
        const adminClient = window.supabaseClient;

        // 1. Set profile status to Active
        const { error: profErr } = await adminClient
            .from('user_profiles')
            .update({ status: 'Active' })
            .eq('id', profileId);
        if (profErr) throw profErr;

        // 2. Set shop status to active (if the shops table has a status column)
        if (shopId && shopId !== 'null') {
            await adminClient
                .from('shops')
                .update({ status: 'active' })
                .eq('id', shopId);
        }

        alert('âœ… Shop approved! The tailor can now log in and access their dashboard.');
        loadPendingApprovals();
        loadSuperadminDashboard();
    } catch (err) {
        alert('Error approving shop: ' + err.message);
    }
}

async function rejectShop(profileId, shopId, orgId, shopName) {
    if (!confirm(`Reject and delete "${shopName}"? This will remove their profile, shop, and organization so they can re-register.`)) return;
    try {
        const adminClient = window.supabaseClient;

        // Delete in order: profile â†’ shop â†’ org
        await adminClient.from('user_profiles').delete().eq('id', profileId);

        if (shopId && shopId !== 'null') {
            await adminClient.from('shops').delete().eq('id', shopId);
        }
        if (orgId && orgId !== 'null') {
            await adminClient.from('organizations').delete().eq('id', orgId);
        }

        alert('ðŸ—‘ï¸ Registration rejected and removed. The user can re-register with a different shop name.');
        loadPendingApprovals();
    } catch (err) {
        alert('Error rejecting shop: ' + err.message);
    }
}

async function loadOrganizations() {
    try {
        const { data: orgs, error } = await supabaseClient
            .from('organizations')
            .select('*, shops(count)')
            .order('name');

        if (error) throw error;

        const tbody = document.getElementById('orgs-tbody');
        if (tbody) {
            if (!orgs || orgs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No organizations found</td></tr>';
            } else {
                tbody.innerHTML = orgs.map(org => {
                    const shopCount = (org.shops && org.shops[0] && org.shops[0].count !== undefined) ? org.shops[0].count : (Array.isArray(org.shops) ? org.shops.length : 0);
                    const statusText = org.subscription_status || 'Active';
                    const isSuspended = statusText === 'Suspended';
                    const badgeColor = isSuspended ? '#ef4444' : '#10b981';
                    const btnText = isSuspended ? 'Reactivate' : 'Suspend';
                    const btnBg = isSuspended ? '#10b981' : '#f59e0b';
                    return `
                    <tr>
                        <td><small>${org.id.slice(-8)}</small></td>
                        <td><strong>${org.name}</strong></td>
                        <td><span style="background:var(--brand-gold); color:black; padding:3px 10px; border-radius:12px; font-weight:bold; font-size:0.85em;">${shopCount}</span></td>
                        <td>${formatDate(org.created_at)}</td>
                        <td><span style="background:${badgeColor}; color:white; padding:3px 10px; border-radius:12px; font-weight:bold; font-size:0.85em;">${statusText}</span></td>
                        <td>
                            <button class="small-btn" onclick="viewOrgShops('${org.id}', '${org.name.replace(/'/g, "\\'")}')" style="background:#475569; color:white; border:none; margin-right:5px; font-weight: 500;">View Shops</button>
                            <button class="small-btn" onclick="toggleOrganizationSuspension('${org.id}', '${statusText}')" style="background:${btnBg}; color:white; border:none; margin-right:5px;">${btnText}</button>
                            <button class="small-btn" onclick="deleteOrganization('${org.id}')" style="background:#ef4444; color:white; border:none;">Delete</button>
                        </td>
                    </tr>
                `}).join('');
            }
        }

        // Setup Create Form
        const createForm = document.getElementById('create-org-form');
        if (createForm) {
            createForm.onsubmit = async (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('new-org-name');
                const msg = document.getElementById('org-message');

                try {
                    const { error } = await supabaseClient.from('organizations').insert([{ name: nameInput.value.trim() }]);
                    if (error) throw error;
                    msg.innerHTML = '<span style="color:green;">âœ… Organization Created!</span>';
                    nameInput.value = '';
                    loadOrganizations();
                } catch (err) {
                    msg.innerHTML = `<span style="color:red;">âŒ Error: ${err.message}</span>`;
                }
            };
        }
    } catch (err) {
        console.error("Load Orgs Error:", err);
    }
}

async function loadPlatformUsers() {
    const tbody = document.getElementById('platform-users-tbody');
    if (!tbody) return;

    try {
        // Fetch profiles and orgs in parallel using adminClient to bypass RLS and fetch clients
        const adminClient = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        
        const [profileRes, orgsRes] = await Promise.all([
            adminClient.from('user_profiles').select('*'),
            adminClient.from('organizations').select('id, name')
        ]);

        if (profileRes.error) throw profileRes.error;
        if (orgsRes.error) throw orgsRes.error;

        const profiles = profileRes.data || [];
        const orgs = orgsRes.data || [];

        // Map organizations for quick lookup
        const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]));

        if (profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">No platform users found</td></tr>';
            return;
        }

        tbody.innerHTML = profiles.map(profile => {
            let orgName = orgMap[profile.organization_id];
            if (!orgName) {
                orgName = profile.role === 'client' ? 'Client App User' : 'Platform Level';
            }
            
            const lastActive = profile.last_seen_at ? new Date(profile.last_seen_at) : null;
            const isOnline = lastActive && (new Date() - lastActive < 5 * 60 * 1000);

            return `
                <tr>
                    <td>
                        <div style="font-weight:700;">${profile.full_name || 'Anonymous User'}</div>
                    </td>
                    <td>
                        <div style="font-size:0.9em; color:#64748b;">${profile.email || 'No email provided'}</div>
                    </td>
                    <td><span class="org-badge badge-basic" style="${profile.role === 'client' ? 'background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);' : ''}">${orgName}</span></td>
                    <td><span style="text-transform:capitalize; ${profile.role === 'client' ? 'font-weight: 700; color: #3b82f6;' : ''}">${profile.role || 'user'}</span></td>
                    <td>${lastActive ? getRelativeTime(lastActive) : 'Never'}</td>
                    <td>
                        <div style="display: flex; flex-direction: row; gap: 5px; align-items: center;">
                            <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}" style="padding: 4px 8px; font-size: 0.75em; border-radius: 4px;">
                                ${isOnline ? 'Online' : 'Offline'}
                            </span>
                            <span class="status-badge ${profile.status === 'Suspended' ? 'badge-premium' : 'status-online'}" style="background: ${profile.status === 'Suspended' ? '#fee2e2' : '#dcfce7'}; color: ${profile.status === 'Suspended' ? '#991b1b' : '#15803d'}; padding: 4px 8px; font-size: 0.75em; border-radius: 4px;">
                                ${profile.status || 'Active'}
                            </span>
                        </div>
                    </td>
                    <td>
                        <button onclick="toggleUserStatus('${profile.id}', '${profile.status || 'Active'}')" class="small-btn" style="background: ${profile.status === 'Suspended' ? '#10b981' : '#ef4444'}; color: white; border: none; padding: 5px 10px; font-size: 0.8em; white-space: nowrap;">
                            <i class="fas ${profile.status === 'Suspended' ? 'fa-play' : 'fa-pause'}"></i> 
                            ${profile.status === 'Suspended' ? 'Activate' : 'Suspend'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Setup search
        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(term) ? '' : 'none';
                });
            };
        }

    } catch (err) {
        console.error("Platform Users Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding:40px;">âš ï¸ Error: ${err.message}</td></tr>`;
    }
}

async function loadAdminAccountScreen() {
    try {
        // Load orgs for the dropdown
        const { data: orgs } = await supabaseClient.from('organizations').select('id, name').order('name');
        const select = document.getElementById('admin-org-select');
        if (select && orgs) {
            select.innerHTML = '<option value="">Select Organization...</option>' + 
                orgs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        }

        const form = document.getElementById('create-admin-form');
        if (form) {
            form.onsubmit = handleCreateAdminAccount;
        }
    } catch (err) {
        console.error("Admin screen error:", err);
    }
}

async function handleCreateAdminAccount(e) {
    if (e) e.preventDefault();
    
    const fullNameStatus = document.getElementById('admin-fullname').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    const orgId = document.getElementById('admin-org-select').value;
    const btn = document.getElementById('create-admin-btn');
    const msg = document.getElementById('admin-message');

    if (!fullNameStatus || !email || !password || !orgId) {
        alert("Please fill all fields");
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Provisioning...';

    try {
        const adminClient = window.supabaseClient;
        

        // 1. Create User in Auth
        const { data: edgeData, error: authError } = await window.supabaseClient.functions.invoke('admin-proxy', { body: { action: 'createUser', payload: {
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullNameStatus }
        } } });
        const authUser = edgeData ? edgeData.data.user : null;

        if (authError) {
            if (authError.context && typeof authError.context.json === 'function') {
                try {
                    const errBody = await authError.context.json();
                    throw new Error(errBody.error || authError.message);
                } catch (e) {
                    throw authError;
                }
            }
            throw authError;
        }

        // 2. Create User Profile
        const { error: profileError } = await supabaseClient.from('user_profiles').insert([{
            id: authUser.id,
            organization_id: orgId,
            full_name: fullNameStatus,
            role: 'owner' // Organization Admin
        }]);

        if (profileError) throw profileError;

        msg.innerHTML = `
            <div style="margin-bottom: 10px;">
                <span style="color:green; display:block; margin-bottom: 15px; font-weight: bold;">âœ… Admin Account Created Successfully!</span>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button type="button" onclick="copyAdminCredentials('${email}', '${password}', '${fullNameStatus}')" style="background: #f1f5f9; color: var(--brand-navy); border: 1px solid #cbd5e1; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: bold; display: flex; align-items: center; gap: 8px; transition: 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                        <i class="fas fa-copy"></i> Copy Details
                    </button>
                    <button type="button" onclick="shareAdminWhatsApp('${email}', '${password}', '${fullNameStatus}')" style="background: #25D366; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: bold; display: flex; align-items: center; gap: 8px; transition: 0.2s;" onmouseover="this.style.background='#1da851'" onmouseout="this.style.background='#25D366'">
                        <i class="fab fa-whatsapp"></i> Send via WhatsApp
                    </button>
                </div>
            </div>
        `;
        document.getElementById('create-admin-form').reset();
    } catch (err) {
        msg.innerHTML = `<span style="color:red;">âŒ Error: ${err.message}</span>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Admin Account';
    }
}

async function loadWorkerScreen() {
    if (!USER_PROFILE || !USER_PROFILE.shop_id) return;

    logDebug("Loading worker management screen", null, 'info');

    try {
        // Setup search
        const searchInput = document.getElementById('worker-search');
        if (searchInput) {
            searchInput.onkeyup = function () {
                const term = this.value.toLowerCase();
                document.querySelectorAll('#worker-list-tbody tr').forEach(row => {
                    const name = row.cells[0].textContent.toLowerCase();
                    row.style.display = name.includes(term) ? '' : 'none';
                });
            };
        }

        // Load workers
        const { data: workers, error } = await supabaseClient
            .from('workers')
            .select('*')
            .eq('shop_id', USER_PROFILE.shop_id)
            .order('name');

        if (error) throw error;

        // Load active assignments count
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('worker_id')
            .eq('shop_id', USER_PROFILE.shop_id)
            .neq('status', 6);

        const assignmentCounts = {};
        if (orders) {
            orders.forEach(o => {
                if (o.worker_id) {
                    assignmentCounts[o.worker_id] = (assignmentCounts[o.worker_id] || 0) + 1;
                }
            });
        }

        // Update table
        const tbody = document.getElementById('worker-list-tbody');
        if (tbody) {
            if (!workers || workers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No workers found</td></tr>';
                return;
            }

            tbody.innerHTML = workers.map(worker => {
                const pendingCount = assignmentCounts[worker.id] || 0;
                const statusClass = pendingCount > 0 ? 'status-2' : 'status-4';
                const statusText = pendingCount > 0 ? `${pendingCount} Pending` : 'Available';

                return `
                    <tr>
                        <td style="font-weight:bold;">${worker.name}</td>
                        <td>${worker.phone_number || '-'}</td>
                        <td><span class="status-indicator ${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="small-btn" style="background:#007bff;" 
                                    onclick="location.href='/views/worker/worker-assignments.html?id=${worker.id}'">
                                <i class="fas fa-briefcase"></i> View Work
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Setup add worker form
        const addForm = document.getElementById('add-worker-form');
        if (addForm) {
            addForm.onsubmit = async (e) => {
                e.preventDefault();

                const nameInput = document.getElementById('new-worker-name');
                const phoneInput = document.getElementById('new-worker-phone');
                const messageDiv = document.getElementById('worker-message');

                if (!nameInput.value.trim()) {
                    messageDiv.textContent = "Please enter worker name";
                    messageDiv.className = 'error';
                    return;
                }

                try {
                    const { error } = await supabaseClient
                        .from('workers')
                        .insert([{
                            shop_id: USER_PROFILE.shop_id,
                            name: nameInput.value.trim(),
                            phone_number: phoneInput.value.trim() || null,
                            created_at: new Date().toISOString()
                        }]);

                    if (error) throw error;

                    messageDiv.textContent = "Worker added successfully!";
                    messageDiv.className = 'success';
                    nameInput.value = '';
                    phoneInput.value = '';

                    // Reload after 1 second
                    setTimeout(() => {
                        loadWorkerScreen();
                        messageDiv.textContent = '';
                        messageDiv.className = '';
                    }, 1000);

                } catch (error) {
                    messageDiv.textContent = "Error: " + error.message;
                    messageDiv.className = 'error';
                }
            };
        }

        logDebug("Worker screen loaded", { workers: workers?.length || 0 }, 'success');
    } catch (error) {
        logDebug("Error loading worker screen:", error, 'error');
    }
}

async function loadWorkerAssignments() {
    const params = new URLSearchParams(window.location.search);
    const workerId = params.get('id');

    if (!workerId) {
        const header = document.getElementById('worker-header-name');
        if (header) header.textContent = 'No Worker Selected';
        const tbody = document.getElementById('assignments-tbody');
        if (tbody) tbody.innerHTML = `
            <tr><td colspan="6" style="text-align:center; padding:40px;">
                <div style="font-size:2em; margin-bottom:10px;">🔍</div>
                <p style="color:#64748b; margin-bottom:15px;">No worker ID found in the URL.<br>Please go back and click "View Work" on a worker.</p>
                <button onclick="history.back()" style="background:var(--brand-navy);color:var(--brand-gold);border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;">
                    ← Back to Workers List
                </button>
            </td></tr>`;
        return;
    }
    if (!USER_PROFILE?.shop_id) {
        const tbody = document.getElementById('assignments-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#ef4444;">Session not ready. Please refresh the page.</td></tr>';
        return;
    }

    try {
        const [{ data: worker }, { data: orders }] = await Promise.all([
            supabaseClient.from('workers').select('name').eq('id', workerId).single(),
            supabaseClient.from('orders')
                .select('*')
                .eq('worker_id', workerId)
                .eq('shop_id', USER_PROFILE.shop_id)
                .neq('status', 6)
                .order('due_date', { ascending: true })
        ]);

        if (!worker || !orders) return;

        // Update header
        document.getElementById('worker-header-name').textContent = `${worker.name}'s Assignments`;

        // Update table
        const tbody = document.getElementById('assignments-tbody');
        if (tbody) {
            if (!orders.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No active assignments</td></tr>';
                return;
            }

            tbody.innerHTML = orders.map(order => {
                const orderIdStr = String(order.id);
                const shortId = orderIdStr.slice(-6);
                const statusText = STATUS_MAP[order.status] || `Status ${order.status}`;

                return `
                    <tr>
                        <td>#${shortId}</td>
                        <td>${order.customer_name}</td>
                        <td style="max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.garment_type}">${order.garment_type}</td>
                        <td>${formatDate(order.due_date)}</td>
                        <td><span class="status-indicator status-${order.status}">${statusText}</span></td>
                        <td>
                            <button class="small-btn" onclick="location.href='/views/manager/order-details.html?id=${order.id}'">
                                View/Update
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        logDebug(`Loaded ${orders.length} assignments for worker ${worker.name}`, null, 'success');
    } catch (error) {
        logDebug("Error loading worker assignments:", error, 'error');
    }
}

async function loadWorkersForSquad(shopId) {
    const container = document.getElementById('squad-selection-container');
    if (!container || !shopId) return;

    try {
        const { data: workers, error } = await supabaseClient
            .from('workers')
            .select('id, name')
            .eq('shop_id', shopId)
            .order('name');

        if (error) throw error;

        if (workers.length === 0) {
            container.innerHTML = '<p style="font-size:0.8em; padding:5px;">No workers found.</p>';
            return;
        }

        container.innerHTML = workers.map(w => `
            <div style="margin-bottom: 8px; display: flex; align-items: center;">
                <input type="checkbox" id="squad_${w.id}" value="${w.id}" class="squad-checkbox" style="width: auto; margin: 0 10px 0 0;">
                <label for="squad_${w.id}" style="margin: 0; font-weight: normal; cursor: pointer;">${w.name}</label>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading squad:", error);
        container.innerHTML = '<p style="color:red;">Error loading list</p>';
    }
}

async function loadWorkerFilterDropdown() {
    const workerFilter = document.getElementById('worker-filter');
    if (!workerFilter || !USER_PROFILE || !USER_PROFILE.shop_id) {
        return;
    }

    try {
        const { data: workers, error } = await supabaseClient
            .from('workers')
            .select('id, name')
            .eq('shop_id', USER_PROFILE.shop_id)
            .order('name');

        if (error) {
            logDebug("Error loading workers for filter:", error, 'error');
            return;
        }

        if (workers && workerFilter) {
            workerFilter.innerHTML = '<option value="">Filter by Worker (All)</option>' +
                workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        }
    } catch (error) {
        logDebug("Error loading worker filter:", error, 'error');
    }
}

async function loadWorkersDropdown() {
    if (!USER_PROFILE?.shop_id) return;

    try {
        const { data: workers, error } = await supabaseClient
            .from('workers')
            .select('id, name')
            .eq('shop_id', USER_PROFILE.shop_id)
            .order('name');

        if (error) {
            logDebug("Error loading workers for dropdown:", error, 'error');
            return;
        }

        const select = document.getElementById('worker-select');
        if (select && workers) {
            select.innerHTML = '<option value="">Select Worker</option>' +
                workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        }
    } catch (error) {
        logDebug("Error loading workers dropdown:", error, 'error');
    }
}


async function loadAdminManagementScreen() {
    logDebug("Loading Admin Management Setup", null, 'info');

    try {
        await Promise.all([
            loadShopsForDropdown('admin-shop-select'),
            loadShopCommandCenter()
        ]);
        
        const addShopForm = document.getElementById('add-shop-form');
        if (addShopForm) addShopForm.onsubmit = handleAddShopAndManager;

        const addWorkerForm = document.getElementById('admin-add-worker-form');
        if (addWorkerForm) addWorkerForm.onsubmit = handleAdminAddWorker;

    } catch (error) {
        logDebug("Error loading management screen:", error, 'error');
    }
}


async function loadShopsForDropdown(elId) {
    const el = document.getElementById(elId);
    if (!el) {
        logDebug(`Element ${elId} not found for shop dropdown`, null, 'warning');
        return;
    }

    try {
        let query = supabaseClient.from('shops').select('id, name, business_type');
        if (typeof USER_PROFILE !== 'undefined' && USER_PROFILE && USER_PROFILE.role !== 'superadmin' && USER_PROFILE.organization_id) {
            query = query.eq('organization_id', USER_PROFILE.organization_id);
        }
        const { data: shops, error } = await query.order('name');
        if (error) {
            logDebug("Error loading shops for dropdown:", error, 'error');
            return;
        }

        if (shops) {
            const firstOption = el.options[0];
            el.innerHTML = '';
            if (firstOption) el.appendChild(firstOption);

            shops.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = s.name;
                option.setAttribute('data-business-type', s.business_type || 'tailor');
                el.appendChild(option);
            });

            logDebug(`Loaded ${shops.length} shops for dropdown ${elId}`, null, 'success');
        }
    } catch (error) {
        logDebug("Exception loading shops for dropdown:", error, 'error');
    }
}


async function loadAllWorkersForAdmin() {
    try {
        const { data: workers, error } = await supabaseClient
            .from('workers')
            .select('id, name, shop_id')
            .order('name');

        if (error) throw error;

        const workerSelect = document.getElementById('worker-select');
        if (workerSelect && workers) {
            workerSelect.innerHTML = '<option value="">-- Select Worker --</option>' +
                workers.map(w => `<option value="${w.id}">${w.name} (Shop ${w.shop_id})</option>`).join('');
        }
    } catch (error) {
        logDebug("Error loading workers for admin:", error, 'error');
    }
}


async function loadShopCommandCenter() {
    const container = document.getElementById('shop-command-center');
    if (!container || !USER_PROFILE || !USER_PROFILE.organization_id) return;

    try {
        // Fetch all shops for this org
        const { data: shops, error: shopErr } = await supabaseClient.from('shops')
            .select('*')
            .eq('organization_id', USER_PROFILE.organization_id)
            .order('created_at', { ascending: true });

        if (shopErr) throw shopErr;

        if (!shops || shops.length === 0) {
            container.innerHTML = '<p style="color:#64748b; font-style:italic; padding:20px;">No shops launched yet. Create your first shop above.</p>';
            return;
        }

        // Fetch managers for these shops
        const { data: managers } = await supabaseClient.from('user_profiles')
            .select('id, full_name, role, shop_id')
            .eq('organization_id', USER_PROFILE.organization_id)
            .eq('role', 'manager');

        // Fetch emails via admin client
        const adminClient = window.supabaseClient;
        const managerEmailMap = {};
        if (managers && managers.length > 0 && adminClient) {
            await Promise.all(managers.map(async (m) => {
                try {
                    const { data: edgeData, error } = await window.supabaseClient.functions.invoke('admin-proxy', { body: { action: 'getUserById', payload: { id: m.id } } });
                        const data = edgeData ? edgeData.data : null;
                    if (!error && data?.user?.email) managerEmailMap[m.id] = data.user.email;
                } catch(e){}
            }));
        }

        // Fetch workers
        const { data: allWorkers } = await supabaseClient.from('workers')
            .select('*')
            .eq('organization_id', USER_PROFILE.organization_id)
            .order('name');

        const managerMap = {};
        managers?.forEach(m => managerMap[m.shop_id] = m);

        const workerMap = {};
        allWorkers?.forEach(w => {
            if (!workerMap[w.shop_id]) workerMap[w.shop_id] = [];
            workerMap[w.shop_id].push(w);
        });

        container.innerHTML = shops.map(shop => {
            const manager = managerMap[shop.id];
            const workers = workerMap[shop.id] || [];

            let managerHtml = `
                <div class="manager-info" style="opacity: 0.6;">
                    <div class="manager-avatar" style="background: #f1f5f9; color: #94a3b8;"><i class="fas fa-user-slash"></i></div>
                    <div>
                        <div style="font-weight: 600; color: #64748b; font-size: 0.95em;">No Manager Assigned</div>
                    </div>
                </div>`;
            if (manager) {
                const initials = manager.full_name ? manager.full_name.substring(0, 2).toUpperCase() : 'MGR';
                const managerEmail = managerEmailMap[manager.id] || 'No Email';
                managerHtml = `
                    <div class="manager-info">
                        <div class="manager-avatar">${initials}</div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight:600; color:var(--brand-navy);">${manager.full_name}</div>
                            <div style="color: #64748b; font-size: 0.8em;"><i class="fas fa-envelope" style="margin-right: 4px;"></i>${managerEmail}</div>
                            <div style="font-size:0.8em; color:#10b981; font-weight: 600; text-transform:uppercase; margin-top: 2px;">Shop Manager <i class="fas fa-shield-check" style="margin-left:4px;"></i></div>
                        </div>
                    </div>`;
            }

            let workersHtml = '<tr><td colspan="2" style="text-align:center; padding:10px; color:#94a3b8;">No workers added.</td></tr>';
            if (workers.length > 0) {
                workersHtml = workers.map(w => `
                    <li class="worker-item">
                        <span><i class="fas fa-user-tag" style="color:#cbd5e1; margin-right:8px;"></i>${w.name}</span>
                        <div>
                            <span class="worker-role-badge">${w.role || 'Tailor'}</span>
                            <button onclick="deleteWorker('${w.id}', '${w.name.replace(/'/g, "\\'")}')" class="small-btn" style="background:transparent; color:#ef4444; border:none; padding:4px; font-size:1em; cursor:pointer;" title="Remove Worker">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </li>
                `).join('');
            }

            const isPendingDeletion = shop.status === 'Pending Deletion';
            const cardOpacity = isPendingDeletion ? '0.6' : '1';
            const cardFilter = isPendingDeletion ? 'grayscale(100%)' : 'none';
            const shopLabel = isPendingDeletion ? `<span style="color:#ef4444; font-size:0.75em; margin-left:10px; border:1px solid #ef4444; padding:2px 6px; border-radius:4px;">PENDING DELETION</span>` : '';

            return `
                <div class="entity-card" style="opacity: ${cardOpacity}; filter: ${cardFilter}; position: relative;">
                    ${isPendingDeletion ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.2); z-index:5; pointer-events:none;"></div>` : ''}
                    <div class="entity-header">
                        <div class="shop-name"><i class="fas fa-store-alt" style="color:var(--brand-gold);"></i> ${shop.name} ${shopLabel}</div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                            <span class="shop-worker-count">${workers.length} WORKERS</span>
                            ${!isPendingDeletion ? `
                            <button onclick="openEditShopModal('${shop.id}')" class="small-btn shop-settings-btn" title="Edit Shop Settings">
                                <i class="fas fa-cog"></i> Settings
                            </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="entity-body">
                        ${managerHtml}
                        <div style="margin-top:20px;">
                            <h4 style="font-size:0.85em; color:#64748b; border-bottom:1px solid #e2e8f0; padding-bottom:5px; margin-bottom:10px; text-transform:uppercase;">Workers</h4>
                            <ul class="worker-list">
                                ${workersHtml}
                            </ul>
                        </div>
                    </div>
                    <div class="entity-actions" style="position: relative; z-index:10;">
                        ${isPendingDeletion ? `
                            <button onclick="restoreShop('${shop.id}', '${shop.name.replace(/'/g, "\\'")}')" class="action-btn" style="background:#10b981; color:white; border-color:#10b981; margin:0 auto;" title="Restore Shop">
                                <i class="fas fa-trash-restore"></i> Restore Shop
                            </button>
                        ` : (manager ? `
                            <button class="action-btn" onclick="openResetPasswordModal('${manager.id}', '${manager.full_name.replace(/'/g, "\\'")}')" title="Reset Manager Password">
                                <i class="fas fa-key"></i> Key Reset
                            </button>
                            <button onclick="fireManager('${manager.id}', '${shop.id}', '${manager.full_name.replace(/'/g, "\\'")}')" class="action-btn danger" title="Remove Manager">
                                <i class="fas fa-user-times"></i> Remove
                            </button>
                        ` : `
                            <button class="action-btn" style="background:#10b981; color:white; border-color:#10b981;" onclick="openAssignManagerModal('${shop.id}', '${shop.name.replace(/'/g, "\\'")}')" title="Assign New Manager">
                                <i class="fas fa-user-plus"></i> Assign Manager
                            </button>
                        `)}
                        ${!isPendingDeletion ? `
                        <button onclick="deleteShop('${shop.id}', '${shop.name.replace(/'/g, "\\'")}')" class="action-btn danger" style="margin-left:auto;" title="Delete Shop">
                            <i class="fas fa-trash-alt"></i> Delete Shop
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        logDebug("Error loading command center", error, 'error');
        container.innerHTML = '<p style="color:#dc3545;">Failed to load Active Directory</p>';
    }
}

async function createShopAndManager(e) {
    e.preventDefault();
    const msg = document.getElementById('shop-message');
    msg.textContent = "Processing...";

    const shopName = document.getElementById('new-shop-name').value;
    const mgrName = document.getElementById('new-manager-name').value;
    const email = document.getElementById('new-manager-email').value;
    const password = document.getElementById('new-manager-password').value;

    try {
        const admin = window.supabaseClient;

        // 1. Create Auth User
        const { data: edgeData, error: authError } = await window.supabaseClient.functions.invoke('admin-proxy', { body: { action: 'createUser', payload: {
            email, password, email_confirm: true, user_metadata: { full_name: mgrName }
        } } });
        const user = edgeData ? edgeData.data.user : null;
        if (authError) throw authError;

        // 2. Create Shop
        const { data: shop, error: shopError } = await admin.from('shops').insert([{ name: shopName }]).select().single();
        if (shopError) throw shopError;

        // 3. Create Profile
        const { error: profError } = await admin.from('user_profiles').insert([{
            id: user.user.id, full_name: mgrName, role: 'manager', shop_id: shop.id
        }]);
        if (profError) throw profError;

        msg.textContent = "Success!";
        msg.className = "success";
        document.getElementById('add-shop-form').reset();
        loadShopCommandCenter();

    } catch (error) {
        msg.textContent = "Error: " + error.message;
        msg.className = "error";
    }
}

window.openResetPasswordModal = function(userId, userName) {
    console.log("Key Reset Clicked", userId, userName);
    if (!userId) {
        alert("Error: No user ID!");
        return;
    }
    const modal = document.getElementById('password-reset-modal');
    if (!modal) {
        alert("Error: Modal not found in HTML!");
        return;
    }
    document.getElementById('reset-user-id').value = userId;
    document.getElementById('reset-user-name').textContent = userName;
    document.getElementById('new-reset-password').value = '';
    
    // Force ALL possible CSS visibility properties
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.style.pointerEvents = 'auto';
    modal.style.zIndex = '99999999'; 
    modal.classList.add('active'); // Just in case
    
    console.log("Modal display forced to flex with full opacity/visibility");
}

window.handlePasswordReset = async function() {
    const userId = document.getElementById('reset-user-id').value;
    const newPass = document.getElementById('new-reset-password').value;

    if (!userId || newPass.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }

    try {
        const adminClient = window.supabaseClient;
        

        const { data: edgeData, error } = await window.supabaseClient.functions.invoke('admin-proxy', { body: { action: 'updateUserById', payload: { id: userId,  password: newPass  } } });
        const data = edgeData ? edgeData.data : null;
        if (error) throw error;

        alert("✅ Password updated successfully! The manager can now log in with the new password.");
        document.getElementById('password-reset-modal').style.display = 'none';
    } catch (error) {
        alert("❌ Error: " + error.message);
    }
}

window.fireManager = async function(userId, shopId, managerName) {
    if (!confirm(`Are you sure you want to remove ${managerName} from their position as manager? Their account will be downgraded to a worker.`)) return;
    try {
        const admin = window.supabaseClient;
        // Security check: Verify target profile is in this owner's organization
        const { data: targetProfile } = await admin.from('user_profiles').select('organization_id').eq('id', userId).single();
        if (!targetProfile || targetProfile.organization_id !== USER_PROFILE.organization_id) {
            throw new Error("Unauthorized: This user does not belong to your organization.");
        }
        
        // Update user_profiles instead of deleting, leave them in the shop
        const { error } = await admin.from('user_profiles')
            .update({ role: 'worker' }) // Keep shop_id so they belong to the shop
            .eq('id', userId);
            
        if (error) throw error;

        // Also add them to the workers table so they show up under the shop's workers list
        await admin.from('workers').insert([{
            organization_id: targetProfile.organization_id,
            shop_id: shopId,
            name: managerName,
            role: 'tailor'
        }]);
        
        loadShopCommandCenter();
    } catch (e) {
        alert(e.message);
    }
}

window.openAssignManagerModal = function(shopId, shopName) {
    document.getElementById('assign-manager-shop-id').value = shopId;
    document.getElementById('assign-manager-shop-name').textContent = shopName;
    document.getElementById('assign-manager-modal').style.display = 'flex';
}

window.handleAssignManagerToShop = async function(e) {
    e.preventDefault();
    if (!USER_PROFILE || !USER_PROFILE.organization_id) return;

    const shopId = document.getElementById('assign-manager-shop-id').value;
    const mgrName = document.getElementById('assign-manager-name').value.trim();
    const mgrEmail = document.getElementById('assign-manager-email').value.trim();
    const mgrPass = document.getElementById('assign-manager-password').value;
    const msg = document.getElementById('assign-manager-message');
    const submitBtn = document.querySelector('#assign-manager-form button[type="submit"]');

    if (!shopId || !mgrName || !mgrEmail || !mgrPass) {
        msg.innerHTML = '<span style="color:red;">Please fill all fields</span>';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Assigning...';
    msg.innerHTML = '';

    try {
        const adminClient = window.supabaseClient;
        

        // 1. Create Manager Auth User
        const { data: edgeData, error: authErr } = await window.supabaseClient.functions.invoke('admin-proxy', { body: { action: 'createUser', payload: {
            email: mgrEmail,
            password: mgrPass,
            email_confirm: true,
            user_metadata: { full_name: mgrName }
        } } });
        const authUser = edgeData ? edgeData.data.user : null;

        if (authErr) {
            if (authErr.context && typeof authErr.context.json === 'function') {
                try {
                    const errBody = await authErr.context.json();
                    throw new Error(errBody.error || authErr.message);
                } catch (e) {
                    throw authErr;
                }
            }
            throw authErr;
        }

        // 2. Create Manager User Profile
        const { error: profileErr } = await supabaseClient.from('user_profiles').insert([{
            id: authUser.id,
            organization_id: USER_PROFILE.organization_id,
            shop_id: shopId,
            full_name: mgrName,
            role: 'manager'
        }]);

        if (profileErr) throw profileErr;

        alert(`✅ Manager '${mgrName}' successfully assigned to the shop!`);
        document.getElementById('assign-manager-form').reset();
        document.getElementById('assign-manager-modal').style.display = 'none';
        
        loadShopCommandCenter();

    } catch (error) {
        msg.innerHTML = `<span style="color:red;">❌ Error: ${error.message}</span>`;
        logDebug("Assign Manager Error", error, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Assign Manager';
    }
}

async function deleteShop(shopId, name) {
    if (!confirm(`Warning 1/4: Are you sure you want to delete shop "${name}"?`)) return;
    if (!confirm(`Warning 2/4: This will soft-delete the shop for 48 hours and disable all operations. Proceed?`)) return;
    if (!confirm(`Warning 3/4: Are you absolutely certain? This will affect all workers and the manager.`)) return;
    const typed = prompt(`Warning 4/4: Type "${name}" to confirm deletion:`);
    if (typed !== name) {
        alert("Shop name did not match. Deletion cancelled.");
        return;
    }
    
    try {
        const admin = window.supabaseClient;
        // Security check: Verify shop belongs to this owner's organization
        const { data: targetShop } = await admin.from('shops').select('organization_id').eq('id', shopId).single();
        if (!targetShop || targetShop.organization_id !== USER_PROFILE.organization_id) {
            throw new Error("Unauthorized: This shop does not belong to your organization.");
        }
        
        // Soft delete: update status and set deleted_at
        const deletedAt = new Date().toISOString();
        const { error } = await admin.from('shops').update({
            status: 'Pending Deletion',
            deleted_at: deletedAt
        }).eq('id', shopId);
        
        if (error) throw error;
        
        // We do NOT delete the manager or workers yet. They remain attached but the shop is inaccessible.
        alert(`Shop "${name}" has been placed in Pending Deletion state for 48 hours.`);
        loadShopCommandCenter();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function restoreShop(shopId, name) {
    if (!confirm(`Restore shop "${name}"? It will become fully active again.`)) return;
    try {
        const admin = window.supabaseClient;
        const { error } = await admin.from('shops').update({
            status: 'Active',
            deleted_at: null
        }).eq('id', shopId);
        
        if (error) throw error;
        alert(`Shop "${name}" has been successfully restored.`);
        loadShopCommandCenter();
    } catch (e) {
        alert("Error restoring shop: " + e.message);
    }
}

async function handleAddShopAndManager(e) {
    if (e) e.preventDefault();
    if (!USER_PROFILE || !USER_PROFILE.organization_id) {
        alert("You must be logged in as an Owner.");
        return;
    }

    const shopName = document.getElementById('new-shop-name').value.trim();
    const businessType = document.getElementById('new-shop-business-type')?.value || 'tailor';
    const mgrName = document.getElementById('new-manager-name').value.trim();
    const mgrEmail = document.getElementById('new-manager-email').value.trim();
    const mgrPass = document.getElementById('new-manager-password').value;
    const msg = document.getElementById('shop-message');
    const submitBtn = document.querySelector('#add-shop-form button[type="submit"]');

    const addressInput = document.getElementById('new-shop-address').value.trim();
    let latInput = document.getElementById('new-shop-lat').value;
    let lngInput = document.getElementById('new-shop-lng').value;

    if (!shopName || !mgrName || !mgrEmail || !mgrPass || !addressInput) {
        msg.innerHTML = '<span style="color:red;">Please fill all fields, including Address</span>';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Provisioning...';
    msg.innerHTML = '';

    try {
        // If they typed an address but didn't click "Use My Location", geocode it now
        if (!latInput || !lngInput) {
            msg.innerHTML = '<i class="fas fa-search-location"></i> Looking up address coordinates...';
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput)}`);
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
                latInput = geoData[0].lat;
                lngInput = geoData[0].lon;
            } else {
                msg.innerHTML = '<span style="color:orange;">Warning: Could not find exact map coordinates for this address. It will not appear on the map.</span>';
                // Proceed anyway, but without coordinates
            }
        }

        // 1. Create the Shop
        msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating shop record...';
        const shopPayload = {
            organization_id: USER_PROFILE.organization_id,
            name: shopName,
            business_type: businessType
        };

        // Add coordinates if we have them
        if (latInput && lngInput) {
            shopPayload.latitude = parseFloat(latInput);
            shopPayload.longitude = parseFloat(lngInput);
        }

        const { data: newShop, error: shopErr } = await supabaseClient.from('shops').insert([shopPayload]).select().single();

        if (shopErr) throw shopErr;

        // 2. Provision Manager Auth User using Admin Client
        const adminClient = window.supabaseClient;
        

        const { data: edgeData, error: authErr } = await window.supabaseClient.functions.invoke('admin-proxy', { body: { action: 'createUser', payload: {
            email: mgrEmail,
            password: mgrPass,
            email_confirm: true,
            user_metadata: { full_name: mgrName }
        } } });
        const authUser = edgeData ? edgeData.data.user : null;

        if (authErr) {
            if (authErr.context && typeof authErr.context.json === 'function') {
                try {
                    const errBody = await authErr.context.json();
                    throw new Error(errBody.error || authErr.message);
                } catch (e) {
                    throw authErr;
                }
            }
            throw authErr;
        }

        // 3. Create Manager User Profile
        const { error: profileErr } = await supabaseClient.from('user_profiles').insert([{
            id: authUser.id,
            organization_id: USER_PROFILE.organization_id,
            shop_id: newShop.id,
            full_name: mgrName,
            role: 'manager'
        }]);

        if (profileErr) throw profileErr;

        msg.innerHTML = `<span style="color:green;">✅ Shop '${shopName}' and Manager '${mgrName}' created!</span>`;
        document.getElementById('add-shop-form').reset();
        await loadAdminManagementScreen(); // Refresh
        await loadShopsForDropdown('shop-filter'); // Refresh global dropdowns if any

    } catch (error) {
        msg.innerHTML = `<span style="color:red;">❌ Error: ${error.message}</span>`;
           document.getElementById('new-manager-email').value = '';
        document.getElementById('new-manager-password').value = '';
        if(document.getElementById('new-shop-address')) document.getElementById('new-shop-address').value = '';
        if(document.getElementById('new-shop-lat')) document.getElementById('new-shop-lat').value = '';
        if(document.getElementById('new-shop-lng')) document.getElementById('new-shop-lng').value = '';

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Shop & Manager';
    }
}

// --- Map Location Helper for Shop Registration ---
function getAdminLocation() {
    const btn = document.getElementById('btn-get-location');
    const msg = document.getElementById('shop-message');
    
    if (!navigator.geolocation) {
        msg.innerHTML = '<span style="color:red;">Geolocation is not supported by your browser.</span>';
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        document.getElementById('new-shop-lat').value = lat;
        document.getElementById('new-shop-lng').value = lng;

        try {
            // Reverse Geocode to get a human readable address
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            
            if (data && data.display_name) {
                // Simplify the address a bit
                const addressParts = data.display_name.split(',').slice(0, 3);
                document.getElementById('new-shop-address').value = addressParts.join(',');
            } else {
                document.getElementById('new-shop-address').value = "Pinned Location";
            }
        } catch (e) {
            console.error("Reverse geocoding failed", e);
            document.getElementById('new-shop-address').value = "Pinned Location";
        }

        btn.innerHTML = '<i class="fas fa-check"></i> Location Set';
        btn.style.color = '#10b981';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-location-arrow"></i> Use My Location';
            btn.style.color = 'var(--brand-gold)';
            btn.disabled = false;
        }, 3000);

    }, (error) => {
        btn.innerHTML = '<i class="fas fa-location-arrow"></i> Use My Location';
        btn.disabled = false;
        msg.innerHTML = '<span style="color:red;">Location access denied or failed.</span>';
    });
}

async function handleAdminAddWorker(e) {
    if (e) e.preventDefault();
    if (!USER_PROFILE || !USER_PROFILE.organization_id) return;

    const shopId = document.getElementById('admin-shop-select').value;
    const workerName = document.getElementById('admin-new-worker-name').value.trim();
    const phone = document.getElementById('admin-new-worker-phone').value.trim();
    const btn = document.querySelector('#admin-add-worker-form button[type="submit"]');

    if (!shopId || !workerName) {
        alert("Shop and Worker Name are required");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Assigning...';

    try {
        // Insert into workers table
        const { error } = await supabaseClient.from('workers').insert([{
            organization_id: USER_PROFILE.organization_id,
            shop_id: shopId,
            name: workerName,
            phone_number: phone,
            role: 'tailor'
        }]);

        if (error) throw error;

        alert(`✅ Crew member ${workerName} assigned successfully!`);
        document.getElementById('admin-add-worker-form').reset();
        await loadAdminManagementScreen();

    } catch (error) {
        alert("Error: " + error.message);
        logDebug("Add Worker Error", error, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Assign Worker';
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    const actionText = currentStatus === 'Active' ? 'SUSPEND' : 'REACTIVATE';
    const icon = currentStatus === 'Active' ? '<i class="fas fa-user-slash text-danger"></i>' : '<i class="fas fa-user-check text-success"></i>';
    
    showMngModal({
        icon: icon,
        title: `Confirm ${actionText}?`,
        text: `Are you sure you want to change this user's status to ${newStatus}?`,
        buttons: [
            { text: 'Cancel', style: 'background:#f1f5f9; color:#64748b;', action: hideMngModal },
            { 
                text: `Yes, ${actionText}`, 
                style: `background:${currentStatus === 'Active' ? '#ef4444' : '#10b981'}; color:white;`,
                action: async () => {
                    try {
                        const { error } = await supabaseClient
                            .from('user_profiles')
                            .update({ status: newStatus })
                            .eq('id', userId);

                        if (error) throw error;
                        
                        // Show success modal
                        showMngModal({
                            icon: '<i class="fas fa-check-circle text-success"></i>',
                            title: 'Success!',
                            text: `User has been successfully ${newStatus.toLowerCase()}.`,
                            buttons: [{ text: 'Great', style: 'background:var(--brand-navy); color:white;', action: loadPlatformUsers }]
                        });
                    } catch (err) {
                        showMngModal({
                            icon: '<i class="fas fa-times-circle text-danger"></i>',
                            title: 'Error',
                            text: err.message,
                            buttons: [{ text: 'Close', style: 'background:#f1f5f9; color:#64748b;' }]
                        });
                    }
                }
            }
        ]
    });
}

window.copyAdminCredentials = function(email, password, name) {
    const loginUrl = window.location.origin + '/index.html';
    const text = `*Welcome to Sir's 'n' Suits, ${name}!* ðŸ‘”\n\nYour Administrator account has been securely provisioned.\n\n*Login Portal:* ${loginUrl}\n*Email:* ${email}\n*Password:* ${password}\n\n_Please log in to manage your organization orders._`;
    navigator.clipboard.writeText(text).then(() => {
        alert("Credentials copied to clipboard!");
    }).catch(err => {
        alert("Failed to copy text: " + err);
    });
}

window.shareAdminWhatsApp = function(email, password, name) {
    const loginUrl = window.location.origin + '/index.html';
    const text = `*Welcome to Sir's 'n' Suits, ${name}!* ðŸ‘”\n\nYour Administrator account has been securely provisioned.\n\n*Login Portal:* ${loginUrl}\n*Email:* ${email}\n*Password:* ${password}\n\n_Please log in to manage your organization orders._`;
    const waUrl = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(waUrl, "_blank");
}

window.toggleOrganizationSuspension = async function(id, currentStatus) {
    const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    const actionText = currentStatus === 'Suspended' ? 'reactivate' : 'suspend';
    if (!confirm(`Are you sure you want to ${actionText} this organization?`)) return;
    try {
        const { error } = await supabaseClient
            .from('organizations')
            .update({ subscription_status: newStatus })
            .eq('id', id);
        if (error) throw error;
        alert(`Organization successfully ${newStatus === 'Suspended' ? 'suspended' : 'activated'}!`);
        loadOrganizations();
    } catch (err) {
        alert("Error updating organization: " + err.message);
    }
}

window.deleteOrganization = async function(id) {
    if (!confirm("Are you sure? This will delete all data related to this organization!")) return;
    try {
        const { error } = await supabaseClient.from('organizations').delete().eq('id', id);
        if (error) throw error;
        loadOrganizations();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

window.deleteWorker = async function (workerId) {
    if (!confirm("Delete this worker?")) return;

    try {
        // Check if worker has active orders
        const { data: activeOrders } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('worker_id', workerId)
            .neq('status', 6);

        if (activeOrders && activeOrders.length > 0) {
            alert("Cannot delete worker with active assignments. Reassign orders first.");
            return;
        }

        const { error } = await supabaseClient
            .from('workers')
            .delete()
            .eq('id', workerId);

        if (error) throw error;

        alert("Worker deleted.");
        loadShopCommandCenter();

    } catch (error) {
        alert("Error: " + error.message);
    }
}

window.deleteWorker = async function (workerId) {
    if (!confirm("Delete this worker?")) return;

    try {
        // Check if worker has active orders
        const { data: activeOrders } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('worker_id', workerId)
            .neq('status', 6);

        if (activeOrders && activeOrders.length > 0) {
            alert("Cannot delete worker with active assignments. Reassign orders first.");
            return;
        }

        const { error } = await supabaseClient
            .from('workers')
            .delete()
            .eq('id', workerId);

        if (error) throw error;

        alert("Worker deleted.");
        loadShopCommandCenter();

    } catch (error) {
        alert("Error: " + error.message);
    }
}

window.deleteWorker = async function(id, name) {
    if (!confirm(`Are you sure you want to permanently remove ${name} from the crew?`)) return;
    try {
        const { error } = await supabaseClient.from('workers').delete().eq('id', id);
        if (error) throw error;
        alert(`✅ Crew member ${name} removed.`);
        loadShopCommandCenter();
    } catch (err) {
        alert("Error removing crew member: " + err.message);
    }
}

window.openEditShopModal = async function(shopId) {
    // Reset to first tab
    if (typeof switchShopSettingsTab === 'function') {
        switchShopSettingsTab('tab-basic');
    }
    
    try {
        const { data: shop, error } = await supabaseClient.from('shops').select('*').eq('id', shopId).single();
        if (error) throw error;
        
        document.getElementById('edit-shop-id').value = shop.id;
        document.getElementById('edit-shop-name').value = shop.name || '';
        const paymentType = shop.payment_method_type || 'paybill';
        const typeSelect = document.getElementById('edit-shop-payment-type');
        if (typeSelect) {
            typeSelect.value = paymentType;
            typeSelect.dispatchEvent(new Event('change'));
        }
        document.getElementById('edit-shop-paybill').value = shop.paybill_number || '';
        document.getElementById('edit-shop-account').value = shop.paybill_account || '';
        if(document.getElementById('edit-shop-till')) document.getElementById('edit-shop-till').value = shop.till_number || '';
        if(document.getElementById('edit-shop-pochi')) document.getElementById('edit-shop-pochi').value = shop.pochi_number || '';
        document.getElementById('edit-shop-phone').value = shop.phone_number || '';
        document.getElementById('edit-shop-receipt').value = shop.receipt_header_text || '';
        document.getElementById('edit-shop-bank').value = shop.bank_details || '';
        
        if (document.getElementById('edit-shop-address')) {
            document.getElementById('edit-shop-address').value = shop.location_name || '';
            
            const displayContainer = document.getElementById('display-location-container');
            const editContainer = document.getElementById('edit-location-container');
            const displaySpan = document.getElementById('saved-shop-address-display');
            
            if (shop.location_name) {
                if (displaySpan) displaySpan.innerText = shop.location_name;
                if (displayContainer) displayContainer.style.display = 'flex';
                if (editContainer) editContainer.style.display = 'none';
            } else {
                if (displayContainer) displayContainer.style.display = 'none';
                if (editContainer) editContainer.style.display = 'flex';
            }
        }
        
        if (document.getElementById('edit-shop-lat')) document.getElementById('edit-shop-lat').value = shop.latitude || '';
        if (document.getElementById('edit-shop-lng')) document.getElementById('edit-shop-lng').value = shop.longitude || '';
        
        if (document.getElementById('edit-shop-is-public')) {
            document.getElementById('edit-shop-is-public').checked = !!shop.is_public;
        }
        if (document.getElementById('edit-shop-loc-name')) {
            document.getElementById('edit-shop-loc-name').value = shop.location_name || '';
        }
        if (document.getElementById('edit-shop-specialization')) {
            document.getElementById('edit-shop-specialization').value = shop.specialization || '';
        }
        // Reset and populate daily working hours
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        let hoursData = {};
        try {
            if (shop.availability_hours && shop.availability_hours.trim().startsWith('{')) {
                hoursData = JSON.parse(shop.availability_hours);
            }
        } catch (e) {
            console.warn("Could not parse availability_hours JSON", e);
        }

        daysOfWeek.forEach(day => {
            const chk = document.getElementById(`chk-day-${day}`);
            const timeFrom = document.getElementById(`time-from-${day}`);
            const timeTo = document.getElementById(`time-to-${day}`);
            const inputs = document.getElementById(`time-inputs-${day}`);
            const closed = document.getElementById(`closed-label-${day}`);

            if (chk) {
                const dayData = hoursData[day] || {
                    open: day !== 'Sunday', // Sunday closed by default
                    from: '08:00',
                    to: '18:00'
                };

                chk.checked = !!dayData.open;
                if (timeFrom) timeFrom.value = dayData.from || '08:00';
                if (timeTo) timeTo.value = dayData.to || '18:00';

                if (inputs && closed) {
                    if (dayData.open) {
                        inputs.style.display = 'flex';
                        closed.style.display = 'none';
                    } else {
                        inputs.style.display = 'none';
                        closed.style.display = 'block';
                    }
                }
            }
        });

        if (document.getElementById('edit-shop-website')) {
            document.getElementById('edit-shop-website').value = shop.website_url || '';
        }
        if (document.getElementById('edit-shop-instagram')) {
            document.getElementById('edit-shop-instagram').value = shop.instagram_url || '';
        }
        if (document.getElementById('edit-shop-tiktok')) {
            document.getElementById('edit-shop-tiktok').value = shop.tiktok_url || '';
        }
        if (document.getElementById('edit-shop-whatsapp')) {
            document.getElementById('edit-shop-whatsapp').value = shop.whatsapp_number || '';
        }
        if (document.getElementById('edit-shop-banner-img')) {
            document.getElementById('edit-shop-banner-img').value = shop.banner_image || '';
        }
        if (document.getElementById('edit-shop-desc')) {
            document.getElementById('edit-shop-desc').value = shop.description || '';
        }
        
        const preview = document.getElementById('edit-shop-logo-preview');
        const fileInput = document.getElementById('edit-shop-logo-file');
        if (fileInput) fileInput.value = ''; // clear any old selection
        
        if (preview) {
            if (shop.logo_url) {
                preview.src = shop.logo_url;
                preview.style.display = 'block';
            } else {
                preview.src = '';
                preview.style.display = 'none';
            }
        }

        // Reset upload status texts
        const profileStatus = document.getElementById('upload-status');
        if (profileStatus) profileStatus.textContent = '';
        const bannerStatus = document.getElementById('upload-banner-status');
        if (bannerStatus) bannerStatus.textContent = '';

        // Clear files from inputs
        const profileUpload = document.getElementById('shop-profile-upload');
        if (profileUpload) profileUpload.value = '';
        const bannerUpload = document.getElementById('shop-banner-upload');
        if (bannerUpload) bannerUpload.value = '';

        // Load previews for public marketplace assets
        const STORAGE_URL = `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/marketplace-assets/`;
        
        const profilePreview = document.getElementById('edit-shop-profile-preview');
        if (profilePreview) {
            if (shop.profile_image) {
                profilePreview.src = shop.profile_image.startsWith('http') ? shop.profile_image : STORAGE_URL + shop.profile_image;
                profilePreview.style.display = 'block';
            } else {
                profilePreview.src = '';
                profilePreview.style.display = 'none';
            }
        }

        const bannerPreview = document.getElementById('edit-shop-banner-preview');
        if (bannerPreview) {
            if (shop.banner_image) {
                bannerPreview.src = shop.banner_image.startsWith('http') ? shop.banner_image : STORAGE_URL + shop.banner_image;
                bannerPreview.style.display = 'block';
            } else {
                bannerPreview.src = '';
                bannerPreview.style.display = 'none';
            }
        }
        
        document.getElementById('edit-shop-modal').style.display = 'flex';
    } catch (e) {
        alert("Error loading shop details: " + e.message);
    }
}

window.closeEditShopModal = function() {
    document.getElementById('edit-shop-modal').style.display = 'none';
}

window.saveShopDetails = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('save-shop-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const shopId = document.getElementById('edit-shop-id').value;
        const name = document.getElementById('edit-shop-name').value.trim();
        const payment_method_type = document.getElementById('edit-shop-payment-type')?.value || 'paybill';
        const paybill_number = document.getElementById('edit-shop-paybill')?.value.trim() || '';
        const paybill_account = document.getElementById('edit-shop-account')?.value.trim() || '';
        const till_number = document.getElementById('edit-shop-till')?.value.trim() || '';
        const pochi_number = document.getElementById('edit-shop-pochi')?.value.trim() || '';
        const phone_number = document.getElementById('edit-shop-phone').value.trim();
        const receipt_header_text = document.getElementById('edit-shop-receipt').value.trim();
        const bank_details = document.getElementById('edit-shop-bank').value.trim();
        
        const fileInput = document.getElementById('edit-shop-logo-file');
        const file = fileInput.files[0];
        
        let updatePayload = {
            name,
            payment_method_type,
            paybill_number,
            paybill_account,
            till_number,
            pochi_number,
            phone_number,
            receipt_header_text,
            bank_details
        };

        const editAddress = document.getElementById('edit-shop-address')?.value.trim();
        let editLat = document.getElementById('edit-shop-lat')?.value;
        let editLng = document.getElementById('edit-shop-lng')?.value;
        
        if (editAddress) {
            updatePayload.location_name = editAddress;
            if (!editLat || !editLng) {
                btn.innerHTML = '<i class="fas fa-search-location"></i> Geocoding...';
                try {
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(editAddress)}`);
                    const geoData = await geoRes.json();
                    if (geoData && geoData.length > 0) {
                        editLat = geoData[0].lat;
                        editLng = geoData[0].lon;
                    }
                } catch (e) {
                    console.warn("Geocoding failed during edit", e);
                }
            }
        }
        
        if (editLat && editLng) {
            updatePayload.latitude = parseFloat(editLat);
            updatePayload.longitude = parseFloat(editLng);
        }

        if (document.getElementById('edit-shop-is-public')) {
            updatePayload.is_public = document.getElementById('edit-shop-is-public').checked;
        }
        if (document.getElementById('edit-shop-specialization')) {
            updatePayload.specialization = document.getElementById('edit-shop-specialization').value.trim();
        }
        
        // Build Google Maps style hours JSON payload
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const hoursObj = {};
        daysOfWeek.forEach(day => {
            const chk = document.getElementById(`chk-day-${day}`);
            const timeFrom = document.getElementById(`time-from-${day}`);
            const timeTo = document.getElementById(`time-to-${day}`);
            if (chk) {
                hoursObj[day] = {
                    open: chk.checked,
                    from: timeFrom ? timeFrom.value : '08:00',
                    to: timeTo ? timeTo.value : '18:00'
                };
            }
        });
        updatePayload.availability_hours = JSON.stringify(hoursObj);

        if (document.getElementById('edit-shop-website')) {
            updatePayload.website_url = document.getElementById('edit-shop-website').value.trim();
        }
        if (document.getElementById('edit-shop-instagram')) {
            updatePayload.instagram_url = document.getElementById('edit-shop-instagram').value.trim();
        }
        if (document.getElementById('edit-shop-tiktok')) {
            updatePayload.tiktok_url = document.getElementById('edit-shop-tiktok').value.trim();
        }
        if (document.getElementById('edit-shop-whatsapp')) {
            updatePayload.whatsapp_number = document.getElementById('edit-shop-whatsapp').value.trim();
        }
        if (document.getElementById('edit-shop-banner-img')) {
            updatePayload.banner_image = document.getElementById('edit-shop-banner-img').value.trim();
        }
        if (document.getElementById('edit-shop-desc')) {
            updatePayload.description = document.getElementById('edit-shop-desc').value.trim();
        }
        
        if (file) {
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${shopId}_logo_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('shop_logos')
                .upload(filePath, file, { upsert: true });
                
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data } = supabaseClient.storage
                .from('shop_logos')
                .getPublicUrl(filePath);
                
            updatePayload.logo_url = data.publicUrl;
        }

        const { data: updatedData, error: updateError } = await supabaseClient.from('shops').update(updatePayload).eq('id', shopId).select();
        if (updateError) throw updateError;
        
        if (!updatedData || updatedData.length === 0) {
            throw new Error("Update blocked by Database Security (RLS) or Shop not found.");
        }
        
        alert("✅ Shop configuration updated safely!");
        closeEditShopModal();
        loadShopCommandCenter();
        
    } catch (err) {
        if (err.message && (err.message.includes('column') || err.message.includes('does not exist') || err.message.includes('42703'))) {
            alert("❌ Error: Missing columns in the database.\n\nPlease run the SQL query from the file 'add_shop_fields.sql' in your Supabase SQL Editor to add the required fields (working hours, specialization, website) to your database, then try again!");
        } else {
            alert("❌ Error saving shop config: " + err.message);
        }
        logDebug("Shop Update Error:", err, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Configuration';
    }
}

// --- Map Location Helper for Edit Shop Modal ---
window.toggleLocationEditMode = function() {
    document.getElementById('display-location-container').style.display = 'none';
    document.getElementById('edit-location-container').style.display = 'flex';
}

// --- Tab Toggle for Edit Shop Modal ---
window.switchShopSettingsTab = function(tabId) {
    // Hide all contents
    document.querySelectorAll('.shop-tab-content').forEach(el => el.classList.remove('active'));
    // Remove active from all buttons
    document.querySelectorAll('.shop-tab-btn').forEach(el => el.classList.remove('active'));
    
    // Show selected content
    document.getElementById(tabId).classList.add('active');
    // Highlight selected button
    document.getElementById('btn-' + tabId).classList.add('active');
}

window.getEditAdminLocation = function() {
    const btn = document.getElementById('btn-edit-get-location');
    
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        document.getElementById('edit-shop-lat').value = lat;
        document.getElementById('edit-shop-lng').value = lng;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            
            if (data && data.display_name) {
                const addressParts = data.display_name.split(',').slice(0, 3);
                document.getElementById('edit-shop-address').value = addressParts.join(',');
            } else {
                document.getElementById('edit-shop-address').value = "Pinned Location";
            }
        } catch (e) {
            console.error("Reverse geocoding failed", e);
            document.getElementById('edit-shop-address').value = "Pinned Location";
        }

        btn.innerHTML = '<i class="fas fa-check"></i> Found';
        btn.style.color = '#10b981';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-location-arrow"></i> Locate';
            btn.style.color = 'var(--brand-gold)';
            btn.disabled = false;
        }, 3000);

    }, (error) => {
        btn.innerHTML = '<i class="fas fa-location-arrow"></i> Locate';
        btn.disabled = false;
        alert('Location access denied or failed.');
    });
}

// ==========================================
// 📦 ORDER EXTRAS HELPERS
// ==========================================

async function loadExtrasForShop(shopId) {
    const container = document.getElementById('extras-list-container');
    if (!container) return;

    if (!shopId) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; font-style:italic; margin:0;">Select a shop to see available extras.</p>';
        return;
    }

    try {
        const { data: items, error } = await supabaseClient
            .from('inventory_items')
            .select('*')
            .eq('shop_id', shopId)
            .eq('is_active', true)
            .gt('stock_quantity', 0)
            .order('category')
            .order('name');

        if (error) throw error;

        if (!items || items.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; font-style:italic; margin:0;">No items in stock for this shop. Add items via Inventory Management.</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="extra-item-row" data-extra-id="${item.id}">
                <div style="flex:1;">
                    <strong class="extra-item-name">${item.name}</strong>
                    <span class="extra-item-cat">${item.category}</span>
                    <div class="extra-item-desc">${formatCurrency(item.price)} each &middot; ${item.stock_quantity} in stock</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" min="0" max="${item.stock_quantity}" value="0" class="extra-qty-input" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}" data-max-stock="${item.stock_quantity}"
                        onchange="updateExtrasSubtotal()" oninput="updateExtrasSubtotal()">
                </div>
            </div>
        `).join('');

        updateExtrasSubtotal();
    } catch (err) {
        container.innerHTML = `<p style="text-align:center; color:#ef4444; margin:0;">Error loading items: ${err.message}</p>`;
    }
}

function updateExtrasSubtotal() {
    const inputs = document.querySelectorAll('.extra-qty-input');
    let subtotal = 0;
    let listHTML = '';

    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        const price = parseFloat(input.dataset.itemPrice) || 0;
        subtotal += qty * price;

        if (qty > 0) {
            listHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.95em; color:#334155;">
                            <span>• ${input.dataset.itemName} (x${qty})</span>
                            <span style="font-weight:600;">${formatCurrency(price * qty)}</span>
                         </div>`;
        }
    });

    const el = document.getElementById('extras-subtotal');
    if (el) el.textContent = formatCurrency(subtotal);

    // [NEW] Update Grand Total Display for Creation Form
    const priceInput = document.getElementById('price');
    const grandTotalEl = document.getElementById('grand-total-display');
    if (priceInput && grandTotalEl) {
        const base = parseFloat(priceInput.value) || 0;
        grandTotalEl.textContent = formatCurrency(base + subtotal);
    }

    // [NEW] Update accessories list in the PDF Export summary target
    const pdfList = document.getElementById('summary-accessories');
    const pdfBox = document.getElementById('summary-accessories-container');
    if (pdfList && pdfBox) {
        if (listHTML === '') {
            pdfBox.style.display = 'none';
        } else {
            pdfBox.style.display = 'block';
            pdfList.innerHTML = listHTML;
        }
    }

    // [NEW] Update Balance and Order Total VISUALLY for Edit Order Details view
    const editPriceInput = document.getElementById('edit-price');
    if (editPriceInput) {
        const basePrice = parseFloat(editPriceInput.value) || 0;
        const finalPrice = basePrice + subtotal;
        
        const totalDisplay = document.getElementById('display-total-price');
        const balanceDisplay = document.getElementById('display-balance-due');
        const paidDisplay = document.getElementById('display-total-paid');
        
        if (totalDisplay) totalDisplay.textContent = formatCurrency(finalPrice);
        if (balanceDisplay && paidDisplay) {
            const paid = parseFloat(paidDisplay.textContent.replace(/[^0-9.-]/g, '')) || 0;
            balanceDisplay.textContent = formatCurrency(finalPrice - paid);
        }
    }
}

function collectSelectedExtras() {
    const extras = [];
    const inputs = document.querySelectorAll('.extra-qty-input');
    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            extras.push({
                inventory_item_id: input.dataset.itemId,
                item_name: input.dataset.itemName,
                price: parseFloat(input.dataset.itemPrice) || 0,
                quantity: qty
            });
        }
    });
    return extras;
}







// ==========================================
// 🔔 UNREAD MESSAGES NOTIFICATION
// ==========================================



// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}




window.viewOrgShops = async function(orgId, orgName) {
    document.getElementById('view-shops-org-name').innerText = orgName + ' - Shops';
    document.getElementById('view-shops-modal').style.display = 'flex';
    const tbody = document.getElementById('org-shops-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Loading shops...</td></tr>';

    try {
        const { data: shops, error } = await supabaseClient
            .from('shops')
            .select('*')
            .eq('organization_id', orgId)
            .order('name');
            
        if (error) throw error;

        if (!shops || shops.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No shops found for this organization</td></tr>';
            return;
        }

        tbody.innerHTML = shops.map(shop => {
            const statusText = shop.status || 'Active';
            const isSuspended = statusText === 'Suspended';
            const badgeColor = isSuspended ? '#ef4444' : '#10b981';
            const btnText = isSuspended ? 'Reactivate' : 'Suspend';
            const btnBg = isSuspended ? '#10b981' : '#f59e0b';
            
            return `
            <tr>
                <td><small>${shop.id.slice(-8)}</small></td>
                <td><strong>${shop.name}</strong></td>
                <td>${shop.location || 'N/A'}</td>
                <td><span style="background:${badgeColor}; color:white; padding:3px 10px; border-radius:12px; font-weight:bold; font-size:0.85em;">${statusText}</span></td>
                <td>
                    <button class="small-btn" onclick="toggleShopSuspension('${shop.id}', '${statusText}', '${orgId}', '${orgName.replace(/'/g, "\\'")}')" style="background:${btnBg}; color:white; border:none; margin-right:5px;">${btnText}</button>
                    <button class="small-btn" onclick="adminDeleteShop('${shop.id}', '${orgId}', '${orgName.replace(/'/g, "\\'")}')" style="background:#ef4444; color:white; border:none;">Delete</button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">Error loading shops: ${err.message}</td></tr>`;
    }
}

window.toggleShopSuspension = async function(shopId, currentStatus, orgId, orgName) {
    const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    const actionText = currentStatus === 'Suspended' ? 'reactivate' : 'suspend';
    if (!confirm(`Are you sure you want to ${actionText} this shop?`)) return;
    try {
        const { error } = await supabaseClient
            .from('shops')
            .update({ status: newStatus })
            .eq('id', shopId);
        if (error) throw error;
        alert(`Shop successfully ${newStatus === 'Suspended' ? 'suspended' : 'activated'}!`);
        viewOrgShops(orgId, orgName);
    } catch (err) {
        alert("Error updating shop: " + err.message);
    }
}

window.adminDeleteShop = async function(shopId, orgId, orgName) {
    if (!confirm(`Warning 1/4: Are you sure you want to delete this shop?`)) return;
    if (!confirm(`Warning 2/4: This will soft-delete the shop for 48 hours and disable all operations. Proceed?`)) return;
    if (!confirm(`Warning 3/4: Are you absolutely certain? This will affect all workers and the manager.`)) return;
    const typed = prompt(`Warning 4/4: Type "DELETE" to confirm deletion of the shop in ${orgName}:`);
    if (typed !== "DELETE") {
        alert("Confirmation did not match. Deletion cancelled.");
        return;
    }
    
    try {
        const deletedAt = new Date().toISOString();
        const { error } = await supabaseClient.from('shops').update({
            status: 'Pending Deletion',
            deleted_at: deletedAt
        }).eq('id', shopId);
        if (error) throw error;
        
        alert(`Shop has been placed in Pending Deletion state for 48 hours.`);
        viewOrgShops(orgId, orgName);
        loadOrganizations(); // update shop count
    } catch (err) {
        alert("Error: " + err.message);
    }
}

window.loadAuditLogs = async function() {
    const tbody = document.getElementById('audit-logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading...</td></tr>';
    try {
        const { data: logs, error } = await supabaseClient
            .from('audit_logs')
            .select(`
                id, created_at, action, details,
                organizations ( name )
            `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--brand-slate);">No audit logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const dateStr = new Date(log.created_at).toLocaleString();
            const orgName = log.organizations ? log.organizations.name : 'Unknown';
            let detailsHtml = '';
            
            if (log.action === 'RENAME_ORGANIZATION' || log.action === 'RENAME_ORG') {
                detailsHtml = `Changed from <strong>${escapeHTML(log.details.old_name)}</strong> to <strong>${escapeHTML(log.details.new_name)}</strong>`;
            } else if (log.action === 'SECURITY_UPDATE') {
                const updates = [];
                if (log.details.email_updated) updates.push('Email');
                if (log.details.password_updated) updates.push('Password');
                detailsHtml = `Updated: ${updates.join(', ')}`;
            } else {
                detailsHtml = escapeHTML(JSON.stringify(log.details));
            }

            return `
                <tr>
                    <td><small style="color:var(--brand-slate);">${dateStr}</small></td>
                    <td style="font-weight:600;">${orgName}</td>
                    <td><span style="background:rgba(139, 92, 246, 0.1); color:#8b5cf6; padding:3px 8px; border-radius:4px; font-size:0.85em; font-weight:600;">${log.action.replace('_', ' ')}</span></td>
                    <td>${detailsHtml}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading audit logs:", err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444;">Error loading logs: ${err.message}</td></tr>`;
    }
}
