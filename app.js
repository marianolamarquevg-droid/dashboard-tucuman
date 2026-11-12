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
  if (typeof fechaStr === 'number') return new Date(fechaStr);
  const str = String(fechaStr);
  const isoStr = str.includes(' ') ? str.replace(' ', 'T') : str;
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

    const vendedorFilterEl = document.getElementById('vendedorFilter');
    if (vendedorFilterEl) vendedorFilterEl.addEventListener('change', applyFilters);

    const comercialSelectorEl = document.getElementById('comercialSelector');
    if (comercialSelectorEl) comercialSelectorEl.addEventListener('change', renderComercialView);

    const btnSearchClient = document.getElementById('btnSearchClient');
    if (btnSearchClient) btnSearchClient.addEventListener('click', () => searchClient());

    const clientSearchInputEl = document.getElementById('clientSearchInput');
    if (clientSearchInputEl) {
        clientSearchInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const sug = document.getElementById('searchSuggestions');
                if (sug) sug.classList.add('hidden');
                searchClient();
            }
        });
    }

    const btnClosePresentation = document.getElementById('btnClosePresentation');
    if (btnClosePresentation) {
        btnClosePresentation.addEventListener('click', () => {
            document.getElementById('clientDetails').classList.add('hidden');
        });
    }

    const btnCloseModal = document.getElementById('btnCloseModal');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            document.getElementById('productDropModal').classList.add('hidden');
        });
    }

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
        if (viewName === 'mix') renderMixView();
        if (viewName === 'comercial') renderComercialView();
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
        dataStatus.textContent = `Datos Cargados (${globalData.length} filas)`;
        dataStatus.className = 'status-badge loaded';
        document.getElementById('btnClearData').classList.remove('hidden');
        document.getElementById('btnExportRemote').classList.remove('hidden');
        uploadOverlay.classList.add('hidden');
        views[currentView].classList.remove('hidden');
        renderDashboard();
    } catch (e) {
        console.error(e);
    }
}

// Rendering
const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(val);

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

    const topComercialEntry = Object.entries(comercialStats).sort((a, b) => b[1] - a[1])[0];
    const topClientEntry = Object.entries(clientStats).sort((a, b) => b[1] - a[1])[0];
    const topProdEntry = Object.entries(prodStats).sort((a, b) => b[1] - a[1])[0];

    const topComEl = document.getElementById('kpiTopComercial');
    if (topComEl) topComEl.textContent = topComercialEntry ? topComercialEntry[0] : '-';

    const topCliEl = document.getElementById('kpiTopClient');
    if (topCliEl) {
        topCliEl.textContent = topClientEntry ? topClientEntry[0] : '-';
        topCliEl.title = topClientEntry ? `${topClientEntry[0]} (${formatCurrency(topClientEntry[1])})` : '';
    }

    const topProdEl = document.getElementById('kpiTopProduct');
    if (topProdEl) {
        topProdEl.textContent = topProdEntry ? topProdEntry[0] : '-';
        topProdEl.title = topProdEntry ? `${topProdEntry[0]} (${formatNumber(topProdEntry[1])} un.)` : '';
    }

    renderDashboardTables();
    renderCharts(comercialStats);
    lucide.createIcons();
}

function renderDashboardTables() {
    const topClientsTbody = document.querySelector('#topClientsComercialTable tbody');
    if (topClientsTbody) {
        const pairMap = {};
        globalData.forEach(r => {
            const key = `${r.comercial}|||${r.cliente}`;
            pairMap[key] = (pairMap[key] || 0) + r.facturacion;
        });
        const sortedPairs = Object.entries(pairMap).sort((a, b) => b[1] - a[1]).slice(0, 50);
        topClientsTbody.innerHTML = sortedPairs.map(([key, total]) => {
            const [comercial, cliente] = key.split('|||');
            return `<tr>
                <td>${comercial}</td>
                <td>${cliente}</td>
                <td style="color: var(--success, #10b981); font-weight: 600;">${formatCurrency(total)}</td>
            </tr>`;
        }).join('');
    }

    const prodTrendTbody = document.querySelector('#productsTrendTable tbody');
    if (prodTrendTbody) {
        const mFilter = document.getElementById('monthFilter') ? document.getElementById('monthFilter').value : 'ALL';
        const vFilter = document.getElementById('vendedorFilter') ? document.getElementById('vendedorFilter').value : 'ALL';
        const allMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
        
        let currentMonth = mFilter !== 'ALL' && !mFilter.startsWith('LAST_') ? mFilter : allMonths[allMonths.length - 1];
        let prevMonthIndex = allMonths.indexOf(currentMonth) - 1;
        let prevMonth = prevMonthIndex >= 0 ? allMonths[prevMonthIndex] : null;

        const currProd = {};
        const prevProd = {};

        rawGlobalData.forEach(r => {
            if (vFilter !== 'ALL' && r.comercial !== vFilter) return;
            if (mFilter === 'ALL' || mFilter.startsWith('LAST_')) {
                if (globalData.includes(r)) {
                    currProd[r.producto] = (currProd[r.producto] || 0) + r.cantidad;
                }
            } else {
                if (r.mes === currentMonth) currProd[r.producto] = (currProd[r.producto] || 0) + r.cantidad;
                if (prevMonth && r.mes === prevMonth) prevProd[r.producto] = (prevProd[r.producto] || 0) + r.cantidad;
            }
        });

        const allProds = new Set([...Object.keys(currProd), ...Object.keys(prevProd)]);
        const sortedProds = Array.from(allProds)
            .map(p => ({ prod: p, curr: currProd[p] || 0, prev: prevProd[p] || 0 }))
            .sort((a, b) => b.curr - a.curr)
            .slice(0, 50);

        prodTrendTbody.innerHTML = sortedProds.map(item => {
            let diffHtml = '<span style="color: var(--text-muted);">-</span>';
            if (prevMonth && mFilter !== 'ALL' && !mFilter.startsWith('LAST_')) {
                const diff = item.curr - item.prev;
                if (diff > 0) diffHtml = `<span style="color: #10b981;">+${formatNumber(diff)}</span>`;
                else if (diff < 0) diffHtml = `<span style="color: #ef4444;">${formatNumber(diff)}</span>`;
                else diffHtml = `<span style="color: var(--text-muted);">0</span>`;
            }
            return `<tr>
                <td><i data-lucide="package" style="width:16px;height:16px;color:var(--primary);"></i></td>
                <td>${item.prod}</td>
                <td>${formatNumber(item.curr)}</td>
                <td>${diffHtml}</td>
            </tr>`;
        }).join('');
    }

    const detailTbody = document.querySelector('#mainDetailTable tbody');
    if (detailTbody) {
        const groupedDetails = {};
        globalData.forEach(r => {
            const key = `${r.id_cliente}|||${r.cliente}|||${r.comercial}|||${r.producto}`;
            if (!groupedDetails[key]) {
                groupedDetails[key] = { id: r.id_cliente, cliente: r.cliente, comercial: r.comercial, producto: r.producto, cant: 0, total: 0 };
            }
            groupedDetails[key].cant += r.cantidad;
            groupedDetails[key].total += r.facturacion;
        });

        const rowsToRender = Object.values(groupedDetails).sort((a, b) => b.total - a.total).slice(0, 200);
        detailTbody.innerHTML = rowsToRender.map(r => `
            <tr>
                <td>${r.cliente}</td>
                <td>${r.id}</td>
                <td>${r.comercial}</td>
                <td>${r.producto}</td>
                <td>${formatNumber(r.cant)}</td>
                <td style="color: var(--success, #10b981); font-weight: 600;">${formatCurrency(r.total)}</td>
            </tr>
        `).join('');
    }
}

function renderCharts(comercialStats) {
    const vFilter = document.getElementById('vendedorFilter') ? document.getElementById('vendedorFilter').value : 'ALL';
    let revByMonth = {};
    rawGlobalData.forEach(r => {
        if (vFilter === 'ALL' || r.comercial === vFilter) {
            revByMonth[r.mes] = (revByMonth[r.mes] || 0) + r.facturacion;
        }
    });
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

// ==========================================
// VISTA: ANÁLISIS POR VENDEDOR
// ==========================================
function renderComercialView() {
    const selector = document.getElementById('comercialSelector');
    const tbody = document.querySelector('#comercialClientsTable tbody');
    if (!selector || !tbody) return;

    const selectedComercial = selector.value;
    if (!selectedComercial) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Selecciona un vendedor para ver el ranking de sus clientes.</td></tr>';
        return;
    }

    const allMonths = [...new Set(rawGlobalData.map(r => r.mes))].sort();
    const mFilter = document.getElementById('monthFilter') ? document.getElementById('monthFilter').value : 'ALL';
    const currMonth = (mFilter !== 'ALL' && !mFilter.startsWith('LAST_')) ? mFilter : allMonths[allMonths.length - 1];
    const prevMonth = allMonths.indexOf(currMonth) > 0 ? allMonths[allMonths.indexOf(currMonth) - 1] : null;

    const clientMap = {};
    rawGlobalData.forEach(r => {
        if (r.comercial !== selectedComercial) return;
        if (!clientMap[r.cliente]) clientMap[r.cliente] = { curr: 0, prev: 0 };
        if (r.mes === currMonth) clientMap[r.cliente].curr += r.facturacion;
        if (prevMonth && r.mes === prevMonth) clientMap[r.cliente].prev += r.facturacion;
    });

    const sorted = Object.entries(clientMap)
        .map(([cliente, vals]) => ({ cliente, ...vals }))
        .sort((a, b) => b.curr - a.curr);

    tbody.innerHTML = sorted.map((item, idx) => {
        const diff = item.curr - item.prev;
        let trendHtml = '-';
        let statusHtml = '<span class="badge">Estable</span>';
        if (prevMonth) {
            if (item.curr === 0 && item.prev > 0) {
                trendHtml = `<span style="color:#ef4444;">-100%</span>`;
                statusHtml = `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;">Inactivo</span>`;
            } else if (item.prev === 0 && item.curr > 0) {
                trendHtml = `<span style="color:#10b981;">Nuevo</span>`;
                statusHtml = `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;">Nuevo</span>`;
            } else if (diff > 0) {
                const pct = ((diff / item.prev) * 100).toFixed(1);
                trendHtml = `<span style="color:#10b981;">+${pct}%</span>`;
                statusHtml = `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;">Sube</span>`;
            } else if (diff < 0) {
                const pct = ((diff / item.prev) * 100).toFixed(1);
                trendHtml = `<span style="color:#ef4444;">${pct}%</span>`;
                statusHtml = `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;">Baja</span>`;
            }
        }
        return `<tr>
            <td>#${idx + 1}</td>
            <td>${item.cliente}</td>
            <td style="font-weight:600;">${formatCurrency(item.curr)}</td>
            <td>${prevMonth ? formatCurrency(item.prev) : '-'}</td>
            <td>${trendHtml}</td>
            <td>${statusHtml}</td>
        </tr>`;
    }).join('');
}

// ==========================================
// VISTA: MIX DE PRODUCTOS
// ==========================================
function renderMixView() {
    const clientProds = {};
    globalData.forEach(r => {
        if (!clientProds[r.cliente]) clientProds[r.cliente] = new Set();
        clientProds[r.cliente].add(r.producto);
    });

    const groups = { g1_4: [], g5_10: [], g11_20: [], g21: [] };
    Object.entries(clientProds).forEach(([cliente, prodsSet]) => {
        const count = prodsSet.size;
        if (count >= 1 && count <= 4) groups.g1_4.push({ cliente, count });
        else if (count >= 5 && count <= 10) groups.g5_10.push({ cliente, count });
        else if (count >= 11 && count <= 20) groups.g11_20.push({ cliente, count });
        else if (count > 20) groups.g21.push({ cliente, count });
    });

    const fillMixTable = (tableId, countId, list) => {
        list.sort((a, b) => b.count - a.count);
        const countEl = document.getElementById(countId);
        if (countEl) countEl.textContent = `${list.length} Clientes`;
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (tbody) {
            tbody.innerHTML = list.map(i => `<tr><td>${i.cliente}</td><td style="font-weight:600;">${i.count}</td></tr>`).join('');
        }
    };

    fillMixTable('tableMix1_4', 'countMix1_4', groups.g1_4);
    fillMixTable('tableMix5_10', 'countMix5_10', groups.g5_10);
    fillMixTable('tableMix11_20', 'countMix11_20', groups.g11_20);
    fillMixTable('tableMix21_plus', 'countMix21_plus', groups.g21);
}

function exportMixToExcel() {
    if (!window.XLSX || globalData.length === 0) return;
    const clientProds = {};
    globalData.forEach(r => {
        if (!clientProds[r.cliente]) clientProds[r.cliente] = new Set();
        clientProds[r.cliente].add(r.producto);
    });
    const rows = Object.entries(clientProds)
        .map(([cliente, set]) => ({ Cliente: cliente, 'Cantidad Productos Distintos': set.size }))
        .sort((a, b) => b['Cantidad Productos Distintos'] - a['Cantidad Productos Distintos']);
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mix_Productos');
    XLSX.writeFile(wb, 'Mix_Productos_Tucuman.xlsx');
}

// ==========================================
// BÚSQUEDA Y DETALLE DE CLIENTES (COMPLETO CON MES A MES)
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
                searchClient(id !== 'S/ID' ? id : name); 
            };
            sug.appendChild(d);
        });
        sug.classList.toggle('hidden', sug.innerHTML === '');
    });
}

function searchClient(exactKey = null) {
    const inputEl = document.getElementById('clientSearchInput');
    const rawTerm = exactKey ? String(exactKey) : (inputEl ? inputEl.value : '');
    const term = rawTerm.toLowerCase().trim();
    if (!term) return;

    const rows = rawGlobalData.filter(r => {
        const idStr = r.id_cliente ? r.id_cliente.toString().toLowerCase().trim() : '';
        const nameStr = r.cliente ? r.cliente.toString().toLowerCase().trim() : '';
        if (exactKey) {
            return idStr === term || nameStr === term;
        }
        return idStr.includes(term) || nameStr.includes(term);
    });

    const emptyState = document.getElementById('clientEmptyState');
    if (rows.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const sample = rows[0];

    // 1. Actualizar Encabezados del Modal (Nombre, ID y Vendedor)
    const cdName = document.getElementById('cdName');
    if (cdName) cdName.textContent = sample.cliente;
    
    const cdId = document.getElementById('cdId');
    if (cdId) cdId.textContent = sample.id_cliente;

    const cdComercial = document.getElementById('cdComercial');
    if (cdComercial) {
        cdComercial.innerHTML = `<i data-lucide="briefcase" style="display:inline;vertical-align:middle;width:14px;height:14px;"></i> ${sample.comercial}`;
    }

    // 2. Calcular Totales, Boletas, Mix y Desglose Mensual por Producto
    let totalFacturacion = 0;
    let uniqueFacturas = new Set(rows.map(r => r.factura).filter(f => f && f !== 'S/F'));
    let numBoletas = uniqueFacturas.size > 0 ? uniqueFacturas.size : rows.length;

    let revByMonth = {};
    let prodMatrix = {}; // { producto: { totalFact: 0, totalCant: 0, byMonthCant: { '2026-06': 10 } } }
    let mixSet = new Set();

    // Obtener los últimos 6 meses disponibles en el sistema (o del cliente)
    const allSystemMonths = [...new Set(rawGlobalData.map(r => r.mes).filter(m => m && m !== 'Desconocido'))].sort();
    const last6Months = allSystemMonths.slice(-6);

    rows.forEach(r => {
        const fact = parseFloat(r.facturacion) || 0;
        const cant = parseFloat(r.cantidad) || 0;
        totalFacturacion += fact;

        if (r.mes && r.mes !== 'Desconocido') {
            revByMonth[r.mes] = (revByMonth[r.mes] || 0) + fact;
        }

        if (r.producto) {
            mixSet.add(r.producto);
            if (!prodMatrix[r.producto]) {
                prodMatrix[r.producto] = { totalFact: 0, totalCant: 0, byMonthCant: {} };
            }
            prodMatrix[r.producto].totalFact += fact;
            prodMatrix[r.producto].totalCant += cant;
            if (r.mes && r.mes !== 'Desconocido') {
                prodMatrix[r.producto].byMonthCant[r.mes] = (prodMatrix[r.producto].byMonthCant[r.mes] || 0) + cant;
            }
        }
    });

    const ticketPromedio = numBoletas > 0 ? totalFacturacion / numBoletas : 0;

    // 3. Inyectar KPIs superiores del cliente (Mix, Ticket Prom., Boletas y Total)
    const cdTotal = document.getElementById('cdTotal');
    if (cdTotal) cdTotal.textContent = formatCurrency(totalFacturacion);

    const cdAverageTicket = document.getElementById('cdAverageTicket');
    if (cdAverageTicket) cdAverageTicket.textContent = formatCurrency(ticketPromedio);

    const cdInvoicesCount = document.getElementById('cdInvoicesCount');
    if (cdInvoicesCount) cdInvoicesCount.textContent = `(${numBoletas} bol.)`;

    const cdMixProductos = document.getElementById('cdMixProductos');
    if (cdMixProductos) cdMixProductos.textContent = mixSet.size;

    // 4. Renderizar gráfico de barras de Evolución Mensual de Compras
    const months = Object.keys(revByMonth).sort();
    const revenues = months.map(m => revByMonth[m]);

    const canvasEl = document.getElementById('clientHistoryChart');
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

    // 5. Construir encabezados dinámicos de meses y filas con cantidades mes a mes
    const thead = document.getElementById('clientProductsTableHead');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>Producto</th>
                ${last6Months.map(m => `<th style="text-align: center;">${m}</th>`).join('')}
                <th style="text-align: right;">Total ($)</th>
            </tr>
        `;
    }

    const tbody = document.querySelector('#clientProductsTable tbody');
    if (tbody) {
        tbody.innerHTML = '';
        Object.entries(prodMatrix)
            .sort((a, b) => b[1].totalFact - a[1].totalFact)
            .forEach(([prod, stats]) => {
                const tr = document.createElement('tr');
                const monthCells = last6Months.map(m => {
                    const qty = stats.byMonthCant[m] || 0;
                    const colorStyle = qty > 0 ? 'color: #ffffff; font-weight: 600;' : 'color: var(--text-muted); opacity: 0.45;';
                    return `<td style="text-align: center; ${colorStyle}">${qty > 0 ? formatNumber(qty) : '-'}</td>`;
                }).join('');

                tr.innerHTML = `
                    <td>${prod}</td>
                    ${monthCells}
                    <td style="text-align: right; color: var(--success, #10b981); font-weight: 600;">${formatCurrency(stats.totalFact)}</td>
                `;
                tbody.appendChild(tr);
            });
    }

    // 6. Mostrar modal de cliente
    const clientDetailsModal = document.getElementById('clientDetails');
    if (clientDetailsModal) clientDetailsModal.classList.remove('hidden');

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
    if (currentView === 'mix') renderMixView();
    if (currentView === 'comercial') renderComercialView();
}
