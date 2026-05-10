# 📊 Dashboard de Ventas - Tucumán

[![GitHub](https://img.shields.io/badge/GitHub-dashboard--tucuman-blue?logo=github)](https://github.com/marianolamarquevg-droid/dashboard-tucuman)
[![PWA](https://img.shields.io/badge/PWA-Ready-green)](https://marianolamarquevg-droid.github.io/dashboard-tucuman/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Dashboard interactivo de análisis de ventas para comerciales de Vía Tucumán. Funciona offline con PWA, permite cargar datos desde Excel y genera análisis detallados por vendedor, cliente y productos.

## 🎯 Características Principales

### 📈 Dashboard Ejecutivo
- **KPIs en tiempo real**: Facturación total, clientes activos, artículos vendidos
- **Gráficos interactivos**: Evolución mensual, distribución por vendedor
- **Ranking de clientes**: Top clientes por vendedor
- **Análisis de productos**: Tendencias y cambios de consumo

### 👤 Búsqueda de Clientes
- Ficha dinámica de cliente con histórico completo
- Análisis de compras por mes
- Detalles de mix de productos
- Ticket promedio e identificación de abandonos

### 💼 Análisis por Vendedor
- Ranking de clientes con tendencia (vs mes anterior)
- Identificación de clientes nuevos, activos, en baja
- Comparación de desempeño

### 📦 Mix de Productos
- Clasificación de clientes por cantidad de productos
- Categorías: 1-4, 5-10, 11-20, +20 artículos
- Exportación a Excel

## 🚀 Inicio Rápido

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/marianolamarquevg-droid/dashboard-tucuman.git
cd dashboard-tucuman

# Abrir en servidor local (importante para PWA)
python -m http.server 8000
# o con Node.js:
npx http-server
```

Luego accede a `http://localhost:8000`

### Formato de Archivo Excel

Tu archivo debe contener las siguientes columnas (pueden variar en nombre):

| Columna | Ejemplos de Nombres | Requerido | Notas |
|---------|-------------------|-----------|-------|
| **Cliente** | Razón Social, Nombre Cliente, Cliente | ✅ | Nombre del cliente |
| **ID Cliente** | Cod Cliente, Nro Cliente, ID | ✅ | Identificador único |
| **Vendedor** | Nombre Vendedor, Comercial, Vendedor | ✅ | Nombre del vendedor |
| **Producto** | Descripción, Nombre Producto, Articulo | ✅ | Nombre del producto |
| **Cantidad** | Cant, Cantidad | ✅ | Unidades vendidas |
| **Facturación** | Monto, Total, Importe, Sin IVA | ✅ | Monto en moneda |
| **Fecha** | Emision, Mes, Fecha | ✅ | Fecha de venta (YYYY-MM-DD) |
| **Factura** | Nro Factura, Boleta, Comprobante | ❌ | Número de comprobante |

**Ejemplo de estructura:**

```csv
Fecha,Cod Cliente,Razón Social,Nombre Vendedor,Descripcion,Cantidad,Facturación,Nro Factura
2024-01-15,CLI001,Empresa A,MARIANO,Producto X,100,5000,FAC-001
2024-01-16,CLI002,Empresa B,IVAN,Producto Y,50,2500,FAC-002
```

## 📱 Uso

### 1. Cargar Datos
1. Haz clic en **"Cargar Excel"** en la barra lateral
2. Selecciona tu archivo `.xlsx` o `.csv`
3. El sistema detectará automáticamente las columnas
4. Los datos se guardan en tu navegador (offline)

### 2. Filtrar Información
- **Por Vendedor**: Selecciona de la lista desplegable
- **Por Mes**: Elige meses específicos o últimos N meses
- Los filtros se aplican automáticamente a todas las vistas

### 3. Analizar Resultados
- **Dashboard**: Vista general con KPIs
- **Búsqueda de Clientes**: Historial completo de un cliente
- **Por Vendedor**: Ranking y tendencias
- **Mix de Productos**: Segmentación por variedad

### 4. Exportar Datos
- **Botón "Exportar"**: Descarga JSON de datos actuales
- **"Exportar Mix"**: Excel con clasificación de clientes
- Útil para sincronización o análisis adicional

## 🔐 Modo Vendedor (URL con parámetro)

Los vendedores pueden acceder a un dashboard personalizado:

```
https://marianolamarquevg-droid.github.io/dashboard-tucuman/?v=24
```

Parámetros disponibles:
- `v=24` → Muestra solo datos de MARIANO
- `v=36` → Muestra solo datos de IVAN
- `v=17` → Muestra solo datos de RUBEN

**En modo vendedor se ocultan:**
- Botones de descarga/limpieza
- Vista de análisis por vendedor
- Filtro de vendedores

## 🏗️ Estructura del Proyecto

```
dashboard-tucuman/
├── index.html              # HTML principal
├── app.js                  # Lógica principal (REFACTORIZANDO)
├── styles.css              # Estilos CSS
├── service-worker.js       # PWA offline
├── manifest.json           # Configuración PWA
├── logo_raw.png            # Logo de la app
├── data.json               # Datos de ejemplo (8MB+)
│
├── modules/                # 🆕 Módulos reutilizables
│   ├── security.js         # Validación y sanitización
│   ├── data.js             # Gestión de datos
│   ├── utils.js            # Funciones auxiliares
│   ├── excel.js            # Procesamiento de Excel
│   ├── statistics.js       # Cálculos estadísticos
│   └── export.js           # Exportación de datos
│
├── docs/                   # 📚 Documentación
│   ├── API.md              # Referencia de funciones
│   ├── CONTRIBUTING.md     # Guía de contribución
│   └── TROUBLESHOOTING.md  # Solución de problemas
│
└── tests/                  # 🧪 Tests unitarios
    ├── security.test.js
    ├── utils.test.js
    └── statistics.test.js
```

## 🔧 Dependencias

### Externas (CDN)
- **SheetJS (XLSX)**: Procesamiento de Excel
- **Chart.js**: Gráficos interactivos
- **Lucide Icons**: Iconografía
- **Fonts**: Google Fonts (Inter)

### Sin dependencias NPM
✅ Proyecto vanilla JavaScript - sin `node_modules`

## 💾 Almacenamiento de Datos

### IndexedDB (Navegador)
Los datos se guardan automáticamente en la base de datos local:
- Base: `SalesDB_Tucuman_v1`
- Store: `salesStore`
- Capacidad: ~50MB por dominio
- Acceso: Completamente offline

### Sincronización Remota
- Intenta cargar `data.json` al iniciar
- Si está disponible, actualiza los datos locales
- Mantiene la versión local si no hay conexión

## 🌐 Modo Offline (PWA)

La app funciona completamente offline:

1. **Primera visita**: Se cachean todos los archivos
2. **Desconexión**: Funcionalidad completa sin internet
3. **Reconexión**: Se sincroniza automáticamente

### Instalar como App
- **Android**: Botón "Instalar" en navegador
- **iOS**: Botón "Compartir" → "Añadir a Inicio"
- **Desktop**: Botón de instalación en navegador

## 🚨 Troubleshooting

### Los datos no se cargan
```javascript
// 1. Verificar que el archivo Excel tiene las columnas correctas
// 2. Verificar que no hay filas vacías al inicio
// 3. Abrir consola (F12) para ver errores
console.log(rawGlobalData); // Ver datos cargados
```

### Modo offline no funciona
```bash
# Service Worker requiere HTTPS o localhost
# Para desarrollo local:
python -m http.server 8000
# Luego: http://localhost:8000
```

### Datos no se guardan
```javascript
// IndexedDB deshabilitado o limite alcanzado
// Solución: Limpiar caché del navegador
// Settings → Privacy → Clear Cookies and Data
```

## 📊 Cálculos y Métricas

### KPIs Mostrados
- **Facturación Total**: Suma de todos los montos
- **Clientes Activos**: Cantidad de clientes únicos
- **Artículos Vendidos**: Suma total de cantidades
- **Vendedor Principal**: Mayor facturación
- **Mejor Cliente**: Mayor gasto individual
- **Producto Estrella**: Mayor cantidad vendida

### Tendencias
- **Comparación mes a mes**: Variación en %
- **Estado de cliente**: Activo, Nuevo, En Baja, Inactivo
- **Análisis de caída**: Detecta productos no comprados

## 🔄 Actualización de Datos

### Opción 1: Cargar manualmente
1. Clic en "Cargar Excel"
2. Selecciona archivo nuevo

### Opción 2: Actualizar desde servidor
1. Sube `data.json` a GitHub
2. La app lo cargará automáticamente al iniciar

### Opción 3: API (Futuro)
```javascript
// En desarrollo
const response = await fetch('/api/sales');
const data = await response.json();
```

## 🎨 Personalización

### Cambiar colores
Edita `styles.css`:
```css
:root {
    --primary: #22c55e;        /* Verde principal */
    --bg-main: #022c22;        /* Fondo oscuro */
    --accent: #facc15;         /* Amarillo */
}
```

### Cambiar vendedores bloqueados
Edita `app.js`:
```javascript
const COMERCIAL_MAPPING = {
    '24': 'MARIANO',
    '36': 'IVAN',
    '17': 'RUBEN'
};
```

### Agregar nuevas vistas
1. Crear sección en `index.html`
2. Agregar funciones de render en `app.js`
3. Incluir en navegación

## 🐛 Problemas Conocidos

| Problema | Estado | Solución |
|----------|--------|----------|
| Archivo Excel muy grande (>10MB) | ⚠️ Lento | Dividir en múltiples archivos |
| Tablas no responsive en mobile | 🔄 En progreso | Mejorar CSS mobile-first |
| Charts sin datos vacía pantalla | ⚠️ UX | Mostrar mensaje "Sin datos" |
| Service Worker antiguo en caché | ⚠️ Raro | Limpiar caché navegador |

## 🤝 Contribuir

Ver [CONTRIBUTING.md](docs/CONTRIBUTING.md) para:
- Cómo hacer fork
- Estándares de código
- Proceso de pull request
- Reportar bugs

## 📝 Licencia

MIT - Libre para usar y modificar

## 📧 Contacto

- **GitHub**: [@marianolamarquevg-droid](https://github.com/marianolamarquevg-droid)
- **Issues**: [Reportar problemas](https://github.com/marianolamarquevg-droid/dashboard-tucuman/issues)

## 🙏 Agradecimientos

- **SheetJS**: Procesamiento de Excel
- **Chart.js**: Visualización de datos
- **Lucide**: Iconografía moderna
- **Google Fonts**: Tipografía

---

**Última actualización**: 2026-05-10

**Versión**: 1.0.0 (Beta)

⭐ Si te es útil, por favor deja una estrella en GitHub