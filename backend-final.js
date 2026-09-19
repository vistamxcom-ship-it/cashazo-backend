/**
 * ════════════════════════════════════════════════════════════
 * CASHAZO - BACKEND NOTIFICACIONES + ALMACENAMIENTO
 * ════════════════════════════════════════════════════════════
 * 
 * VERSIÓN ARREGLADA PARA NODE 20
 * - Sin Realtime (causa error con WebSocket en Node 20)
 * - Solo Database + Storage
 * 
 * ════════════════════════════════════════════════════════════
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ═══════════════════════════════════════════════════════════
// VARIABLES DE ENTORNO
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ocietbqwmhvaxgpggifb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jaWV0YnF3bWh2YXhncGdnaWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDgwNjAsImV4cCI6MjEwNTEyNDA2MH0.pwl-uFBnTyRsfx9JVEQvYyZAsGcN_t3XeO2uhoXz7hM';
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_PASS = process.env.GMAIL_PASS || '';
const PORT = process.env.PORT || 3002;

// ═══════════════════════════════════════════════════════════
// INICIALIZAR SUPABASE (sin Realtime para evitar error WebSocket)
// ═══════════════════════════════════════════════════════════

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

console.log('🔧 Inicializando Supabase...');
console.log(`   URL: ${SUPABASE_URL.substring(0, 30)}...`);

// ═══════════════════════════════════════════════════════════
// EXPRESS SETUP
// ═══════════════════════════════════════════════════════════

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ═══════════════════════════════════════════════════════════
// MULTER (upload de archivos)
// ═══════════════════════════════════════════════════════════

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// ═══════════════════════════════════════════════════════════
// KEEP-ALIVE (para Render)
// ═══════════════════════════════════════════════════════════

setInterval(() => {
  fetch(`http://localhost:${PORT}/health`)
    .then(() => console.log('💚 Keep-alive ping'))
    .catch(() => {});
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════
// ENDPOINT: POST /api/solicitud
// ═══════════════════════════════════════════════════════════

app.post('/api/solicitud', upload.any(), async (req, res) => {
  try {
    console.log(`\n📥 NUEVA SOLICITUD`);
    console.log(`════════════════════════════════════════════════════════════`);
    
    console.log(`   📊 Archivos: ${req.files ? req.files.length : 0}`);
    console.log(`   📋 Campos: ${Object.keys(req.body).join(', ')}`);
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(f => {
        console.log(`      📄 ${f.fieldname}: ${f.originalname} (${(f.size / 1024).toFixed(2)}KB)`);
      });
    }

    // Generar folio
    const folio = req.body.folio || 'CZ-' + Date.now();
    console.log(`   🏷️  Folio: ${folio}`);

    // Parsear datos
    let solicitudData;
    try {
      solicitudData = JSON.parse(req.body.dataSolicitud || req.body.data || '{}');
    } catch (e) {
      solicitudData = req.body;
    }

    // Armar objeto de solicitud
    const solicitud = {
      folio: folio,
      timestamp: new Date().toISOString(),
      solicitante: solicitudData.solicitante || {},
      credito: solicitudData.credito || {},
      ubicacion: solicitudData.ubicacion || {},
      referencias: solicitudData.referencias || {},
      documentos: {},
      aceptaciones: solicitudData.aceptaciones || {},
      estado: 'nueva'
    };

    console.log(`   ✅ Datos de solicitud armados`);

    // ─────────────────────────────────────────────────────
    // SUBIR ARCHIVOS A SUPABASE STORAGE
    // ─────────────────────────────────────────────────────

    if (req.files && req.files.length > 0) {
      console.log(`\n   📤 Subiendo ${req.files.length} archivo(s)...`);

      for (const file of req.files) {
        try {
          const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${fileExtension}`;
          
          console.log(`      ⬆️  Subiendo: ${fileName}`);
          
          // SUBIR A STORAGE
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('Cashazo Documento')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype
            });

          if (uploadError) {
            console.error(`      ❌ Error: ${uploadError.message}`);
            continue;
          }

          console.log(`      ✅ Subido`);

          // GENERAR URL FIRMADA
          const { data: signedUrlData } = await supabase.storage
            .from('Cashazo Documento')
            .createSignedUrl(fileName, 3600);

          solicitud.documentos[file.fieldname] = {
            filename: file.originalname,
            url: signedUrlData.signedUrl,
            size: file.size,
            type: file.mimetype,
            expira_en: '1 hora'
          };

          console.log(`      📎 Guardado en solicitud`);

        } catch (e) {
          console.error(`      ❌ Error procesando ${file.fieldname}: ${e.message}`);
        }
      }
    }

    console.log(`   ✅ ${Object.keys(solicitud.documentos).length} archivo(s) procesado(s)`);

    // ─────────────────────────────────────────────────────
    // GUARDAR EN SUPABASE DATABASE
    // ─────────────────────────────────────────────────────

    console.log(`\n   💾 Guardando en Database...`);

    const { data: dbData, error: dbError } = await supabase
      .from('solicitudes')
      .insert([solicitud]);

    if (dbError) {
      console.error(`      ❌ Error Supabase: ${dbError.message}`);
      return res.status(500).json({ 
        error: `Error guardando en BD: ${dbError.message}` 
      });
    }

    console.log(`      ✅ Solicitud guardada`);

    console.log(`\n✅ SOLICITUD COMPLETADA`);
    console.log(`════════════════════════════════════════════════════════════\n`);

    res.json({
      success: true,
      mensaje: 'Solicitud guardada en Supabase',
      folio: folio,
      documentosGuardados: Object.keys(solicitud.documentos).length,
      timestamp: solicitud.timestamp
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// ENDPOINT: GET /health
// ═══════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: SUPABASE_URL ? '✅ Conectado' : '❌ No configurado'
  });
});

// ═══════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`🚀 CASHAZO BACKEND EN LÍNEA`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 Supabase: ${SUPABASE_URL.substring(0, 40)}...`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`📝 ENDPOINTS:`);
  console.log(`   POST /api/solicitud → Recibir solicitud + documentos`);
  console.log(`   GET  /health        → Estado del servidor`);
  console.log('════════════════════════════════════════════════════════════\n');
});
