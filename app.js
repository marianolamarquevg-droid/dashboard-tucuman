// Initialize Lucide icons
lucide.createIcons();

// State
let rawGlobalData = [];
let globalData = [];
let currentView = 'dashboard';
let lockedComercial = null;
let clientHistoryChartInst = null;
let monthlyRevenueChartInst = null;
let comercialRevenueChartInst = null;

const COMERCIAL_MAPPING = {
    '24': 'MARIANO',
    '36': 'IVAN',
    '17': 'RUBEN',
    '30': 'BRAIAN'
};

function isMatchComercial(comercialName, filterCode) {
    if (!comercialName || !filterCode) return false;
    const name = comercialName.toString().toUpperCase();
    const code = filterCode.toString().toUpperCase();
    const mapped = (COMERCIAL_MAPPING[code] || '').toUpperCase();
    return name.includes(code) || (mapped && name.includes(mapped));
}

// ==========================================
// CORRECCIÓN DE FECHAS PARA IPHONE (Safari/Chrome iOS)
// ==========================================
function parseFechaIOS(fechaStr) {
  if (!fechaStr) return new Date();
  const isoStr = fechaStr.includes(' ') ? fechaStr.replace(' ', 'T') : fechaStr;
  return new Date(isoStr);
}

// ==========================================
// PERSISTENCIA HÍBRIDA (LocalStorage + IndexedDB para iPhone)
// ==========================================
const DB_NAME = 'SalesDB_Tucuman_v1';
const STORE_NAME = 'salesStore';

function saveToDB(data) {
    try {
        localStorage.setItem('sales_tucuman_backup', JSON.stringify(data));
    } catch (e) {
        console.warn('No se pudo guardar en LocalStorage:', e);
    }

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

function loadFromDB() {
    try {
        const localBackup = localStorage.getItem('sales_tucuman_backup');
        if (localBackup) {
            const parsedData = JSON.parse(localBackup);
            if (parsedData && parsedData.length > 0) {
                processLoadedData(parsedData);
                return;
            }
        }
    } catch (e) {
        console.log('Error al leer LocalStorage, intentando IndexedDB...', e);
    }

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
                if (globalData.length === 0) {
                    processLoadedData(getReq.result.data);
                }
            }
        };
    };
}

function processLoadedData(data) {
    rawGlobalData = data;
    
    if (lockedComercial) {
        rawGlobalData = rawGlobalData.filter(r => isMatchComercial(r.comercial, lockedComercial));
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

function checkLockedComercial() {
    const urlParams = new URLSearchParams(window.location.search);
    const vParam = urlParams.get('v');
    if (vParam) {
        lockedComercial = vParam;
    }
}

const REMOTE_DATA_URL = 'https://marianolamarquevg-droid.github.io/dashboard-tucuman/data.json';

async function checkRemoteData() {
    try {
        const response = await fetch(REMOTE_DATA_URL + '?t=' + new Date().getTime(), {
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        if (response.ok) {
            const remoteData = await response.json();
            if (remoteData && remoteData.length > 0) {
                rawGlobalData = remoteData;
                
                if (lockedComercial) {
                    rawGlobalData = rawGlobalData.filter(r => isMatchComercial(r.comercial, lockedComercial));
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
        console.log('No hay datos remotos o error de red:', err);
    }
}

function updateMonthFilter() {
    let allMonthsSet = new Set(rawGlobalData.map(d => d.mes));
    const monthSelect = document.getElementById('monthFilter');
    if (!monthSelect) return;
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
    
    if (vendedorSelect) {
        vendedorSelect.innerHTML = options;
        vendedorSelect.classList.remove('hidden');
    }
    if (comercialSelector) {
        comercialSelector.innerHTML = selectorOptions;
    }
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
                localStorage.removeItem('sales_tucuman_backup');
                
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
                const dashNav = document.querySelector(`[data-view="dashboard"]`);
                if (dashNav) dashNav.classList.add('active');
                Object.values(views).forEach(v => { if (v) v.classList.add('hidden'); });
            }
        });
    }

    const btnExport = document.getElementById('btnExportRemote');
    if (btnExport) {
        btnExport.addEventListener('click', exportDataForMobile);
    }
    
    const monthFilterEl = document.getElementById('monthFilter');
    if (monthFilterEl) monthFilterEl.addEventListener('change', applyFilters);
    
    const comercialSelEl = document.getElementById('comercialSelector');
    if (comercialSelEl) comercialSelector.addEventListener('change', renderComercialView);
    
    const btnExportMix = document.getElementById('btnExportMix');
    if (btnExportMix) btnExportMix.addEventListener('click', exportMixToExcel);
});

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
    const targetNav = document.querySelector(`[data-view="${viewName}"]`);
    if (targetNav) targetNav.classList.add('active');
    Object.values(views).forEach(v => { if (v) v.classList.add('hidden'); });
    
    if (rawGlobalData.length > 0) {
        if (uploadOverlay) uploadOverlay.classList.add('hidden');
        if (views[viewName]) views[viewName].classList.remove('hidden');
        if (viewName === 'mix' && typeof renderMixView === 'function') renderMixView();
        if (viewName === 'comercial' && typeof renderComercialView === 'function') renderComercialView();
    } else {
        if (uploadOverlay) uploadOverlay.classList.remove('hidden');
    }
}

// Excel Processing
if (uploadBox) {
    uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('dragover'); });
    uploadBox.addEventListener('dragleave', () => { uploadBox.classList.remove('dragover'); });
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
}
if (fileInput) {
    fileInput.addEventListener('change', function() { handleFiles(this.files); });
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (dataStatus) dataStatus.textContent = 'Procesando...';
        const reader = new FileReader();
        reader.onload = (e) => processExcel(new Uint8Array(e.target.result));
        reader.readAsArrayBuffer(file);
    }
}

function normalizeHeader(header) {
    if (!header) return '';
    return header.toString().toLowerCase().trim()
        .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
        .replace(/[^a-z0-9 ]/g, '');
}

function findCol(headers, possibleNames, excludeKeywords = []) {
    for (let i = 0; i < headers.length; i++) {
        const h = normalizeHeader(headers[i]);
        if (possibleNames.includes(h)) return i;
    }
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
        
        const colId = findCol(headers, ['cod cliente', 'id cliente', 'codigo cliente', 'codigo cli', 'nro cliente', 'nro. cliente', 'cod cli', 'id cli'], ['vendedor', 'comercial', 'prod']);
        const colCliente = findCol(headers, ['razon social', 'nombre cliente', 'cliente', 'nombre'], ['vendedor', 'comercial', 'prod', 'cod', 'id']);
        const colProd = findCol(headers, ['descripcion', 'nombre producto', 'producto', 'desc.', 'descrip', 'articulo'], ['cod', 'id', 'cliente', 'vendedor']);
        
        let colComercial = findCol(headers, ['nombre vendedor', 'nombre comercial', 'vendedor nombre'], ['cod', 'id']);
        if (colComercial === -1) {
            for (let i = 0; i < headers.length; i++) {
                const h = normalizeHeader(headers[i]);
                if ((h.includes('vendedor') || h.includes('comercial')) && !h.includes('cod') && !h.includes('id')) {
                    colComercial = i;
                    break;
                }
            }
        }
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
            if (comercial === 'Sin Asignar') continue;

            let fechaRaw = row[colFecha];
            let mes = 'Desconocido';
            if (fechaRaw) {
                if (typeof fechaRaw === 'number') {
                    const d = parseFechaIOS((fechaRaw - (25567 + 2)) * 86400 * 1000);
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
            rawGlobalData = rawGlobalData.filter(r => isMatchComercial(r.comercial, lockedComercial));
        }
        
        globalData = [...rawGlobalData];
        saveToDB(rawGlobalData);
        updateMonthFilter();
        updateVendedorFilter();
        if (dataStatus) {
            dataStatus.textContent = `Datos Cargados (${globalData.length} filas)`;
            dataStatus.className = 'status-badge loaded';
        }
        const btnClr = document.getElementById('btnClearData');
        if (btnClr) btnClr.classList.remove('hidden');
        const btnExp = document.getElementById('btnExportRemote');
        if (btnExp) btnExp.classList.remove('hidden');
        if (uploadOverlay) uploadOverlay.classList.add('hidden');
        if (views[currentView]) views[currentView].classList.remove('hidden');
        renderDashboard();
    } catch (e) {
        console.error(e);
        alert("Error al procesar el Excel.");
    }
}

// Rendering
const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('es-AR').format(val);

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
        let clientKey = (row.id_cliente && row.id_cliente !== 'S/ID') ? row.id_cliente : row.cliente;
        clients.add(clientKey);
        comercialStats[row.comercial] = (comercialStats[row.comercial] || 0) + row.facturacion;
        clientStats[row.cliente] = (clientStats[row.cliente] || 0) + row.facturacion;
        prodStats[row.producto] = (prodStats[row.producto] || 0) + row.cantidad;
    });

    const revEl = document.getElementById('kpiTotalRevenue');
    if (revEl) revEl.textContent = formatCurrency(totalRevenue);
    const cliEl = document.getElementById('kpiTotalClients');
    if (cliEl) cliEl.textContent = formatNumber(clients.size);
    const itmEl = document.getElementById('kpiTotalItems');
    if (itmEl) itmEl.textContent = formatNumber(totalItems);
    
    let topComercial = Object.entries(comercialStats).sort((a,b) => b[1]-a[1])[0];
    const topComEl = document.getElementById('kpiTopComercial');
    if (topComEl) topComEl.textContent = topComercial ? topComercial[0] : '-';
    
    let topClient = Object.entries(clientStats).sort((a,b) => b[1]-a[1])[0];
    const topCliEl = document.getElementById('kpiTopClient');
    if (topCliEl) topCliEl.textContent = topClient ? topClient[0] : '-';
    
    let topProduct = Object.entries(prodStats).sort((a,b) => b[1]-a[1])[0];
    const topProdEl = document.getElementById('kpiTopProduct');
    if (topProdEl) topProdEl.textContent = topProduct ? topProduct[0] : '-';

    // Tables
    const tb = document.querySelector('#mainDetailTable tbody');
    if (tb) {
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
            tr.innerHTML = `<td><span class="badge" style="background:rgba(16, 185, 129, 0.1); color:var(--success); border:none;">${item.cliente}</span></td><td>${item.id}</td><td>${item.comercial}</td><td>${item.producto}</td><td>${formatNumber(item.cantidad)}</td><td style="color:var(--success)">${formatCurrency(item.total)}</td>`;
            tb.appendChild(tr);
        });

        const tbComClients = document.querySelector('#topClientsComercialTable tbody');
        if (tbComClients) {
            tbComClients.innerHTML = '';
            Object.keys(comercialClientStats).forEach(com => {
                Object.entries(comercialClientStats[com]).sort((a,b) => b[1]-a[1]).forEach(cl => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${com}</td><td>${cl[0]}</td><td style="color:var(--primary)">${formatCurrency(cl[1])}</td>`;
                    tbComClients.appendChild(tr);
                });
            });
        }
    }

    renderCharts(comercialStats);
    renderProductTrend();
    lucide.createIcons();
}

function renderCharts(comercialStats) {
    let revByMonth = {};
    rawGlobalData.forEach(r => { revByMonth[r.mes] = (revByMonth[r.mes] || 0) + r.facturacion; });
    let months = Object.keys(revByMonth).sort();
    
    const monthlyCanvas = document.getElementById('monthlyRevenueChart');
    if (monthlyCanvas && window.Chart) {
        if (monthlyRevenueChartInst) monthlyRevenueChartInst.destroy();
        monthlyRevenueChartInst = new Chart(monthlyCanvas, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{ label: 'Facturación', data: months.map(m => revByMonth[m]), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const comercialCanvas = document.getElementById('comercialRevenueChart');
    if (comercialCanvas && window.Chart) {
        if (comercialRevenueChartInst) comercialRevenueChartInst.destroy();
        comercialRevenueChartInst = new Chart(comercialCanvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(comercialStats),
                datasets: [{ data: Object.values(comercialStats), backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '70%' }
        });
    }
}

function renderProductTrend() {
    const tbProd = document.querySelector('#productsTrendTable tbody');
    if (!tbProd) return;
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
    if (!modal || !tbody) return;
    
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

// ==========================================
// BÚSQUEDA Y DETALLE DE CLIENTES (BLINDADO Y CON GRÁFICO DE BARRAS)
// ==========================================
const clientSearchInput = document.getElementById('clientSearchInput');
if (clientSearchInput) {
    clientSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const sug = document.getElementById('searchSuggestions');
        if (!sug) return;
        
        if (term.length < 2) { 
            sug.classList.add('hidden'); 
            return; 
        }
        
        const clients = new Map();
        rawGlobalData.forEach(r => {
            const name = r.cliente || '';
            const id = r.id_cliente || '';
            if (name.toLowerCase().includes(term) || id.toLowerCase().includes(term)) {
                clients.set(id || name, name);
            }
        });
        
        sug.innerHTML = '';
        Array.from(clients.entries()).slice(0, 10).forEach(([id, name]) => {
            const d = document.createElement('div'); 
            d.className = 'suggestion-item';
            d.innerHTML = `<span class="client-id">${id}</span><span>${name}</span>`;
            d.onclick = () => { 
                clientSearchInput.value = name; 
                sug.classList.add('hidden'); 
                searchClient(); 
            };
            sug.appendChild(d);
        });
        sug.classList.toggle('hidden', sug.innerHTML === '');
    });
}

function searchClient() {
    const inputEl = document.getElementById('clientSearchInput');
    if (!inputEl) return;
    
    const term = inputEl.value.toLowerCase().trim();
    if (!term) return;

    // 1. Filtrar filas del cliente
    const rows = rawGlobalData.filter(r => {
        const idMatch = r.id_cliente && r.id_cliente.toString().toLowerCase().includes(term);
        const nameMatch = r.cliente && r.cliente.toString().toLowerCase().includes(term);
        return idMatch || nameMatch;
    });

    const emptyState = document.getElementById('clientEmptyState');
    if (rows.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // 2. Rellenar Nombre, ID y Vendedor en la cabecera
    const sample = rows[0];
    
    const nameEl = document.getElementById('clientDetailName') || document.querySelector('.client-title') || document.querySelector('#clientSearchView h2');
    if (nameEl) nameEl.textContent = sample.cliente;

    const idEl = document.getElementById('clientDetailId') || document.querySelector('.client-id-badge');
    if (idEl) idEl.textContent = `ID: ${sample.id_cliente}`;

    const vendEl = document.getElementById('clientDetailVendedor') || document.querySelector('.client-vendor');
    if (vendEl) vendEl.textContent = sample.comercial;

    // 3. Calcular Totales y métricas
    let totalFacturacion = 0;
    let totalCantidad = 0;
    let totalBoletas = rows.length;

    let revByMonth = {};
    let mixSet = new Set();

    rows.forEach(r => {
        totalFacturacion += (r.facturacion || 0);
        totalCantidad += (r.cantidad || 0);
        if (r.mes) {
            revByMonth[r.mes] = (revByMonth[r.mes] || 0) + r.facturacion;
        }
        if (r.producto) mixSet.add(r.producto);
    });

    const ticketPromedio = totalBoletas > 0 ? totalFacturacion / totalBoletas : 0;

    // 4. Inyectar valores en los KPIs superiores
    const setVal = (selectors, value) => {
        selectors.forEach(sel => {
            const el = document.getElementById(sel) || document.querySelector('.' + sel);
            if (el) el.textContent = value;
        });
    };

    setVal(['clientTotalRevenue', 'kpiTotalRevenue', 'clientTotalFacturacion'], formatCurrency(totalFacturacion));
    setVal(['clientTicketProm', 'ticketPromedio'], formatCurrency(ticketPromedio));
    setVal(['clientTotalBoletas', 'totalBoletas'], `${totalBoletas} boletas detected`);
    setVal(['clientMixCount', 'mixCount', 'clientMix'], mixSet.size);

    // 5. Renderizar el gráfico de barras "Evolución Mensual de Compras"
    const months = Object.keys(revByMonth).sort();
    const revenues = months.map(m => revByMonth[m]);

    const canvasEl = document.getElementById('clientHistoryChart') || document.getElementById('monthlyRevenueChart');
    if (canvasEl && window.Chart) {
        if (clientHistoryChartInst) {
            clientHistoryChartInst.destroy();
        }
        clientHistoryChartInst = new Chart(canvasEl, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Compras',
                    data: revenues,
                    backgroundColor: '#a855f7',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#ffffff' }, grid: { display: false } },
                    y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
    }

    // 6. Forzar la visualización de todos los contenedores ocultos en iPhone
    document.querySelectorAll('#clientSearchView .hidden, #clientResultContainer.hidden').forEach(el => {
        el.classList.remove('hidden');
    });

    if (window.lucide) lucide.createIcons();
}

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
    
    if (currentView === 'comercial' && typeof renderComercialView === 'function') {
        renderComercialView();
    }
    if (currentView === 'mix' && typeof renderMixView === 'function') {
        renderMixView();
    }
}
