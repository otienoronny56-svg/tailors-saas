// ==========================================
// ðŸ” AUTHENTICATION SYSTEM
// ==========================================

async function checkSession() {
    logDebug("Checking session...", null, 'info');

    try {
        const path = window.location.pathname;
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        const user = session?.user;
        if (sessionError || !user) {
            const isPublicPage = window.location.pathname.includes('index.html') || window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/');
            if (!isPublicPage && window.location.pathname !== '/') {
                window.location.replace('/index.html');
            }
            return;
        }

        // [PERF & OFFLINE] Try to load profile from sessionStorage or localStorage first for instant navigation & offline support
        const cachedProfileData = sessionStorage.getItem('USER_PROFILE_' + user.id) || localStorage.getItem('USER_PROFILE_' + user.id);
        if (cachedProfileData) {
            try {
                const tempProfile = JSON.parse(cachedProfileData);
                if (tempProfile && tempProfile.id === user.id && (!navigator.onLine || tempProfile.status !== 'Pending')) {
                    USER_PROFILE = tempProfile;
                    window.USER_PROFILE = tempProfile;
                    logDebug("Loaded user profile from cache for user: " + user.id, null, 'info');
                    
                    if (USER_PROFILE.business_type) {
                        document.body.className = document.body.className.replace(/\bbusiness-type-\S+/g, '');
                        document.body.classList.add('business-type-' + USER_PROFILE.business_type);
                    }
                }
            } catch(e) {}
        }

        if (!USER_PROFILE) {
            let profile = null;
            let profileError = null;

            try {
                const res = await supabaseClient
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                profile = res.data;
                profileError = res.error;
            } catch (e) {
                profileError = e;
            }

            if (profileError || !profile) {
                let workerProfile = null;
                try {
                    const wRes = await supabaseClient
                        .from('workers')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    workerProfile = wRes.data;
                } catch (e) {}

                if (!workerProfile) {
                    if (!navigator.onLine && cachedProfileData) {
                        try {
                            USER_PROFILE = JSON.parse(cachedProfileData);
                            window.USER_PROFILE = USER_PROFILE;
                        } catch(e) {}
                    }

                    if (!USER_PROFILE) {
                        if (path.includes('tailor-onboarding')) {
                            logDebug("No profile yet — user is completing onboarding. Allowing.", null, 'info');
                            return;
                        }
                        if (navigator.onLine) {
                            logDebug("Profile not found. Redirecting to choose-role.html...", null, 'info');
                            window.location.replace('/choose-role.html');
                            return;
                        }
                    }
                } else {
                    USER_PROFILE = {
                        ...workerProfile,
                        full_name: workerProfile.name,
                        role: 'manager'
                    };
                }
            } else {
                USER_PROFILE = profile;
            }

            if (USER_PROFILE) {
                window.USER_PROFILE = USER_PROFILE;
                if (USER_PROFILE.shop_id && navigator.onLine) {
                    try {
                        const { data: shopData } = await window.supabaseClient.from('shops').select('business_type').eq('id', USER_PROFILE.shop_id).single();
                        if (shopData && shopData.business_type) {
                            USER_PROFILE.business_type = shopData.business_type;
                            document.body.className = document.body.className.replace(/\bbusiness-type-\S+/g, '');
                            document.body.classList.add('business-type-' + shopData.business_type);
                        }
                    } catch (e) {
                        console.warn("Failed to fetch shop business_type", e);
                    }
                } else if (USER_PROFILE.business_type) {
                     document.body.className = document.body.className.replace(/\bbusiness-type-\S+/g, '');
                     document.body.classList.add('business-type-' + USER_PROFILE.business_type);
                }
                
                sessionStorage.setItem('USER_PROFILE_' + user.id, JSON.stringify(USER_PROFILE));
                localStorage.setItem('USER_PROFILE_' + user.id, JSON.stringify(USER_PROFILE));
                localStorage.setItem('USER_PROFILE', JSON.stringify(USER_PROFILE));
            }
        } // End of if (!USER_PROFILE)

        // 🚀 14-DAY FREE TRIAL & SUBSCRIPTION LOCK SYSTEM (Applies ONLY to tailors registered from today onwards)
        if (USER_PROFILE.role === 'owner' || USER_PROFILE.role === 'manager') {
            const CUTOFF_DATE = new Date('2026-07-25T00:00:00Z');
            const createdDate = USER_PROFILE.created_at ? new Date(USER_PROFILE.created_at) : new Date(0);
            const isExistingUser = createdDate < CUTOFF_DATE;

            const isPaid = isExistingUser || 
                           USER_PROFILE.subscription_status === 'Active' || 
                           USER_PROFILE.subscription_tier === 'Paid' || 
                           USER_PROFILE.subscription_tier === 'Pro' || 
                           USER_PROFILE.subscription_tier === 'Starter';

            const daysElapsed = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            const trialDaysRemaining = isExistingUser ? 14 : Math.max(0, 14 - daysElapsed);
                           
            window.TRIAL_INFO = {
                daysRemaining: trialDaysRemaining,
                isTrialActive: !isExistingUser && trialDaysRemaining > 0,
                isExpired: !isExistingUser && trialDaysRemaining <= 0 && !isPaid,
                isPaid: isPaid
            };

            // 🛑 LOCK DASHBOARD IF TRIAL EXPIRED & NOT PAID
            if (trialDaysRemaining <= 0 && !isPaid && USER_PROFILE.role !== 'superadmin') {
                document.body.innerHTML = `
                    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #060c18; font-family: 'Plus Jakarta Sans', sans-serif; color: white; padding: 20px;">
                        <div style="background: rgba(17, 34, 64, 0.9); border: 1px solid rgba(212, 175, 55, 0.3); padding: 40px 30px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); max-width: 520px; width: 100%; text-align: center; backdrop-filter: blur(15px);">
                            <div style="width: 70px; height: 70px; background: rgba(212, 175, 55, 0.15); border: 2px solid #D4AF37; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 30px; color: #D4AF37;">
                                <i class="fas fa-lock"></i>
                            </div>
                            <h1 style="color: #D4AF37; margin-bottom: 10px; font-family: 'Playfair Display', serif; font-size: 1.8em;">Your 14-Day Free Trial Has Ended</h1>
                            <p style="color: #a8b2d1; font-size: 0.95em; line-height: 1.6; margin-bottom: 25px;">
                                Your free trial period for <strong>${USER_PROFILE.full_name || 'your shop'}</strong> is complete. Select a plan below to unlock your shop dashboard, client inquiries, and order tracking.
                            </p>

                            <!-- Plan Selection Cards -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px; text-align: left;">
                                <div id="plan-starter" onclick="selectTrialPlan('Starter', 1500)" style="background: rgba(255,255,255,0.04); border: 2px solid #D4AF37; padding: 15px; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                                    <div style="font-weight: 700; font-size: 0.9em; color: #D4AF37;">Starter Tailor</div>
                                    <div style="font-size: 1.2em; font-weight: 800; color: white; margin: 4px 0;">Ksh 1,500 <span style="font-size: 0.6em; color: #8892b0;">/mo</span></div>
                                    <div style="font-size: 0.75em; color: #8892b0;">Up to 25 orders/mo, custom measurements, marketplace listing</div>
                                </div>
                                <div id="plan-pro" onclick="selectTrialPlan('Pro', 3500)" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                                    <div style="font-weight: 700; font-size: 0.9em; color: white;">Pro Fashion House</div>
                                    <div style="font-size: 1.2em; font-weight: 800; color: white; margin: 4px 0;">Ksh 3,500 <span style="font-size: 0.6em; color: #8892b0;">/mo</span></div>
                                    <div style="font-size: 0.75em; color: #8892b0;">Unlimited orders, multi-worker tools, priority support</div>
                                </div>
                            </div>

                            <!-- M-Pesa Payment Block -->
                            <div style="background: rgba(6, 12, 24, 0.7); border: 1px solid rgba(212, 175, 55, 0.2); padding: 18px; border-radius: 12px; margin-bottom: 20px; text-align: left;">
                                <label style="font-size: 0.8em; font-weight: 700; color: #D4AF37; display: block; margin-bottom: 8px; text-transform: uppercase;">M-Pesa Phone Number for Payment</label>
                                <div style="display: flex; gap: 8px;">
                                    <input type="tel" id="trial-mpesa-phone" placeholder="e.g. 0712345678 or 2547..." style="flex: 1; background: #0b132b; border: 1px solid rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; color: white; font-size: 0.95em;">
                                    <button onclick="processTrialMpesaPayment()" id="trial-pay-btn" style="background: #22c55e; color: white; border: none; padding: 12px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 0.9em; white-space: nowrap;">
                                        <i class="fas fa-mobile-screen"></i> Pay Ksh <span id="selected-plan-amount">1500</span>
                                    </button>
                                </div>
                                <div id="trial-pay-status" style="font-size: 0.8em; color: #38bdf8; margin-top: 8px; display: none;"></div>
                            </div>

                            <button onclick="supabaseClient.auth.signOut().then(() => { sessionStorage.clear(); location.href='/index.html'; })" style="background: transparent; color: #8892b0; border: none; font-size: 0.85em; cursor: pointer; text-decoration: underline;">Logout & Return Home</button>
                        </div>
                    </div>
                `;
                
                // Helper functions attached to window for lock modal interaction
                window.selectedPlanTier = 'Starter';
                window.selectedPlanPrice = 1500;
                window.selectTrialPlan = function(tier, price) {
                    window.selectedPlanTier = tier;
                    window.selectedPlanPrice = price;
                    document.getElementById('selected-plan-amount').textContent = price.toLocaleString();
                    document.getElementById('plan-starter').style.border = tier === 'Starter' ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)';
                    document.getElementById('plan-pro').style.border = tier === 'Pro' ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)';
                };

                window.processTrialMpesaPayment = async function() {
                    const phoneInput = document.getElementById('trial-mpesa-phone');
                    const statusEl = document.getElementById('trial-pay-status');
                    const payBtn = document.getElementById('trial-pay-btn');
                    let phone = phoneInput.value.trim();
                    if (!phone) { alert("Please enter your M-Pesa phone number."); return; }
                    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
                    if (phone.startsWith('+')) phone = phone.substring(1);

                    statusEl.style.display = 'block';
                    statusEl.style.color = '#38bdf8';
                    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending M-Pesa STK Push prompt to ' + phone + '...';
                    payBtn.disabled = true;

                    try {
                        const { data: { session } } = await supabaseClient.auth.getSession();
                        const token = session?.access_token;
                        const res = await fetch(`${APP_CONFIG.supabaseUrl}/functions/v1/mpesa-stk-push`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ phone, amount: window.selectedPlanPrice, accountReference: 'Sub_' + USER_PROFILE.id.substring(0,6) })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'STK Push failed');
                        
                        statusEl.style.color = '#22c55e';
                        statusEl.innerHTML = '✅ M-Pesa prompt sent! Enter your PIN on your phone. Activating subscription...';
                        
                        // 1. Permanently update user_profiles table in Supabase
                        await supabaseClient.from('user_profiles').update({ 
                            status: 'Active', 
                            subscription_status: 'Active', 
                            subscription_tier: window.selectedPlanTier 
                        }).eq('id', USER_PROFILE.id);

                        // 2. Permanently update organizations table if linked
                        if (USER_PROFILE.organization_id) {
                            await supabaseClient.from('organizations').update({ 
                                subscription_status: 'Active', 
                                subscription_tier: window.selectedPlanTier 
                            }).eq('id', USER_PROFILE.organization_id);
                        }

                        // 3. Clear session storage cache to prevent stale cache readings
                        sessionStorage.removeItem('USER_PROFILE_' + USER_PROFILE.id);
                        if (USER_PROFILE.organization_id) {
                            sessionStorage.removeItem('ORG_STATUS_' + USER_PROFILE.organization_id);
                        }
                        
                        // 4. Reload page after 3.5s — dashboard unlocks permanently!
                        setTimeout(() => { location.reload(); }, 3500);
                    } catch (err) {
                        statusEl.style.color = '#ef4444';
                        statusEl.innerHTML = '❌ Payment Prompt Error: ' + err.message;
                        payBtn.disabled = false;
                    }
                };

                return;
            }

            // 🌟 INJECT TRIAL / SUBSCRIPTION EXPIRATION BANNER
            // Show if:
            // 1. Free Trial is active (new user within 14 days) OR
            // 2. Subscription/Trial is within 5 days of expiration (daysRemaining <= 5)
            const daysRemaining = trialDaysRemaining;
            const isUrgent = daysRemaining <= 5;
            const showBanner = (trialDaysRemaining > 0 && !isPaid) || (isUrgent && daysRemaining > 0);
            
            if (showBanner && (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/manager/'))) {
                const injectBanner = () => {
                    if (document.getElementById('trial-banner')) return;
                    const banner = document.createElement('div');
                    banner.id = 'trial-banner';
                    
                    const bgStyle = isUrgent 
                        ? 'background: linear-gradient(90deg, #f59e0b 0%, #ef4444 100%); color: #ffffff;' 
                        : 'background: linear-gradient(90deg, #D4AF37 0%, #f3cd57 100%); color: #030712;';

                    const messageText = isUrgent
                        ? `⚠️ <strong>Subscription Expiring Soon</strong> &mdash; Only <strong>${daysRemaining} day(s) remaining</strong> before dashboard lock.`
                        : `🎉 <strong>14-Day Free Trial Active</strong> &mdash; <strong>${trialDaysRemaining} day(s) remaining</strong> on your free trial.`;

                    const btnText = isUrgent ? 'Renew / Pay Plan Now &rarr;' : 'Unlock Unlimited Plan &rarr;';
                    const btnStyle = isUrgent
                        ? 'background: #ffffff; color: #dc2626; padding: 4px 12px; border-radius: 6px; text-decoration: none; font-size: 0.82em; font-weight: 800;'
                        : 'background: #030712; color: #D4AF37; padding: 4px 12px; border-radius: 6px; text-decoration: none; font-size: 0.82em; font-weight: 800;';

                    banner.style.cssText = `position: fixed; top: 0; left: 0; right: 0; width: 100%; height: 38px; ${bgStyle} padding: 0 20px; font-size: 0.85em; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 999999;`;
                    banner.innerHTML = `
                        <span>${messageText}</span>
                        <a href="/pricing.html" style="${btnStyle}">${btnText}</a>
                    `;
                    document.body.appendChild(banner);
                    
                    // Adjust body or header layout so top content is not obscured
                    const mainHeader = document.getElementById('main-header') || document.querySelector('header');
                    if (mainHeader) {
                        mainHeader.style.marginTop = '38px';
                    } else {
                        const appContainer = document.querySelector('.app-container') || document.querySelector('.dashboard-container') || document.body;
                        if (appContainer) appContainer.style.marginTop = '38px';
                    }
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', injectBanner);
                } else {
                    injectBanner();
                }
            }
        }

        // 🛑 NEW: Check for suspension (Enforcement)
        if (USER_PROFILE.status === 'Suspended') {
            document.body.innerHTML = `
                <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-family: 'Inter', sans-serif;">
                    <div style="text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); max-width: 450px;">
                        <div style="font-size: 50px; color: #ef4444; margin-bottom: 20px;"><i class="fas fa-lock"></i></div>
                        <h1 style="color: #1e293b; margin-bottom: 15px;">Account Suspended</h1>
                        <p style="color: #64748b; line-height: 1.6; margin-bottom: 25px;">
                            Your access to the platform has been temporarily paused. This could be due to billing issues or a policy violation.
                        </p>
                        <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                            <strong style="color: #334155;">Need help?</strong><br>
                            <a href="mailto:support@otima.com" style="color: var(--brand-navy); font-weight: 700;">support@otima.com</a>
                        </div>
                        <button onclick="supabaseClient.auth.signOut().then(() => location.href='/index.html')" class="small-btn" style="width: 100%; background: #ef4444; color: white;">Logout</button>
                    </div>
                </div>
            `;
            return;
        }

        // 🛑 NEW: Check for organization suspension (Enforcement)
        if (USER_PROFILE.organization_id && USER_PROFILE.role !== 'superadmin') {
            const cachedOrgStatus = sessionStorage.getItem('ORG_STATUS_' + USER_PROFILE.organization_id);
            let isOrgSuspended = cachedOrgStatus === 'Suspended';
            
            if (!cachedOrgStatus) {
                const { data: org, error: orgError } = await supabaseClient
                    .from('organizations')
                    .select('subscription_status')
                    .eq('id', USER_PROFILE.organization_id)
                    .single();
                if (!orgError && org) {
                    sessionStorage.setItem('ORG_STATUS_' + USER_PROFILE.organization_id, org.subscription_status);
                    isOrgSuspended = org.subscription_status === 'Suspended';
                }
            }

            if (isOrgSuspended) {
                document.body.innerHTML = `
                    <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #060c18; font-family: 'Montserrat', sans-serif; color: white;">
                        <div style="text-align: center; background: rgba(17, 34, 64, 0.75); border: 1px solid rgba(212, 175, 55, 0.15); padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 450px;">
                            <div style="font-size: 50px; color: #ef4444; margin-bottom: 20px;"><i class="fas fa-exclamation-triangle"></i></div>
                            <h1 style="color: var(--brand-gold); margin-bottom: 15px; font-family: 'Playfair Display', serif;">Workspace Suspended</h1>
                            <p style="color: var(--brand-slate); line-height: 1.6; margin-bottom: 25px;">
                                Your organization has been suspended. Please contact platform administration to reactivate your workspace.
                            </p>
                            <button onclick="supabaseClient.auth.signOut().then(() => { sessionStorage.clear(); location.href='/index.html'; })" class="small-btn" style="width: 100%; background: #ef4444; color: white; border: none; font-weight: bold; cursor: pointer;">Logout</button>
                        </div>
                    </div>
                `;
                return;
            }
        }

        // 🛑 NEW: Check for shop suspension (Enforcement)
        if (USER_PROFILE.shop_id && USER_PROFILE.role !== 'superadmin') {
            const cachedShopStatus = sessionStorage.getItem('SHOP_STATUS_' + USER_PROFILE.shop_id);
            let isShopSuspended = cachedShopStatus === 'Suspended';
            
            if (!cachedShopStatus) {
                const { data: shop, error: shopError } = await supabaseClient
                    .from('shops')
                    .select('status')
                    .eq('id', USER_PROFILE.shop_id)
                    .single();
                if (!shopError && shop) {
                    sessionStorage.setItem('SHOP_STATUS_' + USER_PROFILE.shop_id, shop.status || 'Active');
                    isShopSuspended = shop.status === 'Suspended';
                }
            }

            if (isShopSuspended) {
                document.body.innerHTML = `
                    <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #060c18; font-family: 'Montserrat', sans-serif; color: white;">
                        <div style="text-align: center; background: rgba(17, 34, 64, 0.75); border: 1px solid rgba(212, 175, 55, 0.15); padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 450px;">
                            <div style="font-size: 50px; color: #ef4444; margin-bottom: 20px;"><i class="fas fa-store-alt-slash"></i></div>
                            <h1 style="color: var(--brand-gold); margin-bottom: 15px; font-family: 'Playfair Display', serif;">Shop Suspended</h1>
                            <p style="color: var(--brand-slate); line-height: 1.6; margin-bottom: 25px;">
                                Your specific shop has been suspended by administration. Please contact support.
                            </p>
                            <button onclick="supabaseClient.auth.signOut().then(() => { sessionStorage.clear(); location.href='/index.html'; })" class="small-btn" style="width: 100%; background: #ef4444; color: white; border: none; font-weight: bold; cursor: pointer;">Logout</button>
                        </div>
                    </div>
                `;
                return;
            }
        }

        logDebug(`User authenticated: ${USER_PROFILE.full_name} (${USER_PROFILE.role})`, USER_PROFILE, 'success');

        // Update UI
        const userInfoEl = document.getElementById('user-info');
        if (userInfoEl) {
            userInfoEl.innerHTML = `<i class="fas fa-user-circle" style="margin-right: 8px; color: var(--brand-gold);"></i> Welcome, ${USER_PROFILE.full_name}`;
        }

        // [FIX] Check for 'index.html', 'login.html', OR if the path is just '/' (root)
        // Also skip redirect logic entirely if we are on the tailor-onboarding page
        if (path.includes('tailor-onboarding')) {
            // On the onboarding page: if a COMPLETED profile already exists, redirect to their dashboard.
            // If status is Pending or incomplete, stay here and let them complete the form.
            if (USER_PROFILE && USER_PROFILE.status !== 'Pending' && USER_PROFILE.organization_id) {
                let redirectTo = '/views/admin/admin-dashboard.html';
                if (USER_PROFILE.role === 'client') redirectTo = '/views/client/client-dashboard.html';
                window.location.replace(redirectTo);
            }
            return; // Always stop here â€” let the onboarding page handle itself
        }

        if (path.includes('index.html') || path.includes('login.html') || path === '/' || path.endsWith('/')) {
            let redirectTo = '/views/manager/manager-dashboard.html';
            if (USER_PROFILE.role === 'superadmin') redirectTo = '/views/superadmin/superadmin-dashboard.html';
            else if (USER_PROFILE.role === 'owner') redirectTo = '/views/admin/admin-dashboard.html';
            else if (USER_PROFILE.role === 'client') redirectTo = '/views/client/client-dashboard.html';
            
            // Allow redirect via URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const redirectParam = urlParams.get('redirect');
            if (redirectParam) {
                // Ensure redirect is to our domain, not external malicious site
                if (redirectParam.startsWith('/views/') || redirectParam.startsWith('/index.html')) {
                    redirectTo = redirectParam;
                }
            }
            
            window.location.replace(redirectTo);
            return;
        }

        // Route based on role and page
        await routeToPage(path);
        
        // Update user activity status (Heartbeat)
        if (USER_PROFILE) {
            updateLastSeen();
        }

        // Final UI Updates
        updateSidebarBranding();
        
        // Start unread messages polling
        if (typeof checkUnreadMessages === 'function') {
            checkUnreadMessages();
            if (!window._inboxPollInterval) {
                window._inboxPollInterval = setInterval(checkUnreadMessages, 60000); // Check every minute
            }
        }
        
        // Start GLOBAL Realtime Notification Listener
        setupGlobalNotificationListener();

    } catch (error) {
        logDebug("Session check error:", error, 'error');
        alert("Session error: " + error.message);
    }
}

let _globalNotificationListener = null;
function setupGlobalNotificationListener() {
    if (!USER_PROFILE || _globalNotificationListener) return;

    if (!("Notification" in window)) return;

    // Only set up for roles that use messages
    if (USER_PROFILE.role !== 'owner' && USER_PROFILE.role !== 'client' && USER_PROFILE.role !== 'superadmin' && USER_PROFILE.role !== 'manager') return;

    // Build filter if needed (clients only care about messages to them)
    let filterString = '';
    if (USER_PROFILE.role === 'client') {
        filterString = `recipient_id=eq.${USER_PROFILE.id}`;
    }

    _globalNotificationListener = window.supabaseClient
        .channel('global-notifications-' + USER_PROFILE.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            ...(filterString ? { filter: filterString } : {})
        }, payload => {
            const newMsg = payload.new;
            
            // Ignore messages sent by ourselves
            if (newMsg.sender_id === USER_PROFILE.id) return;
            
            // For admins/managers, make sure the message is relevant
            if (USER_PROFILE.role !== 'client') {
                // To avoid spam, ensure it's not a message from another admin in the same org
                if (newMsg.sender_id === USER_PROFILE.organization_id) return;
            }

            // Immediately update the UI red dots anywhere in the app!
            if (typeof checkUnreadMessages === 'function') {
                checkUnreadMessages();
            }

            // Show OS Notification if page is hidden
            if (document.hidden && Notification.permission === 'granted') {
                const title = USER_PROFILE.role === 'client' ? "New Tailor Message" : "New Client Inquiry";
                const body = newMsg.message_text ? newMsg.message_text.substring(0, 50) + "..." : "You have a new message.";
                
                try {
                    const notif = new Notification(title + " - Tailors", {
                        body: body,
                        icon: '/assets/icon-192x192.png'
                    });
                    notif.onclick = function() {
                        window.focus();
                                              // If not on messages page, redirect them
                        if (!window.location.pathname.includes('messages') && !window.location.pathname.includes('client-dashboard')) {
                            const msgLink = document.getElementById('nav-messages');
                            if (msgLink) msgLink.click();
                        }
                    };
                } catch(e) {
                    console.warn("Failed to show notification:", e);
                }
            }
        })
        .subscribe();
}r = null;
function setupGlobalNotificationListener() {
    if (!USER_PROFILE || _globalNotificationListener) return;

    if (!("Notification" in window)) return;

    // Only set up for roles that use messages
    if (USER_PROFILE.role !== 'owner' && USER_PROFILE.role !== 'client' && USER_PROFILE.role !== 'superadmin' && USER_PROFILE.role !== 'manager') return;

    // Build filter if needed (clients only care about messages to them)
    let filterString = '';
    if (USER_PROFILE.role === 'client') {
        filterString = `recipient_id=eq.${USER_PROFILE.id}`;
    }

    _globalNotificationListener = window.supabaseClient
        .channel('global-notifications-' + USER_PROFILE.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            ...(filterString ? { filter: filterString } : {})
        }, payload => {
            const newMsg = payload.new;
            
            // Ignore messages sent by ourselves
            if (newMsg.sender_id === USER_PROFILE.id) return;
            
            // For admins/managers, make sure the message is relevant
            if (USER_PROFILE.role !== 'client') {
                // To avoid spam, ensure it's not a message from another admin in the same org
                if (newMsg.sender_id === USER_PROFILE.organization_id) return;
            }

            // Immediately update the UI red dots anywhere in the app!
            if (typeof checkUnreadMessages === 'function') {
                checkUnreadMessages();
            }

            // Show OS Notification if page is hidden
            if (document.hidden && Notification.permission === 'granted') {
                const title = USER_PROFILE.role === 'client' ? "New Tailor Message" : "New Client Inquiry";
                const body = newMsg.message_text ? newMsg.message_text.substring(0, 50) + "..." : "You have a new message.";
                
                try {
                    const notif = new Notification(title + " - Tailors", {
                        body: body,
                        icon: '/assets/icon-192x192.png'
                    });
                    notif.onclick = function() {
                        window.focus();
                        this.close();
                        
                        // If not on messages page, redirect them
                        if (!window.location.pathname.includes('messages') && !window.location.pathname.includes('client-dashboard')) {
                            const msgLink = document.getElementById('nav-messages');
                            if (msgLink) msgLink.click();
                        }
                    };
                } catch(e) {
                    console.warn("Failed to show notification:", e);
                }
            }
        })
        .subscribe();
}

async function routeToPage(path) {
    if (!USER_PROFILE) return;

    // Superadmin pages
    if (USER_PROFILE.role === 'superadmin') {
        if (path.includes('superadmin-dashboard')) {
            await loadSuperadminDashboard();
        } else if (path.includes('superadmin-orgs')) {
            await loadOrganizations();
            if (typeof loadPendingApprovals === 'function') await loadPendingApprovals();
            if (typeof loadAdminAccountScreen === 'function') await loadAdminAccountScreen();
        } else if (path.includes('superadmin-users-list')) {
            await loadPlatformUsers();
        } else if (path.includes('superadmin-users')) {
            await loadAdminAccountScreen();
        } else if (path.includes('superadmin-blog')) {
            if (typeof fetchBlogs === 'function') await fetchBlogs();
        }
        return;
    }

    // Owner pages
    if (USER_PROFILE.role === 'owner') {
        if (path.includes('manager') || path.includes('superadmin') || path.includes('client-dashboard')) {
            window.location.replace('/views/admin/admin-dashboard.html');
            return;
        }

        if (path.includes('admin-dashboard')) {
            await loadAdminDashboard();
        } else if (path.includes('financial-overview')) {
            await loadAnalyticsDashboard();
        } else if (path.includes('admin-current-orders')) {
            await loadAdminOrders('current');
        } else if (path.includes('admin-orders') && !path.includes('admin-order-details') && !path.includes('admin-order-form')) {
            await loadAdminOrders('current');
        } else if (path.includes('admin-all-orders')) {
            await loadAdminOrders('all');
        } else if (path.includes('admin-expenses')) {
            await loadAdminExpensesScreen();
        } else if (path.includes('admin-inventory')) {
            await loadInventoryScreen();
        } else if (path.includes('admin-clients')) {
            loadClients();
        } else if (path.includes('admin-management')) {
            await loadAdminManagementScreen();
        } else if (path.includes('admin-order-details')) {
            await loadAdminOrderDetails();
        } else if (path.includes('admin-order-form')) {
            initAdminOrderForm();
        } else if (path.includes('admin-analytics')) {
            loadBIAnalytics();
        } else if (path.includes('admin-settings')) {
            if (typeof initSettingsPage === 'function') await initSettingsPage();
        }
    }
    // Manager pages
    else if (USER_PROFILE.role === 'manager') {
        if (path.includes('admin-') || path.includes('client-dashboard')) {
            window.location.replace('/views/manager/manager-dashboard.html');
            return;
        }

        if (path.includes('manager-dashboard')) {
            await loadOrders('open');
            await loadWorkerFilterDropdown();
            addRefreshButton();
        } else if (path.includes('all-orders')) {
            await loadOrders('all');
            await loadWorkerFilterDropdown();
            addRefreshButton();
        } else if (path.includes('worker-management')) {
            await loadWorkerScreen();
        } else if (path.includes('worker-assignments')) {
            await loadWorkerAssignments();
        } else if (path.includes('manager-inventory')) {
            await loadManagerInventoryScreen();
        } else if (path.includes('manager-listings')) {
            await loadManagerListingsScreen();
        } else if (path.includes('manager-messages')) {
            // Page handles its own init
        } else if (path.includes('order-form')) {
            initOrderForm();
        } else if (path.includes('expenses')) {
            loadExpensesScreen();
        } else if (path.includes('order-details')) {
            await loadOrderDetailsScreen();
        }
    }
    // Client pages
    else if (USER_PROFILE.role === 'client') {
        if (path.includes('admin-') || path.includes('manager-')) {
            window.location.replace('/views/client/client-dashboard.html');
            return;
        }
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();

    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const loginBtn = document.getElementById('login-button');

    if (!email || !password) {
        alert("Please enter email and password");
        return;
    }

    // 1. UI Feedback
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';
    }

    try {
        // 2. Perform Auth
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        logDebug("Login successful, checking session profile...", null, 'success');

        // 3. Perform Session & Redirect Logic
        await checkSession();

    } catch (error) {
        logDebug("Login process error:", error, 'error');

        const msgEl = document.getElementById('auth-message');
        if (msgEl) {
            msgEl.textContent = "❌ Error: " + error.message;
            msgEl.style.display = "block";
            msgEl.style.color = "#ff4444";
        }

        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    } finally {
        setTimeout(() => {
            if (loginBtn && loginBtn.disabled) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
        }, 5000);
    }
}

async function handleLogout() {
    try {
        if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
            await supabaseClient.auth.signOut();
        }
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        USER_PROFILE = null;
        window.USER_PROFILE = null;
        sessionStorage.clear();
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('USER_PROFILE')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {}
        window.location.replace('/login.html');
    }
}
