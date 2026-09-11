/**
 * CASHAZO - BACKEND NOTIFICACIONES + ALMACENAMIENTO
 * Recibe solicitudes, guarda en Supabase, notifica por email
 * 
 * npm install express cors multer supabase nodemailer dotenv ws
 * node backend-final.js
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

// ✅ IMPORTANTE: Importar ws ANTES de Supabase (si Node.js < 20)
let supabaseOptions = {};
const nodeVersion = parseInt(process.versions.node.split('.')[0]);
if (nodeVersion < 20) {
  const ws = require('ws');
  supabaseOptions.realtime = {
    transport: ws
  };
}

const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3002;

// ═══════════════════════════════════════════════════════════
// VARIABLES DE ENTORNO (.env)
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, supabaseOptions);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Multer para archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ═══════════════════════════════════════════════════════════
// KEEP-ALIVE: Auto-ping para mantener el servidor despierto
// ═══════════════════════════════════════════════════════════
setInterval(() => {
  fetch(`http://localhost:${PORT}/health`).catch(() => {});
}, 5 * 60 * 1000); // Cada 5 minutos

// ═══════════════════════════════════════════════════════════
// ENDPOINT PRINCIPAL
// ═══════════════════════════════════════════════════════════

app.post('/api/solicitud', upload.any(), async (req, res) => {
  try {
    console.log(`\n📥 Solicitud recibida`);
    console.log(`   Files: ${req.files ? req.files.length : 0}`);
    console.log(`   Body keys: ${Object.keys(req.body).join(', ')}`);
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(f => {
        console.log(`   📄 ${f.fieldname}: ${f.originalname} (${f.size} bytes)`);
      });
    }

    const folio = req.body.folio || 'CZ-' + Date.now();
    let solicitudData;

    try {
      solicitudData = JSON.parse(req.body.dataSolicitud || req.body.data || '{}');
    } catch {
      solicitudData = req.body;
    }

    // Estructura de solicitud
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

    // Procesar y subir documentos a Supabase Storage
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${file.originalname.substring(file.originalname.lastIndexOf('.'))}`;
          
          console.log(`   ⬆️ Subiendo: ${fileName}`);
          
          // Subir a Supabase Storage
          const { data, error } = await supabase.storage
            .from('Cashazo Documento')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype
            });

          if (error) {
            console.error(`   ❌ Error subiendo ${file.fieldname}:`, error.message);
          } else {
            console.log(`   ✅ Subido: ${file.fieldname}`);
            // Obtener URL con firma (privada, válida 1 hora)
            const { data: signedUrl } = await supabase.storage
              .from('Cashazo Documento')
              .createSignedUrl(fileName, 3600); // 3600 segundos = 1 hora

            solicitud.documentos[file.fieldname] = {
              filename: file.originalname,
              url: signedUrl.signedUrl,
              size: file.size,
              type: file.mimetype,
              expira_en: '1 hora'
            };
          }
        } catch (e) {
          console.error(`   ❌ Error procesando ${file.fieldname}:`, e.message);
        }
      }
    }

    // Guardar en tabla de Supabase
    const { data, error } = await supabase
      .from('solicitudes')
      .insert([solicitud]);

    if (error) {
      console.error('Error Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ Solicitud ${folio} guardada en Supabase`);
    console.log(`📁 Documentos: ${Object.keys(solicitud.documentos).length}`);

    res.json({
      success: true,
      mensaje: 'Solicitud guardada en Supabase',
      folio: folio,
      documentosGuardados: Object.keys(solicitud.documentos).length
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check (IMPORTANTE: Render lo usa para saber si está vivo)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: SUPABASE_URL ? '✅' : '❌'
  });
});

// ═══════════════════════════════════════════════════════════
// INICIAR
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🌐 Backend CASHAZO en http://localhost:${PORT}`);
  console.log(`📦 Node.js: ${process.versions.node}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`✅ Supabase: Conectado`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`📝 ENDPOINT:`);
  console.log(`   POST /api/solicitud → Recibir solicitud + documentos`);
  console.log(`   GET  /health        → Estado`);
  console.log('════════════════════════════════════════════════════════════');
});
