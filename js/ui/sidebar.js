
// ==========================================
// 🎨 DYNAMIC SIDEBAR BRANDING
// ==========================================
/**
 * Dynamically updates sidebar branding based on Shop assignment.
 * If user is restricted to a shop, shows Shop Name. 
 * Defaults to APP_CONFIG.appName for owners/global users.
 */
async function updateSidebarBranding(forcedName = null) {
    const sidebarLogo = document.querySelector('.sidebar-logo');
    const sidebarSub = document.querySelector('.sidebar-subtitle');
    const navEl = document.querySelector('.sidebar nav');
    const userInfoEl = document.getElementById('user-info');

    // Make sure dropdown handler exists globally
    if (typeof window.toggleSidebarDropdown !== 'function') {
        window.toggleSidebarDropdown = function(button) {
            const dropdown = button.closest('.sidebar-dropdown');
            if (dropdown) {
                dropdown.classList.toggle('open');
            }
        };
    }

    let mainTitle = forcedName || "";
    let subTitle = "";

    const pathName = window.location.pathname;
    const isSuperadminPage = pathName.includes('superadmin-');

    if (isSuperadminPage) {
        mainTitle = "STITCH & STYLES KENYA";
        subTitle = "SAAS CONTROL";
    }

    if (typeof USER_PROFILE !== 'undefined' && USER_PROFILE) {
        try {
            // Fetch organization name for non-superadmins
            if (!forcedName && USER_PROFILE.role !== 'superadmin' && USER_PROFILE.organization_id) {
                const { data: org } = await supabaseClient
                    .from('organizations')
                    .select('name')
                    .eq('id', USER_PROFILE.organization_id)
                    .maybeSingle();
                if (org && org.name) {
                    mainTitle = org.name;
                }
            }
        } catch (e) {
            console.warn("Sidebar branding fetch error:", e);
        }

        // Title and subtitle rules based on role
        if (USER_PROFILE.role === 'superadmin') {
            mainTitle = "STITCH & STYLES KENYA";
            subTitle = "SAAS CONTROL";
        } else if (USER_PROFILE.role === 'owner') {
            subTitle = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.appSubtitle) ? APP_CONFIG.appSubtitle : "BY RONNY";
        } else {
            subTitle = "STAFF PORTAL";
        }

        // Render User Info panel
        if (userInfoEl) {
            let roleLabel = USER_PROFILE.role === 'owner' ? 'Owner' :
                            USER_PROFILE.role === 'superadmin' ? 'Superadmin' : 'Manager';
            userInfoEl.innerHTML = `Logged in as: <strong>${roleLabel}</strong><br><small style="color: var(--brand-gold); font-size: 0.85em; font-weight: 500;">${USER_PROFILE.full_name}</small>`;
        }

        // Inject Navigation Menu
        if (navEl) {
            let navHtml = '';

            if (USER_PROFILE.role === 'superadmin') {
                navHtml = `
                    <a href="/views/superadmin/superadmin-dashboard.html" id="nav-dashboard"><i class="fas fa-chart-pie" style="margin-right: 8px;"></i> Dashboard</a>
                    <a href="/views/superadmin/superadmin-ledger.html" id="nav-ledger"><i class="fas fa-file-invoice-dollar" style="margin-right: 8px;"></i> Financial Ledger</a>
                    <a href="/views/superadmin/superadmin-orgs.html" id="nav-orgs"><i class="fas fa-building" style="margin-right: 8px;"></i> Tenants</a>
                    <a href="/views/superadmin/superadmin-users-list.html" id="nav-users"><i class="fas fa-users" style="margin-right: 8px;"></i> Platform Users</a>
                    <a href="/views/superadmin/superadmin-blog.html" id="nav-blog"><i class="fas fa-blog" style="margin-right: 8px;"></i> Blog Management</a>

                    <a href="#" id="logout-btn" onclick="handleLogout(); return false;" style="margin-top: 20px;"><i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i> Logout</a>
                `;
            } else if (USER_PROFILE.role === 'owner') {
                navHtml = `
                    <a href="/views/admin/admin-dashboard.html" id="nav-dashboard"><i class="fas fa-crown" style="margin-right: 8px;"></i> Admin Dashboard</a>
                    <a href="/views/admin/admin-orders.html" id="nav-orders"><i class="fas fa-folder-open" style="margin-right: 8px;"></i> Global Orders</a>
                    <a href="/views/client/marketplace.html" id="nav-marketplace-browse" target="_blank"><i class="fas fa-shopping-bag" style="margin-right: 8px;"></i> Browse Marketplace</a>
                    
                    <div class="sidebar-dropdown">
                        <button class="dropdown-trigger" id="nav-clients-dropdown" onclick="toggleSidebarDropdown(this)">
                            <span><i class="fas fa-address-book" style="margin-right: 8px;"></i> Clients & Inbox</span>
                            <i class="fas fa-chevron-down dropdown-arrow"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="/views/admin/admin-clients.html" id="nav-clients"><i class="fas fa-users" style="margin-right: 8px;"></i> Client Database</a>
                            <a href="/views/admin/admin-messages.html" id="nav-messages"><i class="fas fa-comments" style="margin-right: 8px;"></i> Messages Inbox</a>
                        </div>
                    </div>

                    <div class="sidebar-dropdown">
                        <button class="dropdown-trigger" onclick="toggleSidebarDropdown(this)">
                            <span><i class="fas fa-boxes-stacked" style="margin-right: 8px;"></i> Products & Stock</span>
                            <i class="fas fa-chevron-down dropdown-arrow"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="/views/admin/admin-inventory.html" id="nav-inventory"><i class="fas fa-box-open" style="margin-right: 8px;"></i> Inventory</a>
                            <a href="/views/admin/admin-listings.html" id="nav-listings"><i class="fas fa-tags" style="margin-right: 8px;"></i> Marketplace Catalog</a>
                        </div>
                    </div>

                    <div class="sidebar-dropdown">
                        <button class="dropdown-trigger" onclick="toggleSidebarDropdown(this)">
                            <span><i class="fas fa-wallet" style="margin-right: 8px;"></i> Finance & Analytics</span>
                            <i class="fas fa-chevron-down dropdown-arrow"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="/views/admin/financial-overview.html" id="nav-finance"><i class="fas fa-chart-line" style="margin-right: 8px;"></i> Financial Overview</a>
                            <a href="/views/admin/admin-analytics.html" id="nav-analytics"><i class="fas fa-chart-bar" style="margin-right: 8px;"></i> BI Analytics & AI</a>
                            <a href="/views/admin/admin-transactions.html" id="nav-transactions"><i class="fas fa-list-ul" style="margin-right: 8px;"></i> Transactions</a>
                            <a href="/views/admin/admin-expenses.html" id="nav-expenses"><i class="fas fa-file-invoice-dollar" style="margin-right: 8px;"></i> Expenses</a>
                        </div>
                    </div>

                    <a href="/views/admin/admin-order-form.html" class="nav-cta" id="nav-new-order"><i class="fas fa-plus" style="margin-right: 8px;"></i> New Global Order</a>
                    <a href="/views/admin/admin-settings.html" id="nav-settings" style="margin-top: 15px;"><i class="fas fa-cog" style="margin-right: 8px;"></i> Settings</a>
                    <a href="#" id="logout-btn" onclick="handleLogout(); return false;"><i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i> Logout</a>
                `;
            } else {
                navHtml = `
                    <div class="sidebar-dropdown">
                        <button class="dropdown-trigger" id="nav-orders-dropdown" onclick="toggleSidebarDropdown(this)">
                            <span><i class="fas fa-folder-open" style="margin-right: 8px;"></i> Orders</span>
                            <i class="fas fa-chevron-down dropdown-arrow"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="/views/manager/manager-dashboard.html" id="nav-dashboard"><i class="fas fa-list-check" style="margin-right: 8px;"></i> Active Orders</a>
                            <a href="/views/manager/all-orders.html" id="nav-all-orders"><i class="fas fa-history" style="margin-right: 8px;"></i> All Orders</a>
                        </div>
                    </div>

                    <div class="sidebar-dropdown">
                        <button class="dropdown-trigger" id="nav-team-dropdown" onclick="toggleSidebarDropdown(this)">
                            <span><i class="fas fa-users" style="margin-right: 8px;"></i> My Team</span>
                            <i class="fas fa-chevron-down dropdown-arrow"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="/views/worker/worker-management.html" id="nav-workers"><i class="fas fa-id-badge" style="margin-right: 8px;"></i> Tailors Directory</a>
                            <a href="/views/worker/worker-assignments.html" id="nav-assignments"><i class="fas fa-tasks" style="margin-right: 8px;"></i> Job Assignments</a>
                        </div>
                    </div>

                    <div class="sidebar-dropdown">
                        <button class="dropdown-trigger" id="nav-clients-dropdown" onclick="toggleSidebarDropdown(this)">
                            <span><i class="fas fa-comments" style="margin-right: 8px;"></i> Clients &amp; Inbox</span>
                            <i class="fas fa-chevron-down dropdown-arrow"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="/views/manager/manager-messages.html" id="nav-messages"><i class="fas fa-envelope" style="margin-right: 8px;"></i> Messages Inbox</a>
                        </div>
                    </div>

                    <div class="sidebar-dropdown">
                        <button class="dropdown-trigger" id="nav-products-dropdown" onclick="toggleSidebarDropdown(this)">
                            <span><i class="fas fa-boxes-stacked" style="margin-right: 8px;"></i> Products &amp; Stock</span>
                            <i class="fas fa-chevron-down dropdown-arrow"></i>
                        </button>
                        <div class="dropdown-content">
                            <a href="/views/manager/manager-inventory.html" id="nav-inventory"><i class="fas fa-box-open" style="margin-right: 8px;"></i> Shop Inventory</a>
                            <a href="/views/manager/manager-listings.html" id="nav-listings"><i class="fas fa-tags" style="margin-right: 8px;"></i> Shop Catalog</a>
                        </div>
                    </div>

                    <a href="/views/manager/expenses.html" id="nav-expenses"><i class="fas fa-file-invoice-dollar" style="margin-right: 8px;"></i> Expenses</a>
                    <a href="/views/client/marketplace.html" id="nav-marketplace-browse" target="_blank"><i class="fas fa-shopping-bag" style="margin-right: 8px;"></i> Browse Marketplace</a>

                    <a href="/views/manager/order-form.html" class="nav-cta" id="nav-new-order"><i class="fas fa-plus" style="margin-right: 8px;"></i> Create Order</a>
                    <a href="#" id="logout-btn" onclick="handleLogout(); return false;"><i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i> Logout</a>
                `;



            }

            navEl.innerHTML = navHtml;

            // Highlight active navigation items
            const pathParts = window.location.pathname.split('/');
            const currentFile = pathParts[pathParts.length - 1] || 'index.html';

            let activeLink = navEl.querySelector(`a[href*="${currentFile}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
                const dropdownContent = activeLink.closest('.dropdown-content');
                if (dropdownContent) {
                    const dropdownContainer = dropdownContent.closest('.sidebar-dropdown');
                    if (dropdownContainer) {
                        dropdownContainer.classList.add('open');
                    }
                }
            } else {
                // Fallbacks for details pages or form creations
                let fallbackId = '';
                if (currentFile.includes('order')) {
                    fallbackId = currentFile.includes('form') ? 'nav-new-order' : 'nav-orders';
                }
                else if (currentFile.includes('client')) fallbackId = 'nav-clients';
                else if (currentFile.includes('inventory') || currentFile.includes('listing')) fallbackId = 'nav-inventory';
                else if (currentFile.includes('finance') || currentFile.includes('analytic') || currentFile.includes('expense') || currentFile.includes('transaction')) fallbackId = 'nav-finance';
                else if (currentFile.includes('message')) fallbackId = 'nav-messages';

                if (fallbackId) {
                    const fallbackLink = navEl.querySelector(`#${fallbackId}`);
                    if (fallbackLink) {
                        fallbackLink.classList.add('active');
                        const dropdownContent = fallbackLink.closest('.dropdown-content');
                        if (dropdownContent) {
                            const dropdownContainer = fallbackLink.closest('.sidebar-dropdown');
                            if (dropdownContainer) {
                                dropdownContainer.classList.add('open');
                            }
                        }
                    }
                }
            }
        }
    } else {
        // While loading the session (USER_PROFILE is not yet defined)
        if (!isSuperadminPage && !forcedName) {
            mainTitle = ""; // Keep logo blank to prevent any visual leaks of other shops
            subTitle = "";  // Keep subtitle blank
        }
    }

    // Update Browser Tab Title
    if (mainTitle) {
        if (document.title.includes('|')) {
            const pageName = document.title.split('|')[0].trim();
            document.title = `${pageName} | ${mainTitle}`;
        } else {
            document.title = `${document.title} | ${mainTitle}`;
        }
    }

    let logoHtml = mainTitle ? mainTitle.toUpperCase() : "&nbsp;";
    


    if (sidebarLogo) sidebarLogo.innerHTML = logoHtml;
    if (sidebarSub) sidebarSub.innerHTML = subTitle ? subTitle.toUpperCase() : "&nbsp;";
}
