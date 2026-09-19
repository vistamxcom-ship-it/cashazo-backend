/**
 * ════════════════════════════════════════════════════════════
 * CASHAZO - BACKEND NOTIFICACIONES + ALMACENAMIENTO
 * ════════════════════════════════════════════════════════════
 * 
 * QUE HACE:
 * - Recibe solicitudes del frontend
 * - Guarda los datos en Supabase Database
 * - Sube documentos a Supabase Storage
 * - Genera URLs firmadas para descargar archivos
 * 
 * INSTALAR DEPENDENCIAS:
 * npm install
 * 
 * CORRER LOCAL:
 * npm start       (producción)
 * npm run dev     (con nodemon, recarga automática)
 * 
 * DEPLOYED EN:
 * Render.com - auto-redeploy cuando haces push a GitHub
 * 
 * ════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════
// 1. IMPORTAR LIBRERÍAS
// ═══════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ═══════════════════════════════════════════════════════════
// 2. VARIABLES DE ENTORNO (.env)
// ═══════════════════════════════════════════════════════════
// 
// IMPORTANTE: Estas variables se cargan del archivo .env
// En Render, configúralas en: Settings → Environment
// 
// NUEVO SUPABASE (actualizado):
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ocietbqwmhvaxgpggifb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jaWV0YnF3bWh2YXhncGdnaWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDgwNjAsImV4cCI6MjEwNTEyNDA2MH0.pwl-uFBnTyRsfx9JVEQvYyZAsGcN_t3XeO2uhoXz7hM';

// Gmail para notificaciones
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_PASS = process.env.GMAIL_PASS || '';

// Puerto donde corre el servidor
const PORT = process.env.PORT || 3002;

// ═══════════════════════════════════════════════════════════
// 3. INICIALIZAR SUPABASE
// ═══════════════════════════════════════════════════════════
// 
// createClient(url, key) → conecta con tu proyecto Supabase
// Las credenciales vienen del .env
//
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔧 Inicializando Supabase...');
console.log(`   URL: ${SUPABASE_URL.substring(0, 30)}...`);

// ═══════════════════════════════════════════════════════════
// 4. INICIALIZAR EXPRESS
// ═══════════════════════════════════════════════════════════

const app = express();

// MIDDLEWARE: Permite CORS (solicitudes desde cualquier origen)
app.use(cors());

// MIDDLEWARE: Parse JSON grande (hasta 100MB)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ═══════════════════════════════════════════════════════════
// 5. CONFIGURAR MULTER (para subir archivos)
// ═══════════════════════════════════════════════════════════
// 
// multer guarda archivos en memoria (memoryStorage)
// Límite: 100MB por archivo
//
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB máximo
});

// ═══════════════════════════════════════════════════════════
// 6. KEEP-ALIVE: Auto-ping para Render
// ═══════════════════════════════════════════════════════════
// 
// PROBLEMA: Render pone en "sleep" los servidores inactivos
// SOLUCIÓN: Cada 5 minutos hacemos ping a /health
// Así Render ve que estamos activos y no nos duerme
//
setInterval(() => {
  fetch(`http://localhost:${PORT}/health`)
    .then(() => console.log('💚 Keep-alive ping enviado'))
    .catch(() => {}); // Ignorar errores
}, 5 * 60 * 1000); // 5 minutos

// ═══════════════════════════════════════════════════════════
// 7. ENDPOINT PRINCIPAL: POST /api/solicitud
// ═══════════════════════════════════════════════════════════
// 
// QUE HACE:
// 1. Recibe solicitud + archivos del frontend
// 2. Sube archivos a Supabase Storage
// 3. Guarda datos en tabla "solicitudes" de Supabase
// 4. Devuelve folio + URLs de archivos
//
app.post('/api/solicitud', upload.any(), async (req, res) => {
  try {
    console.log(`\n📥 NUEVA SOLICITUD RECIBIDA`);
    console.log(`════════════════════════════════════════════════════════════`);
    
    // ─────────────────────────────────────────────────────
    // 7.1 LOGS: Ver qué llegó
    // ─────────────────────────────────────────────────────
    console.log(`   📊 Archivos: ${req.files ? req.files.length : 0}`);
    console.log(`   📋 Campos: ${Object.keys(req.body).join(', ')}`);
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(f => {
        console.log(`      📄 ${f.fieldname}: ${f.originalname} (${(f.size / 1024).toFixed(2)}KB)`);
      });
    }

    // ─────────────────────────────────────────────────────
    // 7.2 GENERAR FOLIO (código único para esta solicitud)
    // ─────────────────────────────────────────────────────
    // Formato: CZ-[timestamp]
    // Ejemplo: CZ-1726762891234
    //
    const folio = req.body.folio || 'CZ-' + Date.now();
    console.log(`   🏷️  Folio asignado: ${folio}`);

    // ─────────────────────────────────────────────────────
    // 7.3 PARSEAR DATOS DE LA SOLICITUD
    // ─────────────────────────────────────────────────────
    // El frontend envía datos en JSON string
    // Intentamos parsear, si falla usamos req.body directo
    //
    let solicitudData;
    try {
      solicitudData = JSON.parse(req.body.dataSolicitud || req.body.data || '{}');
    } catch (e) {
      console.warn('   ⚠️  No se pudo parsear JSON, usando req.body');
      solicitudData = req.body;
    }

    // ─────────────────────────────────────────────────────
    // 7.4 ARMAR OBJETO DE SOLICITUD
    // ─────────────────────────────────────────────────────
    // Estructura completa con todos los datos del formulario
    //
    const solicitud = {
      folio: folio,
      timestamp: new Date().toISOString(),        // Fecha/hora creación
      solicitante: solicitudData.solicitante || {},
      credito: solicitudData.credito || {},
      ubicacion: solicitudData.ubicacion || {},
      referencias: solicitudData.referencias || {},
      documentos: {},                              // Se llena abajo ↓
      aceptaciones: solicitudData.aceptaciones || {},
      estado: 'nueva'
    };

    console.log(`   ✅ Datos de solicitud armados`);

    // ─────────────────────────────────────────────────────
    // 7.5 SUBIR ARCHIVOS A SUPABASE STORAGE
    // ─────────────────────────────────────────────────────
    // 
    // Para cada archivo:
    // 1. Subir a bucket "Cashazo Documento"
    // 2. Generar URL firmada (válida 1 hora)
    // 3. Guardar en solicitud.documentos
    //
    if (req.files && req.files.length > 0) {
      console.log(`\n   📤 Subiendo ${req.files.length} archivo(s) a Storage...`);

      for (const file of req.files) {
        try {
          // Generar nombre único para el archivo
          // Formato: [FOLIO]/[TIPO]-[TIMESTAMP].[EXTENSION]
          // Ejemplo: CZ-123456/INE-1726762891234.pdf
          //
          const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${fileExtension}`;
          
          console.log(`      ⬆️  Subiendo: ${fileName}`);
          
          // PASO 1: Subir archivo a Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('Cashazo Documento')  // Nombre del bucket
            .upload(fileName, file.buffer, {
              contentType: file.mimetype  // Tipo MIME (pdf, image/jpeg, etc)
            });

          if (uploadError) {
            console.error(`      ❌ Error subiendo ${file.fieldname}: ${uploadError.message}`);
            continue;  // Pasar al siguiente archivo
          }

          console.log(`      ✅ Archivo subido correctamente`);

          // PASO 2: Generar URL firmada (privada, válida 1 hora)
          const { data: signedUrlData } = await supabase.storage
            .from('Cashazo Documento')
            .createSignedUrl(fileName, 3600); // 3600 segundos = 1 hora

          // PASO 3: Guardar info del archivo en solicitud
          solicitud.documentos[file.fieldname] = {
            filename: file.originalname,
            url: signedUrlData.signedUrl,
            size: file.size,
            type: file.mimetype,
            expira_en: '1 hora'
          };

          console.log(`      📎 Guardado en solicitud.documentos`);

        } catch (e) {
          console.error(`      ❌ Error procesando ${file.fieldname}: ${e.message}`);
        }
      }
    }

    console.log(`   ✅ ${Object.keys(solicitud.documentos).length} archivo(s) procesado(s)`);

    // ─────────────────────────────────────────────────────
    // 7.6 GUARDAR SOLICITUD EN SUPABASE DATABASE
    // ─────────────────────────────────────────────────────
    // 
    // Inserta el objeto solicitud en la tabla "solicitudes"
    // Si la tabla no existe, esto va a fallar (ver sección 8)
    //
    console.log(`\n   💾 Guardando en Supabase Database...`);

    const { data: dbData, error: dbError } = await supabase
      .from('solicitudes')           // Nombre de la tabla
      .insert([solicitud]);           // Array de registros

    if (dbError) {
      console.error(`      ❌ Error Supabase: ${dbError.message}`);
      return res.status(500).json({ 
        error: `Error guardando en BD: ${dbError.message}` 
      });
    }

    console.log(`      ✅ Solicitud guardada en tabla "solicitudes"`);

    // ─────────────────────────────────────────────────────
    // 7.7 RESPUESTA AL FRONTEND
    // ─────────────────────────────────────────────────────
    // 
    // Devolver folio + resumen de archivos guardados
    //
    console.log(`\n✅ SOLICITUD COMPLETADA`);
    console.log(`════════════════════════════════════════════════════════════\n`);

    res.json({
      success: true,
      mensaje: 'Solicitud guardada correctamente en Supabase',
      folio: folio,
      documentosGuardados: Object.keys(solicitud.documentos).length,
      timestamp: solicitud.timestamp
    });

  } catch (error) {
    console.error('❌ ERROR NO CAPTURADO:', error.message);
    console.log(error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 8. ENDPOINT: GET /health (Health Check)
// ═══════════════════════════════════════════════════════════
// 
// QUE HACE:
// Devuelve estado del servidor
// 
// POR QUÉ IMPORTANTE:
// - Render lo usa para saber si el servidor está vivo
// - Si no responde en 30 segundos, Render lo marca como "down"
// - El keep-alive (sección 6) hace ping cada 5 minutos a este endpoint
//
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: SUPABASE_URL ? '✅ Conectado' : '❌ No configurado',
    backend: 'cashazo-final'
  });
});

// ═══════════════════════════════════════════════════════════
// 9. INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`🚀 CASHAZO BACKEND EN LÍNEA`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 Supabase: ${SUPABASE_URL.substring(0, 40)}...`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`📝 ENDPOINTS DISPONIBLES:`);
  console.log(`   POST /api/solicitud → Recibir solicitud + documentos`);
  console.log(`   GET  /health        → Estado del servidor`);
  console.log('════════════════════════════════════════════════════════════\n');
});
