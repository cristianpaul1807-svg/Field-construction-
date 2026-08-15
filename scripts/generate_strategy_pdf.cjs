const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function createStrategyPDF(outputPath) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: {
      Title: "Field Construction - Master Plan de Crecimiento (1M, 10M, 100M €)",
      Author: "Field Construction AI & Executive Team",
      Subject: "Estrategia High-Ticket y Hoja de Ruta de Facturación",
    },
  });

  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  const colors = {
    primary: "#0F172A", // Dark Slate
    accent: "#2563EB",  // Royal Blue
    success: "#059669", // Emerald Green
    text: "#334155",    // Muted Slate
    bgLight: "#F8FAFC", // Light Grey
    border: "#E2E8F0",
  };

  // Helper Header
  function drawHeader(title) {
    doc.fillColor(colors.primary).fontSize(20).font("Helvetica-Bold").text(title);
    doc.moveDown(0.3);
    doc.strokeColor(colors.accent).lineWidth(2).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);
  }

  // Footer Helper
  function drawFooter(pageNumber, totalPages = 5) {
    doc.fontSize(8).fillColor("#94A3B8").font("Helvetica")
      .text(`Field Construction © 2026 — Documento de Estrategia Confidencial | Página ${pageNumber} de ${totalPages}`, 40, 800, {
        align: "center",
        width: 515,
      });
  }

  // ==================== PÁGINA 1: PORTADA Y VISIÓN ====================
  doc.rect(40, 40, 515, 760).fillAndStroke("#0F172A", "#0F172A");

  doc.fillColor("#FFFFFF").fontSize(32).font("Helvetica-Bold").text("FIELD CONSTRUCTION", 60, 180, { align: "center" });
  doc.fillColor("#60A5FA").fontSize(18).font("Helvetica").text("MASTER PLAN ESTRATÉGICO DE CRECIMIENTO", { align: "center" });
  doc.moveDown(0.5);
  doc.fillColor("#94A3B8").fontSize(12).text("De la V1 Operativa a la Escala Global (1M€ → 10M€ → 100M€ ARR)", { align: "center" });

  // Divider box
  doc.rect(80, 320, 435, 2).fill("#2563EB");

  doc.fillColor("#E2E8F0").fontSize(11).font("Helvetica").text(
    "Filosofía High-Ticket (Alex Hormozi Model):\n" +
    "No competimos por precio en el mercado bajo. Construimos el sistema AI-Native más potente y sencillo del mundo para constructoras y contratistas de alto margen, vendiendo soluciones completas con un ROI inmediato.",
    90,
    360,
    { align: "center", width: 415, lineGap: 6 }
  );

  doc.rect(100, 560, 395, 140).fillAndStroke("#1E293B", "#334155");
  doc.fillColor("#38BDF8").fontSize(13).font("Helvetica-Bold").text("RESUMEN DE METAS DE FACTURACIÓN", 120, 580, { align: "center", width: 355 });
  doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica")
    .text("• Hito 1 (1M€ ARR): 65 Clientes Enterprise a 1,299€/mes", 120, 610)
    .text("• Hito 2 (10M€ ARR): 641 Clientes Enterprise o 2,000 en mezcla de planes", 120, 635)
    .text("• Hito 3 (100M€ ARR): 6,415 Clientes Enterprise o 20,000 pymes globales", 120, 660);

  doc.fillColor("#64748B").fontSize(9).text("Documento Estratégico Preparado para: Cristian & Equipo Ejecutivo | Italia - Canadá - Global", 40, 760, { align: "center", width: 515 });

  // ==================== PÁGINA 2: MATRIZ DE PRECIOS HIGH-TICKET ====================
  doc.addPage();
  drawHeader("1. Matriz de Precios y Posicionamiento High-Ticket (€)");

  doc.fillColor(colors.text).fontSize(10).font("Helvetica").text(
    "Fijamos el Euro (€) como moneda base de facturación para garantizar estabilidad desde Italia y expansión internacional. La estrategia de precios se basa en el Nivel de Autonomía de la IA:",
    { lineGap: 4 }
  );
  doc.moveDown(1);

  // Plan 1
  doc.rect(40, doc.y, 515, 85).fillAndStroke("#F8FAFC", "#E2E8F0");
  let y = doc.y + 10;
  doc.fillColor(colors.primary).fontSize(12).font("Helvetica-Bold").text("Plan START — 99 € / mes  (990 € / año)", 55, y);
  doc.fillColor(colors.accent).fontSize(9).font("Helvetica-Bold").text("Core de Software + IA Guía Básica", 380, y, { align: "right", width: 160 });
  doc.fillColor(colors.text).fontSize(9).font("Helvetica").text(
    "Para independientes. Gestión de presupuestos, proyectos, clientes y fichaje de trabajadores. IA Guía de soporte (responde dudas de uso del software sin leer datos de negocio ni generar archivos).",
    55, y + 20, { width: 485, lineGap: 3 }
  );

  // Plan 2
  doc.moveDown(2.5);
  doc.rect(40, doc.y, 515, 85).fillAndStroke("#F1F5F9", "#CBD5E1");
  y = doc.y + 10;
  doc.fillColor(colors.primary).fontSize(12).font("Helvetica-Bold").text("Plan PRO — 299 € / mes  (2,990 € / año)", 55, y);
  doc.fillColor(colors.accent).fontSize(9).font("Helvetica-Bold").text("IA Analista de Datos", 380, y, { align: "right", width: 160 });
  doc.fillColor(colors.text).fontSize(9).font("Helvetica").text(
    "Para pequeñas pymes (2-5 trabajadores). Incluye cobros con Stripe. IA Analista que realiza consultas a la base de datos en tiempo real y ofrece resúmenes ejecutivos en texto (impagados, horas acumuladas, balance de obras).",
    55, y + 20, { width: 485, lineGap: 3 }
  );

  // Plan 3
  doc.moveDown(2.5);
  doc.rect(40, doc.y, 515, 95).fillAndStroke("#EFF6FF", "#BFDBFE");
  y = doc.y + 10;
  doc.fillColor(colors.primary).fontSize(12).font("Helvetica-Bold").text("Plan EXECUTIVE — 599 € / mes  (5,990 € / año)", 55, y);
  doc.fillColor(colors.accent).fontSize(9).font("Helvetica-Bold").text("IA Ejecutora & Entrega de PDFs", 360, y, { align: "right", width: 180 });
  doc.fillColor(colors.text).fontSize(9).font("Helvetica").text(
    "Para empresas en crecimiento (5-15 trabajadores). La IA ejecuta acciones reales dentro de la app (crear proyectos, modificar estados) y genera y entrega PDFs descargables (nóminas con horas extras, presupuestos) directamente dentro del chat flotante.",
    55, y + 20, { width: 485, lineGap: 3 }
  );

  // Plan 4
  doc.moveDown(2.8);
  doc.rect(40, doc.y, 515, 115).fillAndStroke("#FEF3C7", "#FDE68A");
  y = doc.y + 10;
  doc.fillColor("#92400E").fontSize(13).font("Helvetica-Bold").text("Plan ENTERPRISE / AI SUITE — 1,299 € / mes  (12,990 € / año)", 55, y);
  doc.fillColor("#B45309").fontSize(9).font("Helvetica-Bold").text("Agentes Especializados por Módulo", 350, y, { align: "right", width: 190 });
  doc.fillColor("#78350F").fontSize(9).font("Helvetica").text(
    "Para constructoras consolidadas (15+ trabajadores). Incluye 3 Agentes Especializados:\n" +
    "1. Agente CFO Financiero: Cálculo de márgenes reales, desviación de costes e impuestos.\n" +
    "2. Agente de Operaciones: Monitoreo de equipo, cálculo automático de horas extras y tareas.\n" +
    "3. Agente de Comunicación: Redacción corporativa y gestión de chats nativos con botón 'Tomar/Devolver el Control'.\n" +
    "4. Guardado de Skills Reutilizables de 1 clic.",
    55, y + 22, { width: 485, lineGap: 3 }
  );

  drawFooter(2);

  // ==================== PÁGINA 3: ARQUITECTURA DE CHAT NATIVO Y LEADS ====================
  doc.addPage();
  drawHeader("2. Arquitectura de Captación y Chat Nativo");

  doc.fillColor(colors.text).fontSize(10).font("Helvetica").text(
    "Para garantizar la máxima rentabilidad y eliminar costes recurrentes de APIs de terceros (como WhatsApp API), Field Construction opera con un sistema de comunicación nativo integrado en la PWA:",
    { lineGap: 4 }
  );
  doc.moveDown(1);

  doc.fillColor(colors.primary).fontSize(12).font("Helvetica-Bold").text("A. Captación por URL Pública Única del Negocio");
  doc.fillColor(colors.text).fontSize(9.5).font("Helvetica").text(
    "Cada negocio recibe una URL personalizada (ej. domain.com/c/nombre-negocio) que el dueño coloca en su mensaje de bienvenida de WhatsApp Business, Instagram o Web. El cliente o prospecto hace clic e ingresa directamente a nuestro Chat Público Interactivo.",
    { lineGap: 4 }
  );
  doc.moveDown(1);

  doc.fillColor(colors.primary).fontSize(12).font("Helvetica-Bold").text("B. Conversión de Lead a Cliente");
  doc.fillColor(colors.text).fontSize(9.5).font("Helvetica").text(
    "El Chat Público hace las preguntas automáticas (Nombre, Teléfono, Ubicación, Descripción de Obra) para estructurar el presupuesto. El usuario NO se convierte en Cliente en el CRM hasta que el presupuesto es aprobado y firmado digitalmente.",
    { lineGap: 4 }
  );
  doc.moveDown(1);

  doc.fillColor(colors.primary).fontSize(12).font("Helvetica-Bold").text("C. Portal Cliente PWA & Chat Interno con Toggle IA");
  doc.fillColor(colors.text).fontSize(9.5).font("Helvetica").text(
    "Una vez aprobado el presupuesto, el cliente recibe acceso a su Portal PWA para seguir el avance de la obra. En los planes Executive y Enterprise, la IA puede gestionar las conversaciones con una regla estricta: mensajes breves, directos y amables (2 a 3 frases máximo).",
    { lineGap: 4 }
  );
  doc.moveDown(1);

  // Box del Toggle
  doc.rect(40, doc.y, 515, 80).fillAndStroke("#F8FAFC", "#E2E8F0");
  y = doc.y + 12;
  doc.fillColor(colors.primary).fontSize(11).font("Helvetica-Bold").text("Control Total para el Administrador: Botón 'Tomar / Devolver el Control'", 55, y);
  doc.fillColor(colors.text).fontSize(9).font("Helvetica").text(
    "El panel cuenta con un interruptor visual en cada chat:\n" +
    "• [🤖 IA ON]: La IA atiende dudas de clientes, califica leads o informa a trabajadores.\n" +
    "• [👤 IA PAUSADA]: El administrador toma el control manual del teclado en cualquier momento.",
    55, y + 20, { width: 485, lineGap: 4 }
  );

  drawFooter(3);

  // ==================== PÁGINA 4: HOJA DE RUTA HACIA 1M€, 10M€ Y 100M€ ====================
  doc.addPage();
  drawHeader("3. Hoja de Ruta Financiera: De 1M€ a 100M€ ARR");

  // Hito 1M
  doc.rect(40, doc.y, 515, 110).fillAndStroke("#ECFDF5", "#A7F3D0");
  y = doc.y + 12;
  doc.fillColor("#065F46").fontSize(14).font("Helvetica-Bold").text("HITO 1: 1.000.000 € ARR (1M€ — Validación & Tracción)", 55, y);
  doc.fillColor("#047857").fontSize(9.5).font("Helvetica").text(
    "• Meta de Clientes: Solo 65 clientes Enterprise (1,299€/mes) = 1,013,220 € / año.\n" +
    "  (O una mezcla de 100 clientes Pro + 30 Executive + 25 Enterprise).\n" +
    "• Enfoque de Mercado: Lanzamiento en Montreal, Canadá (validación con tu amigo) + Expansión inicial en Italia y Europa.\n" +
    "• Objetivo Clave: Alcanzar el ajuste producto-mercado (Product-Market Fit) con contratistas de alto margen.",
    55, y + 24, { width: 485, lineGap: 4 }
  );

  // Hito 10M
  doc.moveDown(3.2);
  doc.rect(40, doc.y, 515, 110).fillAndStroke("#EFF6FF", "#BFDBFE");
  y = doc.y + 12;
  doc.fillColor("#1E40AF").fontSize(14).font("Helvetica-Bold").text("HITO 2: 10.000.000 € ARR (10M€ — Escalado del Modelo)", 55, y);
  doc.fillColor("#1D4ED8").fontSize(9.5).font("Helvetica").text(
    "• Meta de Clientes: 641 clientes Enterprise (1,299€/mes) o ~2,000 clientes en la combinación de planes.\n" +
    "• Enfoque de Mercado: Expansión agresiva en Norteamérica (Canadá y EE.UU.) y Europa Occidental (Italia, España, Francia).\n" +
    "• Equipo: Estructuración de equipo de ventas B2B High-Ticket (demostraciones directas 1 a 1 para contratistas medianos).",
    55, y + 24, { width: 485, lineGap: 4 }
  );

  // Hito 100M
  doc.moveDown(3.2);
  doc.rect(40, doc.y, 515, 115).fillAndStroke("#F5F3FF", "#DDD6FE");
  y = doc.y + 12;
  doc.fillColor("#5B21B6").fontSize(14).font("Helvetica-Bold").text("HITO 3: 100.000.000 € ARR (100M€ — Liderazgo Global)", 55, y);
  doc.fillColor("#6D28D9").fontSize(9.5).font("Helvetica").text(
    "• Meta de Clientes: 6,415 clientes Enterprise (1,299€/mes) o ~20,000 pymes globales de construcción.\n" +
    "• Ecosistema Global: Consolidación como el sistema operativo estándar de la construcción.\n" +
    "• Servicios Adicionales: Mercado de Skills de IA creadas por contratistas, financiamiento integrado de obras y compras de materiales en volumen.",
    55, y + 24, { width: 485, lineGap: 4 }
  );

  drawFooter(4);

  // ==================== PÁGINA 5: PLAN DE ACCIÓN PASO A PASO ====================
  doc.addPage();
  drawHeader("4. Plan de Acción Inmediato (Paso a Paso)");

  doc.fillColor(colors.text).fontSize(10).font("Helvetica").text(
    "Para ejecutar este plan estratégico sin dispersar recursos, seguimos un orden riguroso de 4 pasos:",
    { lineGap: 4 }
  );
  doc.moveDown(1);

  const steps = [
    {
      num: "PASO 1",
      title: "Prueba Operativa V1 en Montreal (Canadá)",
      desc: "Desplegar la V1 con tu amigo en Montreal. Validar en terreno real la usabilidad de presupuestos, proyectos, nóminas y la captación por URL pública. Recopilar datos reales de uso sin IA aún.",
    },
    {
      num: "PASO 2",
      title: "Diseño de Skills y Prompts de IA Especializados",
      desc: "Con los datos de uso de la V1, identificar las 3 tareas que más tiempo consumen (nóminas con extras, cálculo de márgenes, avisos a clientes) y programar las herramientas de IA (Function Calling).",
    },
    {
      num: "PASO 3",
      title: "Lanzamiento de la V2 con Motor de IA & Resend/Supabase",
      desc: "Activar el chat flotante de IA con entrega de PDFs en chat, telemetría de tokens en la base de datos y la función 'Tomar/Devolver el Control' en los chats nativos.",
    },
    {
      num: "PASO 4",
      title: "Estrategia de Ventas High-Ticket B2B",
      desc: "Lanzamiento comercial enfocado en 'Peces Gordos' (empresas con presupuesto). Presentar el software no como una herramienta, sino como una solución de sustitución de costes administrativos con ROI de 4x.",
    },
  ];

  steps.forEach((step, index) => {
    y = doc.y;
    doc.rect(40, y, 50, 45).fillAndStroke(colors.primary, colors.primary);
    doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold").text(step.num, 42, y + 16, { align: "center", width: 46 });

    doc.fillColor(colors.primary).fontSize(11).font("Helvetica-Bold").text(step.title, 105, y);
    doc.fillColor(colors.text).fontSize(9).font("Helvetica").text(step.desc, 105, y + 16, { width: 440, lineGap: 3 });

    doc.moveDown(1.8);
  });

  doc.moveDown(1);
  doc.rect(40, doc.y, 515, 60).fillAndStroke("#F1F5F9", "#94A3B8");
  y = doc.y + 12;
  doc.fillColor(colors.primary).fontSize(11).font("Helvetica-Bold").text("Compromiso Técnico y de Producto", 55, y);
  doc.fillColor(colors.text).fontSize(9).font("Helvetica").text(
    "Toda la arquitectura del código fuente está construida respetando la modularidad, el aislamiento multi-inquilino y la paridad multi-idioma (ES, EN, FR, IT). Listo para la fase de ejecución.",
    55, y + 20, { width: 485 }
  );

  drawFooter(5);

  doc.end();
}

const targetPath = path.join(__dirname, "../docs/FIELD_CONSTRUCTION_MASTER_PLAN.pdf");
createStrategyPDF(targetPath);
console.log("PDF generado exitosamente en:", targetPath);
