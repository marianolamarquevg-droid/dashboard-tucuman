// Initialize Lucide icons
lucide.createIcons();

// State
let rawGlobalData = [];
let globalData = [];
let currentView = 'dashboard';
let lockedComercial = null;

// IndexedDB Persistence
const DB_NAME = 'SalesDB_Tucuman_v1';
const STORE_NAME = 'salesStore';

function saveToDB(data) {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
    };
    request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id: 1, data: data });
    };
}

function updateMonthFilter() {
    let allMonthsSet = new Set(rawGlobalData.map(d => d.mes));
    const monthSelect = document.getElementById('monthFilter');
    monthSelect.innerHTML = '<option value="ALL">Todos los Meses</option>';
    monthSelect.innerHTML += '<option value="LAST_2">Últimos 2 Meses</option>';
    monthSelect.innerHTML += '<option value="LAST_3">Últimos 3 Meses</option>';
    monthSelect.innerHTML += '<option value="LAST_6">Últimos 6 Meses</option>';
    Array.from(allMonthsSet).sort().forEach(m => {
        monthSelect.innerHTML += `<option value="${m}">${m}</option>`;
    });
    monthSelect.classList.remove('hidden');
}

function updateVendedorFilter() {
    let allVendedoresSet = new Set(rawGlobalData.map(d => d.comercial));
    const vendedorSelect = document.getElementById('vendedorFilter');
    const comercialSelector = document.getElementById('comercialSelector');
    
    let options = '<option value="ALL">Todos los Vendedores</option>';
    let selectorOptions = '<option value="">Selecciona un Vendedor...</option>';
    
    Array.from(allVendedoresSet).sort().forEach(v => {
        options += `<option value="${v}">${v}</option>`;
        selectorOptions += `<option value="${v}">${v}</option>`;
    });
    
    vendedorSelect.innerHTML = options;
    comercialSelector.innerHTML = selectorOptions;
    vendedorSelect.classList.remove('hidden');
}

function loadFromDB() {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
    };
    request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) return;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(1);
        getReq.onsuccess = () => {
            if (getReq.result && getReq.result.data && getReq.result.data.length > 0) {
                rawGlobalData = getReq.result.data;
                
                if (lockedComercial) {
                    rawGlobalData = rawGlobalData.filter(r => r.comercial && r.comercial.includes(lockedComercial));
                }
                
                globalData = [...rawGlobalData];
                updateMonthFilter();
                updateVendedorFilter();
                dataStatus.textContent = `Datos Cargados (${globalData.length} filas)`;
                dataStatus.className = 'status-badge loaded';
                document.getElementById('btnClearData').classList.remove('hidden');
                document.getElementById('btnExportRemote').classList.remove('hidden');
                uploadOverlay.classList.add('hidden');
                views[currentView].classList.remove('hidden');
                renderDashboard();
            }
        };
    };
}

document.addEventListener('DOMContentLoaded', () => {
    checkLockedComercial();
    loadFromDB();
    checkRemoteData();
    const btnClear = document.getElementById('btnClearData');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if(confirm('¿Estás seguro de que deseas borrar todos los datos cargados?')) {
                rawGlobalData = [];
                globalData = [];
                const request = indexedDB.open(DB_NAME, 1);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    store.clear();
                };
                document.getElementById('monthFilter').classList.add('hidden');
                document.getElementById('vendedorFilter').classList.add('hidden');
                btnClear.classList.add('hidden');
                dataStatus.textContent = 'Esperando datos...';
                dataStatus.className = 'status-badge empty';
                uploadOverlay.classList.remove('hidden');
                document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
                document.querySelector(`[data-view="dashboard"]`).classList.add('active');
                Object.values(views).forEach(v => v.classList.add('hidden'));
            }
        });
    }

    const btnExport = document.getElementById('btnExportRemote');
    if (btnExport) {
        btnExport.addEventListener('click', exportDataForMobile);
    }
    
    document.getElementById('monthFilter').addEventListener('change', applyFilters);
    document.getElementById('comercialSelector').addEventListener('change', renderComercialView);
    const btnExportMix = document.getElementById('btnExportMix');
    if (btnExportMix) btnExportMix.addEventListener('click', exportMixToExcel);
});

function applyFilters() {
    const vFilter = document.getElementById('vendedorFilter').value;
    const mFilter = document.getElementById('monthFilter').value;
    
    globalData = rawGlobalData.filter(row => {
        let matchV = (vFilter === 'ALL' || row.comercial === vFilter);
        let matchM = true;
        
        if (mFilter !== 'ALL') {
            if (mFilter.startsWith('LAST_')) {
                const count = parseInt(mFilter.split('_')[1]);
                const allMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort().slice(-count);
                matchM = allMonths.includes(row.mes);
            } else {
                matchM = (row.mes === mFilter);
            }
        }
        
        return matchV && matchM;
    });
    
    renderDashboard();
    
    // Refresh the specific analysis view if active
    if (currentView === 'comercial') {
        renderComercialView();
    }
    if (currentView === 'mix') {
        renderMixView();
    }
}

const REMOTE_DATA_URL = './data.json';

async function checkRemoteData() {
    try {
        const response = await fetch(REMOTE_DATA_URL + '?t=' + new Date().getTime());
        if (response.ok) {
            const remoteData = await response.json();
            if (remoteData && remoteData.length > 0) {
                rawGlobalData = remoteData;
                
                if (lockedComercial) {
                    rawGlobalData = rawGlobalData.filter(r => r.comercial && r.comercial.includes(lockedComercial));
                }
                
                globalData = [...rawGlobalData];
                updateMonthFilter();
                updateVendedorFilter();
                dataStatus.textContent = `Datos Sincronizados (${globalData.length} filas)`;
                dataStatus.className = 'status-badge loaded';
                uploadOverlay.classList.add('hidden');
                document.getElementById('btnClearData').classList.remove('hidden');
                document.getElementById('btnExportRemote').classList.remove('hidden');
                views[currentView].classList.remove('hidden');
                renderDashboard();
                saveToDB(rawGlobalData);
            }
        }
    } catch (err) {
        console.log('No hay datos remotos:', err);
    }
}

function exportDataForMobile() {
    if (rawGlobalData.length === 0) return;
    const dataStr = JSON.stringify(rawGlobalData);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('Archivo data.json descargado. Súbelo a GitHub.');
}

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadOverlay = document.getElementById('uploadOverlay');
const uploadBox = document.querySelector('.upload-box');
const dataStatus = document.getElementById('data-status');
const views = {
    dashboard: document.getElementById('dashboardView'),
    'client-search': document.getElementById('clientSearchView'),
    comercial: document.getElementById('comercialView'),
    mix: document.getElementById('mixView')
};

// Nav links
document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        switchView(view);
    });
});

function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    Object.values(views).forEach(v => v.classList.add('hidden'));
    
    if (rawGlobalData.length > 0) {
        uploadOverlay.classList.add('hidden');
        views[viewName].classList.remove('hidden');
        if (viewName === 'mix') renderMixView();
        if (viewName === 'comercial') renderComercialView();
    } else {
        uploadOverlay.classList.remove('hidden');
    }
}

// Excel Processing
uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('dragover'); });
uploadBox.addEventListener('dragleave', () => { uploadBox.classList.remove('dragover'); });
uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', function() { handleFiles(this.files); });

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        dataStatus.textContent = 'Procesando...';
        const reader = new FileReader();
        reader.onload = (e) => processExcel(new Uint8Array(e.target.result));
        reader.readAsArrayBuffer(file);
    }
}

function normalizeHeader(header) {
    if (!header) return '';
    return header.toString().toLowerCase().trim()
        .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
        .replace(/[^a-z0-9 ]/g, ''); // Remove symbols like º, ., -, etc.
}

function normalizeName(name) {
    if (!name) return '';
    return name.toString().toLowerCase()
        .replace(/,/g, '')
        .replace(/\s+/g, ' ')
        .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
        .trim();
}

function findCol(headers, possibleNames, excludeKeywords = []) {
    // 1. Try exact match first
    for (let i = 0; i < headers.length; i++) {
        const h = normalizeHeader(headers[i]);
        if (possibleNames.includes(h)) return i;
    }
    // 2. Try partial match with exclusions
    for (let i = 0; i < headers.length; i++) {
        const h = normalizeHeader(headers[i]);
        const hasExcluded = excludeKeywords.some(ex => h.includes(ex));
        if (hasExcluded) continue;

        for (let name of possibleNames) {
            if (h.includes(name)) return i;
        }
    }
    return -1;
}

function processExcel(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length < 2) throw new Error("Archivo vacío");

        const headers = jsonData[0];
        
        // Dynamic detection
        // IDs: Prioritize "Cod" but avoid "Vendedor"
        const colId = findCol(headers, ['cod cliente', 'id cliente', 'codigo cliente', 'codigo cli', 'nro cliente', 'nro. cliente', 'cod cli', 'id cli'], ['vendedor', 'comercial', 'prod']);
        // Names: Prioritize "Razon Social" or "Nombre"
        const colCliente = findCol(headers, ['razon social', 'nombre cliente', 'cliente', 'nombre'], ['vendedor', 'comercial', 'prod', 'cod', 'id']);
        // Product: Prioritize "Descripcion"
        const colProd = findCol(headers, ['descripcion', 'nombre producto', 'producto', 'desc.', 'descrip', 'articulo'], ['cod', 'id', 'cliente', 'vendedor']);
        
        // Prioritize name columns and avoid ID/Code columns for the salesperson name
        let colComercial = findCol(headers, ['nombre vendedor', 'nombre comercial', 'vendedor nombre'], ['cod', 'id']);
        if (colComercial === -1) {
            // If no explicit "name" column, search for "vendedor" but try to avoid "cod" or "id"
            for (let i = 0; i < headers.length; i++) {
                const h = normalizeHeader(headers[i]);
                if ((h.includes('vendedor') || h.includes('comercial')) && !h.includes('cod') && !h.includes('id')) {
                    colComercial = i;
                    break;
                }
            }
        }
        // Fallback to any match if still not found
        if (colComercial === -1) colComercial = findCol(headers, ['vendedor', 'comercial']);

        const colCant = findCol(headers, ['cantidad', 'cant']);
        const colFact = findCol(headers, ['facturacion', 'monto', 'total', 'importe', 'sin iva']);
        const colFecha = findCol(headers, ['fecha', 'emision', 'mes']);
        const colFactura = findCol(headers, ['nro comprobante', 'nro factura', 'numero factura', 'numero comprobante', 'boleta', 'factura', 'comprobante', 'nro comp', 'nro fac', 'nro boleta', 'comprobante nro', 'nro de factura', 'nro de boleta', 'nro de comprobante', 'nro', 'numero']);

        let validData = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            let comercial = colComercial >= 0 ? String(row[colComercial] || 'Sin Asignar').trim() : 'Sin Asignar';
            if (comercial === 'Sin Asignar') continue; // Opcional: ignorar filas sin vendedor

            let fechaRaw = row[colFecha];
            let mes = 'Desconocido';
            if (fechaRaw) {
                if (typeof fechaRaw === 'number') {
                    const d = new Date((fechaRaw - (25567 + 2)) * 86400 * 1000);
                    mes = d.toISOString().substring(0, 7);
                } else {
                    mes = String(fechaRaw).substring(0, 7);
                }
            }

            validData.push({
                comercial: comercial,
                id_cliente: colId >= 0 ? String(row[colId]) : 'S/ID',
                cliente: colCliente >= 0 ? String(row[colCliente]) : 'Cliente Desconocido',
                producto: colProd >= 0 ? String(row[colProd]) : 'Producto Gral',
                cantidad: colCant >= 0 ? parseFloat(row[colCant]) || 0 : 0,
                facturacion: colFact >= 0 ? parseFloat(row[colFact]) || 0 : 0,
                mes: mes,
                factura: colFactura >= 0 ? String(row[colFactura]) : 'S/F',
                fecha_raw: fechaRaw || 'S/F'
            });
        }

        rawGlobalData = validData;
        
        if (lockedComercial) {
            rawGlobalData = rawGlobalData.filter(r => r.comercial && r.comercial.includes(lockedComercial));
        }
        
        globalData = [...rawGlobalData];
        saveToDB(rawGlobalData);
        updateMonthFilter();
        updateVendedorFilter();
        dataStatus.textContent = `Datos Cargados (${globalData.length} filas)`;
        dataStatus.className = 'status-badge loaded';
        document.getElementById('btnClearData').classList.remove('hidden');
        document.getElementById('btnExportRemote').classList.remove('hidden');
        uploadOverlay.classList.add('hidden');
        views[currentView].classList.remove('hidden');
        renderDashboard();
    } catch (e) {
        console.error(e);
        alert("Error al procesar el Excel.");
    }
}

// Rendering
const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('es-AR').format(val);

let clientHistoryChartInst = null;
let monthlyRevenueChartInst = null;
let comercialRevenueChartInst = null;

function renderDashboard() {
    let totalRevenue = 0;
    let totalItems = 0;
    let clients = new Set();
    let comercialStats = {};
    let clientStats = {};
    let prodStats = {};

    globalData.forEach(row => {
        totalRevenue += row.facturacion;
        totalItems += row.cantidad;
        // Use name as fallback for unique clients count if ID is missing or generic
        let clientKey = (row.id_cliente && row.id_cliente !== 'S/ID') ? row.id_cliente : row.cliente;
        clients.add(clientKey);
        comercialStats[row.comercial] = (comercialStats[row.comercial] || 0) + row.facturacion;
        clientStats[row.cliente] = (clientStats[row.cliente] || 0) + row.facturacion;
        prodStats[row.producto] = (prodStats[row.producto] || 0) + row.cantidad;
    });

    document.getElementById('kpiTotalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('kpiTotalClients').textContent = formatNumber(clients.size);
    document.getElementById('kpiTotalItems').textContent = formatNumber(totalItems);
    
    let topComercial = Object.entries(comercialStats).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('kpiTopComercial').textContent = topComercial ? topComercial[0] : '-';
    let topClient = Object.entries(clientStats).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('kpiTopClient').textContent = topClient ? topClient[0] : '-';
    let topProduct = Object.entries(prodStats).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('kpiTopProduct').textContent = topProduct ? topProduct[0] : '-';

    // Tables
    const tb = document.querySelector('#mainDetailTable tbody');
    tb.innerHTML = '';
    let groupedData = {};
    let comercialClientStats = {};
    
    globalData.forEach(row => {
        let key = row.id_cliente + '|' + row.producto;
        if (!groupedData[key]) {
            groupedData[key] = { id: row.id_cliente, cliente: row.cliente, comercial: row.comercial, producto: row.producto, cantidad: 0, total: 0 };
        }
        groupedData[key].cantidad += row.cantidad;
        groupedData[key].total += row.facturacion;

        if (!comercialClientStats[row.comercial]) comercialClientStats[row.comercial] = {};
        comercialClientStats[row.comercial][row.cliente] = (comercialClientStats[row.comercial][row.cliente] || 0) + row.facturacion;
    });

    Object.values(groupedData).sort((a,b) => b.total - a.total).slice(0, 100).forEach(item => {
        const tr = document.createElement('tr');
        // Show Name instead of ID in the first column as requested
        tr.innerHTML = `<td><span class="badge" style="background:rgba(16, 185, 129, 0.1); color:var(--success); border:none;">${item.cliente}</span></td><td>${item.id}</td><td>${item.comercial}</td><td>${item.producto}</td><td>${formatNumber(item.cantidad)}</td><td style="color:var(--success)">${formatCurrency(item.total)}</td>`;
        tb.appendChild(tr);
    });

    const tbComClients = document.querySelector('#topClientsComercialTable tbody');
    tbComClients.innerHTML = '';
    Object.keys(comercialClientStats).forEach(com => {
        Object.entries(comercialClientStats[com]).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(cl => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${com}</td><td>${cl[0]}</td><td style="color:var(--primary)">${formatCurrency(cl[1])}</td>`;
            tbComClients.appendChild(tr);
        });
    });

    // Charts
    renderCharts(comercialStats);
    renderProductTrend();
    lucide.createIcons();
}

function renderCharts(comercialStats) {
    let revByMonth = {};
    rawGlobalData.forEach(r => { revByMonth[r.mes] = (revByMonth[r.mes] || 0) + r.facturacion; });
    let months = Object.keys(revByMonth).sort();
    
    if (monthlyRevenueChartInst) monthlyRevenueChartInst.destroy();
    monthlyRevenueChartInst = new Chart(document.getElementById('monthlyRevenueChart'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [{ label: 'Facturación', data: months.map(m => revByMonth[m]), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    if (comercialRevenueChartInst) comercialRevenueChartInst.destroy();
    comercialRevenueChartInst = new Chart(document.getElementById('comercialRevenueChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(comercialStats),
            datasets: [{ data: Object.values(comercialStats), backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '70%' }
    });
}

function renderProductTrend() {
    const tbProd = document.querySelector('#productsTrendTable tbody');
    tbProd.innerHTML = '';
    let allMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    let currentM = allMonths[allMonths.length - 1];
    let prevM = allMonths[allMonths.length - 2];
    
    let stats = {};
    rawGlobalData.forEach(r => {
        if (!stats[r.producto]) stats[r.producto] = { current: 0, prev: 0 };
        if (r.mes === currentM) stats[r.producto].current += r.cantidad;
        if (r.mes === prevM) stats[r.producto].prev += r.cantidad;
    });

    Object.entries(stats).sort((a,b) => b[1].current - a[1].current).slice(0, 50).forEach(([p, s]) => {
        let trend = '-';
        if (s.prev > 0) {
            let diff = ((s.current - s.prev) / s.prev) * 100;
            trend = diff > 0 ? `<span style="color:var(--success)">+${diff.toFixed(1)}%</span>` : `<span style="color:var(--danger)">${diff.toFixed(1)}%</span>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><button class="btn-detail" onclick="showProductEvolutionDetail('${p.replace(/'/g, "\\'")}')"><i data-lucide="eye"></i></button></td><td>${p}</td><td>${formatNumber(s.current)}</td><td>${trend}</td>`;
        tbProd.appendChild(tr);
    });
}

function showProductEvolutionDetail(productName) {
    const modal = document.getElementById('productDropModal');
    const title = document.getElementById('modalProductTitle');
    const tbody = document.querySelector('#productDropTable tbody');
    
    title.textContent = `Evolución: ${productName}`;
    tbody.innerHTML = '';
    
    let allMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    let currentM = allMonths[allMonths.length - 1];
    let prevM = allMonths[allMonths.length - 2];
    
    let clientStats = {};
    rawGlobalData.forEach(r => {
        if (r.producto === productName) {
            if (!clientStats[r.cliente]) clientStats[r.cliente] = { current: 0, prev: 0 };
            if (r.mes === currentM) clientStats[r.cliente].current += r.cantidad;
            if (r.mes === prevM) clientStats[r.cliente].prev += r.cantidad;
        }
    });
    
    Object.entries(clientStats)
        .filter(([name, s]) => s.current !== s.prev || (s.current > 0 && s.prev === 0))
        .sort((a, b) => (b[1].current - b[1].prev) - (a[1].current - a[1].prev))
        .forEach(([name, s]) => {
            const diff = s.current - s.prev;
            let diffPct = '';
            if (s.prev > 0) {
                diffPct = ` (${((diff / s.prev) * 100).toFixed(1)}%)`;
            } else if (s.current > 0) {
                diffPct = ' (Nuevo)';
            }
            
            const tr = document.createElement('tr');
            const diffColor = diff > 0 ? 'var(--success)' : 'var(--danger)';
            tr.innerHTML = `
                <td>${name}</td>
                <td>${formatNumber(s.prev)}</td>
                <td>${formatNumber(s.current)}</td>
                <td style="color:${diffColor}; font-weight:600;">${diff > 0 ? '+' : ''}${formatNumber(diff)}${diffPct}</td>
            `;
            tbody.appendChild(tr);
        });
    
    modal.classList.remove('hidden');
    lucide.createIcons();
}

window.showProductEvolutionDetail = showProductEvolutionDetail;

// Search
document.getElementById('clientSearchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const sug = document.getElementById('searchSuggestions');
    if (term.length < 2) { sug.classList.add('hidden'); return; }
    
    const clients = new Map();
    rawGlobalData.forEach(r => {
        if (r.cliente.toLowerCase().includes(term) || r.id_cliente.toLowerCase().includes(term)) clients.set(r.id_cliente, r.cliente);
    });
    
    sug.innerHTML = '';
    Array.from(clients.entries()).slice(0, 10).forEach(([id, name]) => {
        const d = document.createElement('div'); d.className = 'suggestion-item';
        d.innerHTML = `<span class="client-id">${id}</span><span>${name}</span>`;
        d.onclick = () => { document.getElementById('clientSearchInput').value = name; sug.classList.add('hidden'); searchClient(); };
        sug.appendChild(d);
    });
    sug.classList.toggle('hidden', sug.innerHTML === '');
});

function searchClient() {
    const term = document.getElementById('clientSearchInput').value.toLowerCase().trim();
    const rows = rawGlobalData.filter(r => r.id_cliente.toLowerCase().includes(term) || r.cliente.toLowerCase().includes(term));
    if (rows.length === 0) return;

    document.getElementById('clientEmptyState').classList.add('hidden');
    document.getElementById('clientDetails').classList.remove('hidden');
    
    const info = rows[0];
    document.getElementById('cdName').textContent = info.cliente;
    document.getElementById('cdId').textContent = info.id_cliente;
    document.getElementById('cdComercial').innerHTML = `<i data-lucide="briefcase"></i> ${info.comercial}`;
    
    let total = 0, months = {}, prods = {}, invoices = new Set();
    rows.forEach(r => {
        total += r.facturacion;
        months[r.mes] = (months[r.mes] || 0) + r.facturacion;
        prods[r.producto] = (prods[r.producto] || 0) + r.cantidad;
        invoices.add(r.factura !== 'S/F' ? r.factura : r.fecha_raw);
    });
    
    document.getElementById('cdTotal').textContent = formatCurrency(total);
    document.getElementById('cdAverageTicket').textContent = formatCurrency(invoices.size > 0 ? total / invoices.size : 0);
    document.getElementById('cdInvoicesCount').textContent = `(${invoices.size} boletas detected)`;
    document.getElementById('cdMixProductos').textContent = Object.keys(prods).length;

    if (clientHistoryChartInst) clientHistoryChartInst.destroy();
    clientHistoryChartInst = new Chart(document.getElementById('clientHistoryChart'), {
        type: 'bar',
        data: { labels: Object.keys(months).sort(), datasets: [{ label: 'Compras', data: Object.keys(months).sort().map(m => months[m]), backgroundColor: '#8b5cf6' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Extract last 6 months globally
    let allGlobalMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    let last6Months = allGlobalMonths.slice(-6);

    // Update table header
    const thd = document.getElementById('clientProductsTableHead');
    let thHtml = '<tr><th>Producto</th>';
    last6Months.forEach(m => {
        thHtml += `<th>${m}</th>`;
    });
    thHtml += '<th>Total 6 Meses</th></tr>';
    thd.innerHTML = thHtml;

    // Products table
    const tb = document.querySelector('#clientProductsTable tbody');
    tb.innerHTML = '';
    
    Object.keys(prods).sort((a,b) => prods[b] - prods[a]).forEach(p => {
        const tr = document.createElement('tr');
        
        let total6m = 0;
        let lastMonthInRecord = last6Months[last6Months.length - 1];
        let pData = rows.filter(r => r.producto === p);
        let pByMonth = {};
        pData.forEach(r => pByMonth[r.mes] = (pByMonth[r.mes] || 0) + r.cantidad);

        let boughtInLastMonth = (pByMonth[lastMonthInRecord] || 0) > 0;
        let boughtBefore = false;

        let cellsHtml = '';
        last6Months.forEach(m => {
            let q = pByMonth[m] || 0;
            total6m += q;
            if (m !== lastMonthInRecord && q > 0) boughtBefore = true;
            if (q === 0) {
                 cellsHtml += `<td style="color: var(--text-muted); opacity: 0.5;">-</td>`;
            } else {
                 cellsHtml += `<td>${formatNumber(q)}</td>`;
            }
        });

        let alertHtml = '';
        if (boughtBefore && !boughtInLastMonth) {
            alertHtml = ` <span title="Dejó de comprar este producto en el último mes" class="badge" style="background:rgba(245, 158, 11, 0.2); color:var(--warning); padding: 0.1rem 0.3rem;"><i data-lucide="alert-triangle" style="width:14px;height:14px;display:inline;vertical-align:middle"></i></span>`;
        }

        tr.innerHTML = `<td style="font-weight: 500;">${p}${alertHtml}</td>${cellsHtml}<td style="font-weight:600; color:var(--primary)">${formatNumber(total6m)}</td>`;
        tb.appendChild(tr);
    });
    
    lucide.createIcons();
}

function renderComercialView() {
    const com = document.getElementById('comercialSelector').value;
    const tb = document.querySelector('#comercialClientsTable tbody');
    tb.innerHTML = '';
    if (!com) return;
    
    // Determine the "Current Month" based on global filter
    const globalMonthFilter = document.getElementById('monthFilter').value;
    let allGlobalMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    
    let currentM = globalMonthFilter !== 'ALL' && !globalMonthFilter.startsWith('LAST_') 
                   ? globalMonthFilter 
                   : allGlobalMonths[allGlobalMonths.length - 1];
    
    // Find previous month
    let prevM = '';
    const currentIndex = allGlobalMonths.indexOf(currentM);
    if (currentIndex > 0) prevM = allGlobalMonths[currentIndex - 1];

    // Update headers in the table
    const thead = document.querySelector('#comercialClientsTable thead tr');
    if (thead) {
        thead.innerHTML = `
            <th>Ranking</th>
            <th>Cliente</th>
            <th>${currentM}</th>
            <th>${prevM || 'Mes Ant.'}</th>
            <th>Tendencia</th>
            <th>Estado</th>
        `;
    }
    
    let stats = {};
    const normalizedCom = normalizeName(com);
    
    // 1. Identify clients currently assigned to this salesperson in the selected month
    const currentClientsOfCom = new Set();
    rawGlobalData.forEach(r => {
        if (r.mes === currentM && normalizeName(r.comercial) === normalizedCom) {
            currentClientsOfCom.add((r.id_cliente && r.id_cliente !== 'S/ID') ? r.id_cliente : r.cliente);
        }
    });
    
    // 2. Aggregate stats: show history for these clients regardless of who their salesperson was before
    rawGlobalData.forEach(r => {
        let key = (r.id_cliente && r.id_cliente !== 'S/ID') ? r.id_cliente : r.cliente;
        const isTargetCom = normalizeName(r.comercial) === normalizedCom;
        
        // Include if it's the right salesperson OR if it's a current client of that salesperson
        if (isTargetCom || currentClientsOfCom.has(key)) {
            if (!stats[key]) stats[key] = { name: r.cliente, current: 0, prev: 0 };
            
            if (r.mes === currentM && isTargetCom) {
                stats[key].current += r.facturacion;
            }
            if (r.mes === prevM) {
                stats[key].prev += r.facturacion;
            }
        }
    });

    Object.entries(stats).filter(([k, s]) => s.current > 0 || s.prev > 0).sort((a,b) => b[1].current - a[1].current).forEach(([key, s], i) => {
        let trend = '-';
        let trendVal = 0;
        if (s.prev > 0) {
            trendVal = ((s.current - s.prev) / s.prev) * 100;
            trend = trendVal > 0 ? `<span style="color:var(--success)">+${trendVal.toFixed(1)}%</span>` : `<span style="color:var(--danger)">${trendVal.toFixed(1)}%</span>`;
        } else if (s.current > 0) {
            trend = `<span style="color:var(--success)">Nuevo</span>`;
        }

        let status = 'Activo';
        let statusStyle = 'background:rgba(59, 130, 246, 0.1); color:#3b82f6;'; // Default Blue

        if (s.current === 0) {
            status = 'Inactivo';
            statusStyle = 'background:rgba(239, 68, 68, 0.2); color:#ef4444; font-weight:bold;';
        } else if (s.prev === 0) {
            status = 'Nuevo';
            statusStyle = 'background:rgba(16, 185, 129, 0.2); color:#10b981;';
        } else if (trendVal > 0) {
            status = 'En Alta';
            statusStyle = 'background:rgba(16, 185, 129, 0.2); color:#10b981;';
        } else if (trendVal < 0) {
            status = 'En Baja';
            statusStyle = 'background:rgba(245, 158, 11, 0.2); color:#f59e0b;';
        }

        const tr = document.createElement('tr');
        if (status === 'Inactivo') tr.style.opacity = '0.7'; // Dim inactive rows
        
        tr.innerHTML = `
            <td>${i+1}</td>
            <td style="font-weight:500;">${s.name}</td>
            <td>${formatCurrency(s.current)}</td>
            <td style="color:var(--text-muted)">${formatCurrency(s.prev)}</td>
            <td>${trend}</td>
            <td><span class="badge" style="${statusStyle} border:none;">${status}</span></td>
        `;
        tb.appendChild(tr);
    });
    
    lucide.createIcons();
}

function renderMixView() {
    const clientsMix = {};
    
    globalData.forEach(r => {
        const clientKey = r.cliente; 
        if (!clientsMix[clientKey]) {
            clientsMix[clientKey] = {
                prods: new Set(),
                comercial: r.comercial
            };
        }
        clientsMix[clientKey].prods.add(r.producto);
    });

    const categories = {
        '1_4': [],
        '5_10': [],
        '11_20': [],
        '21_plus': []
    };

    Object.entries(clientsMix).forEach(([name, data]) => {
        const count = data.prods.size;
        const info = { name, count, comercial: data.comercial };
        if (count >= 1 && count <= 4) categories['1_4'].push(info);
        else if (count >= 5 && count <= 10) categories['5_10'].push(info);
        else if (count >= 11 && count <= 20) categories['11_20'].push(info);
        else if (count > 20) categories['21_plus'].push(info);
    });

    // Sort each category by count descending
    Object.keys(categories).forEach(cat => {
        categories[cat].sort((a, b) => b.count - a.count);
    });

    // Update Tables
    const updateTable = (id, list, badgeId) => {
        const tb = document.querySelector(`#${id} tbody`);
        tb.innerHTML = '';
        document.getElementById(badgeId).textContent = `${list.length} Clientes`;
        
        list.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight:500;">${item.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);"><i data-lucide="briefcase" style="width:12px;height:12px;display:inline;vertical-align:middle;"></i> ${item.comercial}</div>
                </td>
                <td><span class="badge" style="background:rgba(var(--primary-rgb), 0.1); border:none;">${item.count} items</span></td>
            `;
            tb.appendChild(tr);
        });
    };

    updateTable('tableMix1_4', categories['1_4'], 'countMix1_4');
    updateTable('tableMix5_10', categories['5_10'], 'countMix5_10');
    updateTable('tableMix11_20', categories['11_20'], 'countMix11_20');
    updateTable('tableMix21_plus', categories['21_plus'], 'countMix21_plus');
}

document.getElementById('btnClosePresentation').onclick = () => document.getElementById('clientDetails').classList.add('hidden');
document.getElementById('btnCloseModal').onclick = () => document.getElementById('productDropModal').classList.add('hidden');

function exportMixToExcel() {
    if (globalData.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const clientsMix = {};
    globalData.forEach(r => {
        const clientKey = (r.id_cliente && r.id_cliente !== 'S/ID') ? r.id_cliente : r.cliente;
        if (!clientsMix[clientKey]) {
            clientsMix[clientKey] = {
                id: r.id_cliente,
                name: r.cliente,
                comercial: r.comercial,
                prods: new Set()
            };
        }
        clientsMix[clientKey].prods.add(r.producto);
    });

    const data = Object.values(clientsMix).map(d => {
        const count = d.prods.size;
        let category = '';
        if (count <= 4) category = '1 a 4 Items';
        else if (count <= 10) category = '5 a 10 Items';
        else if (count <= 20) category = '11 a 20 Items';
        else category = '+20 Items';

        return {
            'ID Cliente': d.id,
            'Cliente': d.name,
            'Vendedor': d.comercial,
            'Cant. Productos Distintos': count,
            'Categoría Mix': category
        };
    }).sort((a, b) => b['Cant. Productos Distintos'] - a['Cant. Productos Distintos']);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mix de Productos");
    
    // Set column widths
    const wscols = [
        {wch: 15}, // ID
        {wch: 40}, // Cliente
        {wch: 25}, // Vendedor
        {wch: 25}, // Cantidad
        {wch: 20}  // Categoria
    ];
    ws['!cols'] = wscols;

    const fileName = `Mix_Productos_Tucuman_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

function checkLockedComercial() {
    const params = new URLSearchParams(window.location.search);
    const vCode = params.get('v');
    
    if (vCode) {
        lockedComercial = vCode;
        console.log('Modo Vendedor bloqueado para:', lockedComercial);
        
        const style = document.createElement('style');
        style.textContent = `
            #btnClearData, #btnExportRemote, .sidebar-bottom, [data-view="comercial"], [data-view="mix"], #vendedorFilter { display: none !important; }
        `;
        document.head.appendChild(style);
        
        window.addEventListener('load', () => {
            setTimeout(() => {
                const title = document.querySelector('header h1');
                if (title) title.textContent = 'Mi Panel de Ventas';
                const subtitle = document.querySelector('.subtitle');
                if (subtitle) subtitle.textContent = 'Análisis Personalizado - Tucumán';
            }, 500);
        });
    }
}
