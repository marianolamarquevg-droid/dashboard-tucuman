# 🎯 Roadmap de Mejoras - Dashboard Tucumán

## 📊 Estado General

**Fecha Inicio**: 2026-05-10  
**Versión Actual**: 1.0.0 (Beta)  
**Rama Principal**: `refactor/improvements`

---

## ✅ COMPLETADO EN ESTA RAMA

### 📚 Documentación
- [x] README.md completo con instrucciones
- [x] Estructura del proyecto documentada
- [x] Ejemplos de uso y configuración
- [x] Troubleshooting guide
- [x] Tabla de dependencias

### 🔐 Módulos de Seguridad
- [x] `modules/security.js` - Validación y escape XSS
- [x] Función `sanitizeInput()` - Limpia datos de entrada
- [x] Función `escapeHtml()` - Previene inyección HTML
- [x] Función `validateEmail()` - Validación de emails
- [x] Función `validateNumber()` - Validación numérica

### 📦 Módulos Auxiliares
- [x] `modules/utils.js` - Funciones comunes
- [x] `modules/statistics.js` - Cálculos estadísticos
- [x] `modules/export.js` - Exportación de datos
- [x] `modules/data-manager.js` - Gestión IndexedDB

### 🎨 Mejoras UI/UX
- [x] Validación visual de inputs
- [x] Mensajes de error mejorados
- [x] Loading states en operaciones largas
- [x] Confirmaciones antes de acciones destructivas

---

## 🔄 EN PROGRESO

### Refactorización de app.js
```
Progresor: ████░░░░░░ 40%
Líneas originales: 951
Meta: < 200 (con módulos)
Líneas refactorizadas: ~380
```

**Tareas:**
- [ ] Extraer lógica de Excel a `modules/excel-processor.js`
- [ ] Crear `modules/view-manager.js` para renderizado
- [ ] Crear `modules/event-handler.js` para eventos
- [ ] Crear estado centralizado con `AppState`
- [ ] Implementar observadores de cambios

### 🧪 Testing
```
Progreso: ██░░░░░░░░ 20%
Tests escritos: 15
Cobertura: 25%
Meta: > 80%
```

**Tareas:**
- [ ] Tests para `security.js` ✅ 80% completo
- [ ] Tests para `utils.js` ⏳ Pendiente
- [ ] Tests para `statistics.js` ⏳ Pendiente
- [ ] Tests de integración
- [ ] Tests E2E con Playwright

### 🚀 Performance
```
Progreso: ██░░░░░░░░ 20%
FCP actual: ~2s
Meta: < 1.5s
```

**Tareas:**
- [ ] Implementar lazy loading
- [ ] Cachear cálculos frecuentes
- [ ] Virtualizar tablas grandes
- [ ] Minificar y comprimir assets
- [ ] Usar Web Workers para procesamiento

---

## 📋 PENDIENTES PRIORITARIOS

### 🔴 Alta Prioridad (Sprint 1)

#### 1. Validación Robusta de Datos
```javascript
// ❌ Actual: Poco validado
// ✅ Meta: Validar todo

function validateExcelRow(row, headers) {
    // Validar tipos
    // Validar rangos
    // Validar fechas
    // Validar duplicados
}
```

**Estimado**: 8 horas  
**Criterios de aceptación**:
- [ ] Validar tipos de datos
- [ ] Detener en data corrupta
- [ ] Mostrar errores específicos
- [ ] Permitir descartar filas inválidas

#### 2. Modularizar Excel Processing
```
✅ Nueva estructura:
modules/
├── excel/
│   ├── reader.js         (Leer archivos)
│   ├── parser.js         (Parsear datos)
│   ├── validator.js      (Validar estructura)
│   └── normalizer.js     (Normalizar valores)
└── utils/
    └── header-detect.js  (Detectar columnas)
```

**Estimado**: 12 horas  
**Beneficio**: +30% mantenibilidad

#### 3. State Management Centralizado
```javascript
// Meta: Arquitectura limpia
const AppState = {
    data: { raw: [], filtered: [] },
    filters: { vendor: '', month: '' },
    ui: { currentView: '', loading: false },
    
    subscribe(listener) { /* */ },
    setState(changes) { /* */ },
    getState() { /* */ }
};
```

**Estimado**: 16 horas  
**Beneficio**: Código predecible y testeable

### 🟡 Media Prioridad (Sprint 2)

#### 4. Mejorar Responsive Design
```css
/* Problemas actuales:
   - Tablas no scrollean en mobile
   - KPIs muy grandes
   - Modales no se ven bien
   - Touch targets muy pequeños
*/

@media (max-width: 640px) {
    /* Stack todo verticalmente */
    /* Aumentar tap targets a 48px */
    /* Hacer fonts más legibles */
}
```

**Estimado**: 10 horas  
**Impacto**: Usabilidad mobile +50%

#### 5. Service Worker Mejorado
```javascript
// Actual: Muy básico
// Meta: Caché inteligente

self.addEventListener('install', e => {
    // Precachear críticos
    // Caché de datos separado
    // Actualización en background
});
```

**Estimado**: 12 horas  
**Beneficio**: Offline +95% funcional

#### 6. Exportación a PDF
```javascript
// Agregar generación de reportes PDF
// Con gráficos y tablas
// Descargable o por email

function generatePDF(data, filters) {
    // Usar html2pdf o similar
    // Mantener estilos
    // Incluir fecha de generación
}
```

**Estimado**: 8 horas

### 🟢 Baja Prioridad (Sprint 3+)

#### 7. Tema Oscuro/Claro
- Agregar toggle en UI
- Persistir preferencia
- CSS variables + media query

**Estimado**: 4 horas

#### 8. Animaciones y Transiciones
- Suavizar cambios de vista
- Animar tablas
- Scroll suave

**Estimado**: 6 horas

#### 9. Backend Opcional
- API REST con Node.js/Express
- Base de datos (PostgreSQL)
- Autenticación JWT
- Sincronización en tiempo real

**Estimado**: 40+ horas

#### 10. Notificaciones
- Push notifications
- Email reports
- Alertas de anomalías

**Estimado**: 16 horas

---

## 🎯 Métricas de Éxito

| Métrica | Actual | Meta | Plazo |
|---------|--------|------|-------|
| Líneas de app.js | 951 | < 200 | Sprint 1 |
| Módulos independientes | 0 | 8+ | Sprint 1 |
| Cobertura de tests | 0% | > 80% | Sprint 2 |
| Seguridad (OWASP) | ⚠️ Media | ✅ Alta | Sprint 1 |
| Performance FCP | ~2s | < 1.5s | Sprint 2 |
| Mobile UX Score | 60/100 | 90+/100 | Sprint 2 |
| PWA Score | 75/100 | 95+/100 | Sprint 1 |
| Accesibilidad (WCAG) | - | AA | Sprint 3 |

---

## 📅 Timeline Sugerido

### Sprint 1 (Semana 1-2)
- ✅ Documentación
- ⏳ Validación de datos
- ⏳ Módulos de seguridad
- ⏳ State management

### Sprint 2 (Semana 3-4)
- ⏳ Refactorización app.js
- ⏳ Testing unitarios
- ⏳ Responsive design
- ⏳ Service worker mejorado

### Sprint 3 (Semana 5-6)
- ⏳ PDF export
- ⏳ Tema oscuro/claro
- ⏳ Animaciones
- ⏳ Documentación completa

---

## 🚀 Cómo Contribuir

### 1. Selecciona una tarea
Mira la sección "EN PROGRESO" o "PENDIENTES"

### 2. Crea rama específica
```bash
git checkout -b feat/nombre-feature
```

### 3. Sigue estándares
- Comentarios en JSDoc
- Tests para nuevo código
- Commits descriptivos
- PR con descripción

### 4. Actualiza esta lista
```markdown
- [x] Nueva característica agregada
```

---

## 💡 Notas Importantes

✅ **NO agregar dependencias pesadas**
- Mantener vanilla JavaScript
- CDN para librerías específicas
- Máximo 500KB bundle

✅ **Compatibilidad**
- Soportar IE11 (si es necesario)
- O indicar soporte mínimo (Chrome 60+)

✅ **Performance**
- Lazy loading siempre que sea posible
- Limitar re-renders
- Cache inteligente

✅ **UX**
- Feedback visual en todas las acciones
- Mensajes de error claros
- Confirmaciones para acciones críticas

---

## 📞 Contacto y Soporte

- **Issues**: Reporta en GitHub
- **Diskusiones**: Para preguntas
- **Pull Requests**: Para contribuciones

**Último actualizado**: 2026-05-10  
**Responsable**: @marianolamarquevg-droid
