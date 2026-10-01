---
name: vision-masterplan
description: "Master plan de visión, matriz de precios High-Ticket (€) y hoja de ruta estratégica hacia 1M€, 10M€ y 100M€ ARR para Field Construction."
---

# 🚀 Field Construction — Master Plan Estratégico & Hoja de Ruta (1M€, 10M€, 100M€)

## 📌 Visión General y Filosofía High-Ticket (Alex Hormozi Model)
Field Construction es el sistema operativo AI-Native High-Ticket para constructoras, contratistas generales y empresas de reformas en Norteamérica y Europa. 

- **Filosofía**: No competimos por precio ni vendemos software barato a clientes sin presupuesto. Vendemos una solución completa de alto valor que sustituye costes administrativos manuales de 3,000 € a 5,000 €/mes, vendiendo el plan Enterprise a **1,299 €/mes** (ROI directo de 4x a 5x para el cliente).
- **Moneda Base**: Euro (€) para estabilidad desde Italia y expansión global.

---

## 💎 Matriz de Precios High-Ticket (€ EUR)

| Plan | Precio Mensual | Pago Anual (20% Desc.) | Nivel de IA & Autonomía | Límite de Tokens |
| :--- | :--- | :--- | :--- | :--- |
| **Start** | **99 € / mes** | **990 € / año** | IA Guía Básica (Soporte de uso del software) | 100,000 tokens/mes |
| **Pro** | **299 € / mes** | **2,990 € / año** | IA Analista (Consultas de datos y resúmenes en texto) | 800,000 tokens/mes |
| **Executive** | **599 € / mes** | **5,990 € / año** | IA Ejecutora (Acciones en app + Entrega de PDFs en Chat) | 3,000,000 tokens/mes |
| **Enterprise** | **1,299 € / mes** | **12,990 € / año** | Agentes Especializados (CFO, Operaciones, Comunicación) | 10,000,000+ tokens/mes |

---

## 💬 Arquitectura de Captación y Comunicaciones Nativas

1. **URL Pública Única del Negocio**: Cada negocio tiene su enlace (`/c/slug`) para mensajes de WhatsApp Business, Instagram o Web.
2. **Chat Público Interactivo**: Captura datos del lead y del proyecto sin costes de WhatsApp API.
3. **Conversión a Cliente**: El lead pasa a Cliente en el CRM **solo cuando el presupuesto es aprobado y firmado**.
4. **Portal Cliente PWA**: Avance de obra, facturas y chat interno con el negocio.
5. **Toggle "Tomar / Devolver el Control"**:
   - `[🤖 IA ON]`: La IA responde dudas, califica leads y avisa a trabajadores con **mensajes breves, directos y amables (2-3 frases)**.
   - `[👤 IA PAUSADA]`: El administrador toma el control manual del teclado en cualquier momento.

---

## 📋 HOJA DE RUTA ESTRATÉGICA (CHECKLIST DE PROGRESO)

Cualquier modelo de IA (Antigravity, Claude Code, etc.) debe leer esta lista para saber en qué punto se encuentra el proyecto y marcar los pasos completados:

### [x] Fase 0: Cimentación Core y Multi-inquilino (COMPLETADO)
- [x] Autenticación nativa Supabase por OTP de 8 dígitos vía Resend.
- [x] Paridad multi-idioma 1:1 en Español, Inglés, Francés e Italiano (`es.json`, `en.json`, `fr.json`, `it.json`).
- [x] Motor de presupuestos, proyectos, clientes y fichajes con GPS.
- [x] Motor de cálculo de horas extras y nóminas en PDF (`workTime.ts`, `documents.ts`).
- [x] Cobros integrados con Stripe y envíos por WhatsApp.
- [x] Maquetación móvil encuadrada sin scroll nativo y safe-area insets para iOS standalone PWA.

---

### 📍 Estado real a 1 de octubre de 2026

Lo construido desde la Fase 0, para que nadie lo vuelva a planificar:

- [x] Stripe mudado a la cuenta española (`acct_1UJxtKQ1ch2EiV8e`): suscripciones y Connect funcionando; cuentas conectadas canadienses.
- [x] Pantalla **Cobrar**: QR, enlace de pago y lector de tarjetas (Stripe Terminal) para el cliente que está delante.
- [x] **País del negocio** elegido al darse de alta (detectado por zona horaria): Canadá, Italia (en pruebas) u otro país (entra, con su moneda, sin facturas hasta configurar su impuesto).
- [x] **Italia, fase 1**: EUR, IVA 22/10/4 % e inversione contabile (N6.3), Partita IVA y codice fiscale validados, PDFs con IVA.
- [x] Todo el producto según el país: bot de ayuda, portal del cliente, correos, menú (sin Nómina, Cobrar ni QuickBooks fuera de Canadá). País e idioma independientes.
- [x] **MCP de solo lectura** en producción (18 herramientas, OAuth 2.1, por rol y plan), conectado a Claude.
- [ ] La IA **no va dentro del producto**: se decidió que la IA es la del cliente (Claude) conectada por MCP, y que dentro hay un bot de ayuda sin modelo. Los puntos de la Fase 1 sobre `FloatingAssistant.tsx`, Function Calling y `ai_usage_logs` quedan sustituidos por la Pista MCP de abajo.
- [ ] ⚠️ **Precios por decidir**: esta hoja dice 99/299/599/1.299 €; el producto vende hoy Chantier 99 CAD y Entreprise 249 CAD (`shared/planes.ts`), y para Italia se propusieron 79 € y 199 €. Hay que elegir una sola matriz antes de abrir Italia.

### [ ] Pista MCP: el producto hablado (EN CURSO)
Detalle en `docs/desarrollo/plan-maestro-mcp.md`, sección 11.
- [x] Lectura segura por rol, plan y negocio.
- [x] **Fase A**: el MCP sabe el país (moneda, impuesto, catálogo filtrado), lee presupuestos y clientes, y calcula impuestos sin escribir nada.
- [ ] **Fase B**: crear hablando, siempre borrador + confirmación del propietario: presupuesto, factura, cobro, envío.
- [ ] **Fase C**: lo de cada país — Italia (FatturaPA/SDI, bonifico parlante, congruità, vencimientos, SAL); Canadá (informe CCQ, resumen TPS/TVQ, holdback liberable).

### [ ] Pista Italia
Detalle en `docs/funciones/italia.md` y `docs/desarrollo/competencia-italia.md`.
- [x] Fase 1: país, EUR e IVA.
- [ ] Fase 2: XML FatturaPA descargable (Italia sale de pruebas aquí).
- [ ] Fase 3: Stripe en euros y precios italianos.
- [ ] Fase 4: PDFs, textos, web y legales UE.
- [ ] Fase 5: envío directo al SDI.
- [ ] Fases 6-9: bonus edilizi y bonifico parlante, vencimientos (DURC, patente a crediti, cursos), congruità, computo con prezzario y SAL.

### [ ] Siguientes países
- [ ] España: IVA, inversión del sujeto pasivo y **Verifactu** (sociedades 1-1-2027, autónomos 1-7-2027).
- [ ] Francia: TVA, autoliquidation y **Factur-X** (emisión de la pyme 1-9-2027).

### [ ] Fase 1: Prueba V1 en Montreal & Inyección Inmediata de IA (SIGUIENTE PASO - EN CURSO)
- [ ] Desplegar la V1 operativa en terreno con el amigo en Montreal (Canadá).
- [ ] Validar la captación de leads por enlace público y la generación de presupuestos en terreno.
- [ ] **Inyección Inmediata de IA**: Tan pronto como la V1 esté probada y funcionando con el amigo, iniciar de inmediato la integración de los Agentes de IA y los Planes High-Ticket (€99, €299, €599, €1,299/mes).
- [ ] Conectar el chat flotante (`FloatingAssistant.tsx`) con Function Calling (Herramientas de servidor).
- [ ] Implementar la entrega de PDFs descargables (nóminas y presupuestos) dentro de la ventana de chat.
- [ ] Implementar el botón **"Tomar / Devolver el Control"** en los chats nativos de Leads, Clientes y Trabajadores.
- [ ] Crear la tabla de telemetría de tokens (`ai_usage_logs`) y cuotas diarias/semanales por plan.

---

### [ ] Fase 3: Escalado Comercial High-Ticket — 1.000.000 € ARR (Hito 1M€)
- [ ] Captar los primeros **65 Clientes Enterprise (1,299 €/mes)** o combinación equivalente.
- [ ] Embudo de ventas B2B para "Peces Gordos" (demostraciones directas con ROI de 4x).
- [ ] Consolidar posición en Canadá (Montreal/Québec) e Italia / Europa Occidental.

---

### [ ] Fase 4: Expansión de Agentes Especializados — 10.000.000 € ARR (Hito 10M€)
- [ ] Desplegar la Suite de Agentes Especializados (Agente CFO Financiero, Agente de Operaciones, Agente de Comunicación).
- [ ] Captar **641 Clientes Enterprise** o 2,000 clientes en la combinación de planes.
- [ ] Construir equipo de ventas B2B High-Ticket en EE.UU., Reino Unido y Europa.

---

### [ ] Fase 5: Liderazgo Global — 100.000.000 € ARR (Hito 100M€)
- [ ] Alcanzar **6,415 Clientes Enterprise** o 20,000 pymes globales de construcción.
- [ ] Ecosistema de integraciones B2B, Mercado de Skills para Contratistas y Financiamiento de Obras.

---

## 📄 Recursos Adjuntos
- Documento PDF Ejecutivo Completo: `.agents/skills/vision-masterplan/resources/FIELD_CONSTRUCTION_MASTER_PLAN.pdf`
