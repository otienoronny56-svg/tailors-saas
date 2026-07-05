// ==========================================
// 📦 INVENTORY MANAGEMENT SYSTEM
// ==========================================

let ALL_INVENTORY = [];

async function loadInventoryScreen() {
    logDebug("Loading Inventory Screen...", null, 'info');
    
    try {
        // Load shops for the dropdown
        const { data: shops } = await supabaseClient
            .from('shops')
            .select('id, name')
            .eq('organization_id', USER_PROFILE.organization_id);
        
        const shopSelect = document.getElementById('inv-shop-select');
        const shopFilter = document.getElementById('inv-shop-filter');
        if (shops) {
            if (shopSelect) {
                shopSelect.innerHTML = '<option value="">-- Select Shop --</option>';
                shops.forEach(s => shopSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
                if (shops.length === 1) shopSelect.value = shops[0].id;
            }
            if (shopFilter) {
                shopFilter.innerHTML = '<option value="">All Shops</option>';
                shops.forEach(s => shopFilter.innerHTML += `<option value="${s.id}">${s.name}</option>`);
            }
        }

        // Load inventory items
        const { data: items, error } = await supabaseClient
            .from('inventory_items')
            .select('*')
            .eq('organization_id', USER_PROFILE.organization_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        ALL_INVENTORY = items || [];

        // Build a shop name map
        const shopMap = {};
        if (shops) shops.forEach(s => shopMap[s.id] = s.name);

        await populateSizeChartDropdowns();

        // Update stats
        const totalItems = ALL_INVENTORY.length;
        const inStock = ALL_INVENTORY.filter(i => i.stock_quantity > i.low_stock_threshold).length;
        const lowStock = ALL_INVENTORY.filter(i => i.stock_quantity > 0 && i.stock_quantity <= i.low_stock_threshold).length;
        const totalValue = ALL_INVENTORY.reduce((sum, i) => sum + (i.price * i.stock_quantity), 0);

        const elTotal = document.getElementById('stat-total-items');
        const elInStock = document.getElementById('stat-in-stock');
        const elLowStock = document.getElementById('stat-low-stock');
        const elValue = document.getElementById('stat-total-value');
        
        if (elTotal) elTotal.textContent = totalItems;
        if (elInStock) elInStock.textContent = inStock;
        if (elLowStock) elLowStock.textContent = lowStock;
        if (elValue) elValue.textContent = formatCurrency(totalValue);

        // Render table
        renderInventoryTable(ALL_INVENTORY, shopMap);

        // Setup form handler
        const addForm = document.getElementById('inv-add-form');
        if (addForm) {
            addForm.onsubmit = async (e) => {
                e.preventDefault();
                await addInventoryItem();
            };
        }

    } catch (err) {
        logDebug("Inventory load error:", err, 'error');
        const tbody = document.getElementById('inv-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#ef4444;">Error loading inventory: ${err.message}</td></tr>`;
        }
    }
}

function renderInventoryTable(items, shopMap) {
    const tbody = document.getElementById('inv-table-body');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#94a3b8;">
            <i class="fas fa-box-open" style="font-size:2em; margin-bottom:10px; display:block;"></i>
            No inventory items yet. Add your first item above!
        </td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        let stockClass = 'in-stock';
        let stockLabel = 'In Stock';
        if (item.stock_quantity === 0) {
            stockClass = 'out-of-stock';
            stockLabel = 'Out of Stock';
        } else if (item.stock_quantity <= item.low_stock_threshold) {
            stockClass = 'low-stock';
            stockLabel = 'Low Stock';
        }

        return `<tr data-id="${item.id}" data-name="${item.name.toLowerCase()}" data-category="${item.category}" data-stock="${stockClass}" data-shop="${item.shop_id}">
            <td data-label="Item Name"><strong>${item.name}</strong></td>
            <td data-label="Category"><span class="category-tag">${item.category}</span></td>
            <td data-label="Price">${formatCurrency(item.price)}</td>
            <td data-label="Stock Qty"><strong>${item.stock_quantity}</strong></td>
            <td data-label="Status"><span class="stock-badge ${stockClass}">${stockLabel}</span></td>
            <td data-label="Shop" style="font-size:0.85em; color:#64748b;">${shopMap[item.shop_id] || 'N/A'}</td>
            <td data-label="Actions" class="inv-actions">
                <button class="btn-restock" title="Restock" onclick="openRestockModal('${item.id}', '${item.name.replace(/'/g, "\\'")}')"><i class="fas fa-plus"></i></button>
                <button class="btn-edit" title="Edit" onclick="openEditInventoryItem('${item.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-delete" title="Delete" onclick="deleteInventoryItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

async function addInventoryItem() {
    const name = document.getElementById('inv-name').value.trim();
    const category = document.getElementById('inv-category').value;
    const price = parseFloat(document.getElementById('inv-price').value) || 0;
    const shopId = document.getElementById('inv-shop-select').value;
    const sizeChartId = document.getElementById('inv-size-chart')?.value || null;
    const msgEl = document.getElementById('inv-add-msg');
    
    let qty = parseInt(document.getElementById('inv-qty').value) || 0;
    let sizeQuantities = {};
    if (sizeChartId) {
        const collected = collectSizeQuantities('inv');
        qty = collected.totalStock;
        sizeQuantities = collected.sizeQuantities;
    }

    if (!name || !shopId) {
        if (msgEl) { msgEl.textContent = '❌ Please fill in name and select a shop.'; msgEl.style.color = '#ef4444'; msgEl.style.display = 'block'; }
        return;
    }

    try {
        const { error } = await supabaseClient.from('inventory_items').insert([{
            organization_id: USER_PROFILE.organization_id,
            shop_id: shopId,
            name: name,
            category: category,
            price: price,
            stock_quantity: qty,
            size_chart_id: sizeChartId,
            size_quantities: sizeQuantities
        }]);

        if (error) throw error;

        if (msgEl) { msgEl.textContent = `✅ "${name}" added to inventory!`; msgEl.style.color = '#10b981'; msgEl.style.display = 'block'; }
        
        // Reset form
        document.getElementById('inv-name').value = '';
        document.getElementById('inv-price').value = '';
        document.getElementById('inv-qty').value = '';

        // Reload
        await loadInventoryScreen();

        setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);

    } catch (err) {
        if (msgEl) { msgEl.textContent = '❌ Error: ' + err.message; msgEl.style.color = '#ef4444'; msgEl.style.display = 'block'; }
    }
}

function openEditInventoryItem(itemId) {
    const item = ALL_INVENTORY.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('edit-inv-id').value = item.id;
    document.getElementById('edit-inv-name').value = item.name;
    document.getElementById('edit-inv-category').value = item.category;
    document.getElementById('edit-inv-price').value = item.price;
    document.getElementById('edit-inv-qty').value = item.stock_quantity;
    document.getElementById('edit-inv-threshold').value = item.low_stock_threshold || 5;
    
    const sizeChartEl = document.getElementById('edit-inv-size-chart');
    if (sizeChartEl) {
        sizeChartEl.value = item.size_chart_id || '';
        handleSizeChartChange(item.size_chart_id, 'edit-inv');
        
        if (item.size_chart_id && item.size_quantities) {
            setTimeout(() => {
                const inputs = document.querySelectorAll('.edit-inv-size-input');
                inputs.forEach(input => {
                    const size = input.getAttribute('data-size');
                    if (item.size_quantities[size] !== undefined) {
                        input.value = item.size_quantities[size];
                    }
                });
            }, 50);
        }
    }

    document.getElementById('inv-edit-modal').classList.add('active');
}

async function saveInventoryEdit() {
    const id = document.getElementById('edit-inv-id').value;
    const name = document.getElementById('edit-inv-name').value.trim();
    const category = document.getElementById('edit-inv-category').value;
    const price = parseFloat(document.getElementById('edit-inv-price').value) || 0;
    let qty = parseInt(document.getElementById('edit-inv-qty').value) || 0;
    const threshold = parseInt(document.getElementById('edit-inv-threshold').value) || 5;
    const sizeChartId = document.getElementById('edit-inv-size-chart')?.value || null;
    let sizeQuantities = {};

    if (sizeChartId) {
        const collected = collectSizeQuantities('edit-inv');
        qty = collected.totalStock;
        sizeQuantities = collected.sizeQuantities;
    }

    try {
        const { error } = await supabaseClient.from('inventory_items').update({
            name, category, price, stock_quantity: qty, low_stock_threshold: threshold, size_chart_id: sizeChartId, size_quantities: sizeQuantities, updated_at: new Date().toISOString()
        }).eq('id', id);

        if (error) throw error;

        document.getElementById('inv-edit-modal').classList.remove('active');
        await loadInventoryScreen();
        alert('✅ Item updated successfully!');
    } catch (err) {
        alert('❌ Error updating item: ' + err.message);
    }
}

async function deleteInventoryItem(itemId, itemName) {
    if (!confirm(`Are you sure you want to delete "${itemName}"? This cannot be undone.`)) return;

    try {
        const { error } = await supabaseClient.from('inventory_items').delete().eq('id', itemId);
        if (error) throw error;
        await loadInventoryScreen();
        alert(`✅ "${itemName}" has been deleted.`);
    } catch (err) {
        alert('❌ Error deleting item: ' + err.message);
    }
}

function openRestockModal(itemId, itemName) {
    document.getElementById('restock-inv-id').value = itemId;
    document.getElementById('restock-item-name').textContent = itemName;
    document.getElementById('restock-qty').value = 1;
    document.getElementById('inv-restock-modal').classList.add('active');
}

async function saveRestock() {
    const id = document.getElementById('restock-inv-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value) || 0;
    if (addQty <= 0) { alert('Please enter a valid quantity.'); return; }

    const item = ALL_INVENTORY.find(i => i.id === id);
    if (!item) return;

    try {
        const newQty = item.stock_quantity + addQty;
        const { error } = await supabaseClient.from('inventory_items').update({
            stock_quantity: newQty,
            updated_at: new Date().toISOString()
        }).eq('id', id);

        if (error) throw error;

        document.getElementById('inv-restock-modal').classList.add('active');
        await loadInventoryScreen();
        alert(`✅ Restocked! ${item.name} now has ${newQty} units.`);
    } catch (err) {
        alert('❌ Error restocking: ' + err.message);
    }
}

function filterInventoryTable() {
    const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const catFilter = document.getElementById('inv-cat-filter')?.value;
    const stockFilter = document.getElementById('inv-stock-filter')?.value;
    const shopFilter = document.getElementById('inv-shop-filter')?.value;

    const rows = document.querySelectorAll('#inv-table-body tr[data-id]');
    rows.forEach(row => {
        const name = row.getAttribute('data-name') || '';
        const cat = row.getAttribute('data-category') || '';
        const stock = row.getAttribute('data-stock') || '';
        const shop = row.getAttribute('data-shop') || '';

        let show = true;
        if (search && !name.includes(search)) show = false;
        if (catFilter && cat !== catFilter) show = false;
        if (stockFilter && stock !== stockFilter) show = false;
        if (shopFilter && shop !== shopFilter) show = false;

        row.style.display = show ? '' : 'none';
    });
}

// ==========================================
// 📦 MANAGER INVENTORY (Shop-Scoped)
// ==========================================

let MANAGER_INVENTORY = [];

async function loadManagerInventoryScreen() {
    logDebug("Loading Manager Inventory Screen...", null, 'info');

    const shopId = USER_PROFILE?.shop_id;
    if (!shopId) {
        const tbody = document.getElementById('inv-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#ef4444;">
            No shop assigned to your account. Please contact the admin.</td></tr>`;
        return;
    }

    try {
        // Load items for THIS shop only
        const { data: items, error } = await supabaseClient
            .from('inventory_items')
            .select('*')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        MANAGER_INVENTORY = items || [];
        
        await populateSizeChartDropdowns();

        // Update stat cards
        const totalItems = MANAGER_INVENTORY.length;
        const inStock = MANAGER_INVENTORY.filter(i => i.stock_quantity > i.low_stock_threshold).length;
        const lowStock = MANAGER_INVENTORY.filter(i => i.stock_quantity > 0 && i.stock_quantity <= i.low_stock_threshold).length;
        const totalValue = MANAGER_INVENTORY.reduce((sum, i) => sum + (i.price * i.stock_quantity), 0);

        const elTotal = document.getElementById('stat-total-items');
        const elInStock = document.getElementById('stat-in-stock');
        const elLowStock = document.getElementById('stat-low-stock');
        const elValue = document.getElementById('stat-total-value');

        if (elTotal) elTotal.textContent = totalItems;
        if (elInStock) elInStock.textContent = inStock;
        if (elLowStock) elLowStock.textContent = lowStock;
        if (elValue) elValue.textContent = formatCurrency(totalValue);

        // Render manager table (no delete, no shop column)
        renderManagerInventoryTable(MANAGER_INVENTORY);

        // Setup add form
        const addForm = document.getElementById('inv-add-form');
        if (addForm) {
            addForm.onsubmit = async (e) => {
                e.preventDefault();
                await addManagerInventoryItem();
            };
        }

        // Setup search/filter
        const searchEl = document.getElementById('inv-search');
        if (searchEl) searchEl.oninput = filterManagerInventoryTable;
        const catEl = document.getElementById('inv-cat-filter');
        if (catEl) catEl.onchange = filterManagerInventoryTable;
        const stockEl = document.getElementById('inv-stock-filter');
        if (stockEl) stockEl.onchange = filterManagerInventoryTable;

    } catch (err) {
        logDebug("Manager inventory load error:", err, 'error');
        const tbody = document.getElementById('inv-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#ef4444;">
            Error loading inventory: ${err.message}</td></tr>`;
    }
}

function renderManagerInventoryTable(items) {
    const tbody = document.getElementById('inv-table-body');
    if (!tbody) return;

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8;">
            <i class="fas fa-box-open" style="font-size:2em;margin-bottom:10px;display:block;"></i>
            No inventory items yet. Add your first item above!</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        let stockClass = 'in-stock', stockLabel = 'In Stock';
        if (item.stock_quantity === 0) { stockClass = 'out-of-stock'; stockLabel = 'Out of Stock'; }
        else if (item.stock_quantity <= item.low_stock_threshold) { stockClass = 'low-stock'; stockLabel = 'Low Stock'; }

        return `<tr data-id="${item.id}" data-name="${item.name.toLowerCase()}" data-category="${item.category}" data-stock="${stockClass}">
            <td><strong>${item.name}</strong></td>
            <td><span class="category-tag">${item.category}</span></td>
            <td>${formatCurrency(item.price)}</td>
            <td><strong>${item.stock_quantity}</strong></td>
            <td><span class="stock-badge ${stockClass}">${stockLabel}</span></td>
            <td class="inv-actions">
                <button class="btn-restock" title="Restock" onclick="openManagerRestockModal('${item.id}', '${item.name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="btn-edit" title="Edit" onclick="openManagerEditItem('${item.id}')">
                    <i class="fas fa-pen"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

async function addManagerInventoryItem() {
    const name = document.getElementById('inv-name').value.trim();
    const category = document.getElementById('inv-category').value;
    const price = parseFloat(document.getElementById('inv-price').value) || 0;
    const sizeChartId = document.getElementById('inv-size-chart')?.value || null;
    const msgEl = document.getElementById('inv-add-msg');
    const shopId = USER_PROFILE?.shop_id;

    let qty = parseInt(document.getElementById('inv-qty').value) || 0;
    let sizeQuantities = {};
    if (sizeChartId) {
        const collected = collectSizeQuantities('inv');
        qty = collected.totalStock;
        sizeQuantities = collected.sizeQuantities;
    }

    if (!name || !shopId) {
        if (msgEl) { msgEl.textContent = '❌ Please fill in the item name.'; msgEl.style.color = '#ef4444'; msgEl.style.display = 'block'; }
        return;
    }

    try {
        const { error } = await supabaseClient.from('inventory_items').insert([{
            organization_id: USER_PROFILE.organization_id,
            shop_id: shopId,
            name, category, price, stock_quantity: qty, size_chart_id: sizeChartId, size_quantities: sizeQuantities
        }]);

        if (error) throw error;

        if (msgEl) { msgEl.textContent = `✅ "${name}" added to inventory!`; msgEl.style.color = '#10b981'; msgEl.style.display = 'block'; }
        document.getElementById('inv-name').value = '';
        document.getElementById('inv-price').value = '';
        document.getElementById('inv-qty').value = '';

        await loadManagerInventoryScreen();
        setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);

    } catch (err) {
        if (msgEl) { msgEl.textContent = '❌ Error: ' + err.message; msgEl.style.color = '#ef4444'; msgEl.style.display = 'block'; }
    }
}

function openManagerEditItem(itemId) {
    const item = MANAGER_INVENTORY.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('edit-inv-id').value = item.id;
    document.getElementById('edit-inv-name').value = item.name;
    document.getElementById('edit-inv-category').value = item.category;
    document.getElementById('edit-inv-price').value = item.price;
    document.getElementById('edit-inv-qty').value = item.stock_quantity;
    document.getElementById('edit-inv-threshold').value = item.low_stock_threshold || 5;

    const sizeChartEl = document.getElementById('edit-inv-size-chart');
    if (sizeChartEl) {
        sizeChartEl.value = item.size_chart_id || '';
        handleSizeChartChange(item.size_chart_id, 'edit-inv');
        
        if (item.size_chart_id && item.size_quantities) {
            setTimeout(() => {
                const inputs = document.querySelectorAll('.edit-inv-size-input');
                inputs.forEach(input => {
                    const size = input.getAttribute('data-size');
                    if (item.size_quantities[size] !== undefined) {
                        input.value = item.size_quantities[size];
                    }
                });
            }, 50);
        }
    }

    document.getElementById('inv-edit-modal').classList.add('active');
}

async function saveManagerInventoryEdit() {
    const id = document.getElementById('edit-inv-id').value;
    const name = document.getElementById('edit-inv-name').value.trim();
    const category = document.getElementById('edit-inv-category').value;
    const price = parseFloat(document.getElementById('edit-inv-price').value) || 0;
    let qty = parseInt(document.getElementById('edit-inv-qty').value) || 0;
    const threshold = parseInt(document.getElementById('edit-inv-threshold').value) || 5;
    const sizeChartId = document.getElementById('edit-inv-size-chart')?.value || null;
    let sizeQuantities = {};

    if (sizeChartId) {
        const collected = collectSizeQuantities('edit-inv');
        qty = collected.totalStock;
        sizeQuantities = collected.sizeQuantities;
    }

    try {
        const { error } = await supabaseClient.from('inventory_items').update({
            name, category, price, stock_quantity: qty, low_stock_threshold: threshold, size_chart_id: sizeChartId, size_quantities: sizeQuantities,
            updated_at: new Date().toISOString()
        }).eq('id', id);

        if (error) throw error;
        document.getElementById('inv-edit-modal').classList.remove('active');
        await loadManagerInventoryScreen();
        alert('✅ Item updated successfully!');
    } catch (err) {
        alert('❌ Error updating item: ' + err.message);
    }
}

function openManagerRestockModal(itemId, itemName) {
    document.getElementById('restock-inv-id').value = itemId;
    document.getElementById('restock-item-name').textContent = itemName;
    document.getElementById('restock-qty').value = 1;
    document.getElementById('inv-restock-modal').classList.add('active');
}

async function saveManagerRestock() {
    const id = document.getElementById('restock-inv-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value) || 0;
    if (addQty <= 0) { alert('Please enter a valid quantity.'); return; }

    const item = MANAGER_INVENTORY.find(i => i.id === id);
    if (!item) return;

    try {
        const newQty = item.stock_quantity + addQty;
        const { error } = await supabaseClient.from('inventory_items').update({
            stock_quantity: newQty, updated_at: new Date().toISOString()
        }).eq('id', id);

        if (error) throw error;
        document.getElementById('inv-restock-modal').classList.remove('active');
        await loadManagerInventoryScreen();
        alert(`✅ Restocked! ${item.name} now has ${newQty} units.`);
    } catch (err) {
        alert('❌ Error restocking: ' + err.message);
    }
}

function filterManagerInventoryTable() {
    const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const catFilter = document.getElementById('inv-cat-filter')?.value || '';
    const stockFilter = document.getElementById('inv-stock-filter')?.value || '';

    const rows = document.querySelectorAll('#inv-table-body tr[data-id]');
    rows.forEach(row => {
        const name = row.getAttribute('data-name') || '';
        const cat = row.getAttribute('data-category') || '';
        const stock = row.getAttribute('data-stock') || '';
        let show = true;
        if (search && !name.includes(search)) show = false;
        if (catFilter && cat !== catFilter) show = false;
        if (stockFilter && stock !== stockFilter) show = false;
        row.style.display = show ? '' : 'none';
    });
}

// Helper to populate Size Chart dropdowns
window.AVAILABLE_SIZE_CHARTS = [];

async function populateSizeChartDropdowns() {
    try {
        const { data: sizeCharts, error } = await supabaseClient
            .from('size_charts')
            .select('id, name, size_data, target_gender')
            .or(`organization_id.is.null,organization_id.eq.${USER_PROFILE.organization_id}`);
            
        if (error) throw error;
        
        window.AVAILABLE_SIZE_CHARTS = sizeCharts || [];
        
        const sizeChartSelect = document.getElementById('inv-size-chart');
        const editSizeChartSelect = document.getElementById('edit-inv-size-chart');
        const genderSelect = document.getElementById('inv-gender');
        const editGenderSelect = document.getElementById('edit-inv-gender');
        
        if (sizeCharts) {
            renderFilteredSizeCharts('inv');
            renderFilteredSizeCharts('edit-inv');
            
            if (sizeChartSelect) {
                sizeChartSelect.addEventListener('change', () => handleSizeChartChange(sizeChartSelect.value, 'inv'));
            }
            if (editSizeChartSelect) {
                editSizeChartSelect.addEventListener('change', () => handleSizeChartChange(editSizeChartSelect.value, 'edit-inv'));
            }
            if (genderSelect) {
                genderSelect.addEventListener('change', () => renderFilteredSizeCharts('inv'));
            }
            if (editGenderSelect) {
                editGenderSelect.addEventListener('change', () => renderFilteredSizeCharts('edit-inv'));
            }
        }
    } catch (err) {
        console.error("Error loading size charts:", err);
    }
}

function renderFilteredSizeCharts(prefix) {
    const selectEl = document.getElementById(`${prefix}-size-chart`);
    const genderEl = document.getElementById(`${prefix}-gender`);
    if (!selectEl) return;
    
    const selectedGender = genderEl ? genderEl.value : '';
    
    let filteredCharts = window.AVAILABLE_SIZE_CHARTS;
    if (selectedGender) {
        filteredCharts = window.AVAILABLE_SIZE_CHARTS.filter(c => c.target_gender === selectedGender || c.target_gender === 'Unisex' || !c.target_gender);
    }
    
    const currentValue = selectEl.value;
    
    selectEl.innerHTML = '<option value="">None (One Size / Custom)</option>' + 
        filteredCharts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
    // try to restore previous value if it still exists in the filtered list
    if (filteredCharts.find(c => c.id === currentValue)) {
        selectEl.value = currentValue;
    } else {
        selectEl.value = '';
        handleSizeChartChange('', prefix);
    }
}

function handleSizeChartChange(chartId, prefix) {
    const qtyContainer = document.getElementById(`${prefix}-size-qty-container`);
    const qtyGrid = document.getElementById(`${prefix}-size-qty-grid`);
    const standardQtyDiv = document.getElementById(`${prefix}-standard-qty-div`);
    const standardQtyInput = document.getElementById(`${prefix}-qty`);
    
    if (!chartId) {
        // No size chart selected -> show standard quantity
        if (qtyContainer) qtyContainer.style.display = 'none';
        if (standardQtyDiv) standardQtyDiv.style.display = 'block';
        if (qtyGrid) qtyGrid.innerHTML = '';
        return;
    }
    
    // Size chart selected -> hide standard quantity, show size inputs
    const chart = window.AVAILABLE_SIZE_CHARTS.find(c => c.id === chartId);
    if (!chart || !chart.size_data) return;
    
    const sizes = Object.keys(chart.size_data);
    
    if (sizes.length === 0) {
        if (qtyContainer) qtyContainer.style.display = 'none';
        if (standardQtyDiv) standardQtyDiv.style.display = 'block';
        return;
    }
    
    if (qtyContainer) qtyContainer.style.display = 'block';
    if (standardQtyDiv) standardQtyDiv.style.display = 'none';
    
    // We store the values on standardQtyInput but set it to 0 and read from grid
    if (standardQtyInput) standardQtyInput.value = 0;
    
    if (qtyGrid) {
        qtyGrid.innerHTML = sizes.map(size => `
            <div style="flex: 0 0 auto; width: 60px;">
                <label style="font-size: 0.8em; color: #64748b;">${size}</label>
                <input type="number" class="${prefix}-size-input" data-size="${size}" value="0" min="0" style="padding: 6px; width: 100%; box-sizing: border-box;">
            </div>
        `).join('');
    }
}

function collectSizeQuantities(prefix) {
    const inputs = document.querySelectorAll(`.${prefix}-size-input`);
    const sizeQuantities = {};
    let totalStock = 0;
    
    inputs.forEach(input => {
        const size = input.getAttribute('data-size');
        const qty = parseInt(input.value) || 0;
        sizeQuantities[size] = qty;
        totalStock += qty;
    });
    
    return { sizeQuantities, totalStock };
}


