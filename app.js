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
// CORRECCIÓN DE FECHAS PARA IPHONE
// ==========================================
function parseFechaIOS(fechaStr) {
  if (!fechaStr) return new Date();
  const isoStr = fechaStr.includes(' ') ? fechaStr.replace(' ', 'T') : fechaStr;
  return new Date(isoStr);
}

// ==========================================
// PERSISTENCIA HÍBRIDA
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
        console.log('Error al leer LocalStorage...', e);
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
        console.log('Error de red:', err);
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
            if(confirm('¿Deseas borrar todos los datos?')) {
                rawGlobalData = [];
                globalData = [];
                localStorage.removeItem('sales_tucuman_backup');
                document.getElementById('monthFilter').classList.add('hidden');
                document.getElementById('vendedorFilter').classList.add('hidden');
                btnClear.classList.add('hidden');
                dataStatus.textContent = 'Esperando datos...';
                dataStatus.className = 'status-badge empty';
                uploadOverlay.classList.remove('hidden');
            }
        });
    }

    const btnExport = document.getElementById('btnExportRemote');
    if (btnExport) btnExport.addEventListener('click', exportDataForMobile);
    
    const monthFilterEl = document.getElementById('monthFilter');
    if (monthFilterEl) monthFilterEl.addEventListener('change', applyFilters);
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
    alert('Archivo descargado.');
}

// DOM Elements & Views
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
        const colFactura = findCol(headers, ['nro comprobante', 'nro factura', 'numero factura', 'numero comprobante', 'boleta', 'factura', 'comprobante']);

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
        renderDashboard();
    } catch (e) {
        console.error(e);
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
    
    renderCharts(comercialStats);
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

function renderProductTrend() {}

// ==========================================
// BÚSQUEDA Y DETALLE DE CLIENTES (CORREGIDO Y BLINDADO)
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

    // BÚSQUEDA FLEXIBLE POR COINCIDENCIA PARCIAL (Soluciona el error de iPhone)
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

    const sample = rows[0];

    // Actualizar Encabezados (Nombre, ID, Vendedor)
    const nameEls = document.querySelectorAll('#clientDetailName, .client-name, .client-title');
    nameEls.forEach(el => el.textContent = sample.cliente);
    
    const titleFallback = document.querySelector('#clientSearchView h2, #clientSearchView .text-xl, #clientSearchView .font-bold');
    if (titleFallback && !titleFallback.textContent.includes('Evolución')) {
        titleFallback.textContent = sample.cliente;
    }

    const idEls = document.querySelectorAll('#clientDetailId, .client-id, .client-id-badge');
    idEls.forEach(el => el.textContent = `ID: ${sample.id_cliente}`);

    const vendEls = document.querySelectorAll('#clientDetailVendedor, .client-vendor, .vendor-name');
    vendEls.forEach(el => el.textContent = sample.comercial);

    // Calcular Totales, Boletas y Mix
    let totalFacturacion = 0;
    let totalCantidad = 0;
    let uniqueFacturas = new Set(rows.map(r => r.factura).filter(f => f && f !== 'S/F'));
    let numBoletas = uniqueFacturas.size > 0 ? uniqueFacturas.size : rows.length;

    let revByMonth = {};
    let prodStats = {}; 
    let mixSet = new Set();

    rows.forEach(r => {
        totalFacturacion += (r.facturacion || 0);
        totalCantidad += (r.cantidad || 0);
        if (r.mes) {
            revByMonth[r.mes] = (revByMonth[r.mes] || 0) + r.facturacion;
        }
        if (r.producto) {
            mixSet.add(r.producto);
            prodStats[r.producto] = (prodStats[r.producto] || 0) + r.facturacion;
        }
    });

    const ticketPromedio = numBoletas > 0 ? totalFacturacion / numBoletas : 0;

    // Inyectar valores superiores
    const setValByIdOrClass = (ids, val) => {
        ids.forEach(id => {
            const el = document.getElementById(id) || document.querySelector('.' + id);
            if (el) el.textContent = val;
        });
    };

    setValByIdOrClass(['clientTotalRevenue', 'kpiTotalRevenue', 'clientTotalFacturacion', 'totalRevenue'], formatCurrency(totalFacturacion));
    setValByIdOrClass(['clientTicketProm', 'ticketPromedio'], formatCurrency(ticketPromedio));
    setValByIdOrClass(['clientTotalBoletas', 'totalBoletas'], `(${numBoletas} bol.)`);
    setValByIdOrClass(['clientMixCount', 'mixCount', 'clientMix'], mixSet.size);

    // Renderizar gráfico de barras del cliente
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

    // Rellenar la tabla inferior de productos
    const tbody = document.querySelector('#clientDetailTable tbody') || document.querySelector('#clientSearchView table tbody') || document.querySelector('#clientSearchView .table tbody');
    if (tbody) {
        tbody.innerHTML = '';
        Object.entries(prodStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([prod, total]) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${prod}</td>
                    <td style="color:var(--success); font-weight:600;">${formatCurrency(total)}</td>
                `;
                tbody.appendChild(tr);
            });
    }

    // Forzar visibilidad
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
}
