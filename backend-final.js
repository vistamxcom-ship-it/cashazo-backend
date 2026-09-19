/**
 * CASHAZO - BACKEND NOTIFICACIONES + ALMACENAMIENTO
 * Recibe solicitudes, guarda en Supabase, notifica por email
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

// SUPABASE SIN REALTIME - OPCIÓN 1: shouldInitializeRealtimeClient: false
let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: false
  });
} catch (e) {
  console.log('Intentando con shouldInitializeRealtimeClient...');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    shouldInitializeRealtimeClient: false
  });
}

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

setInterval(() => {
  fetch(`http://localhost:${PORT}/health`).catch(() => {});
}, 5 * 60 * 1000);

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

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${file.originalname.substring(file.originalname.lastIndexOf('.'))}`;
          
          console.log(`   ⬆️ Subiendo: ${fileName}`);
          
          const { data, error } = await supabase.storage
            .from('Cashazo Documento')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype
            });

          if (error) {
            console.error(`   ❌ Error subiendo ${file.fieldname}:`, error.message);
          } else {
            console.log(`   ✅ Subido: ${file.fieldname}`);
            const { data: signedUrl } = await supabase.storage
              .from('Cashazo Documento')
              .createSignedUrl(fileName, 3600);

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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: SUPABASE_URL ? '✅' : '❌'
  });
});

app.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🌐 Backend CASHAZO en http://localhost:${PORT}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`✅ Supabase: Conectado (sin Realtime)`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`📝 ENDPOINT:`);
  console.log(`   POST /api/solicitud → Recibir solicitud + documentos`);
  console.log(`   GET  /health        → Estado`);
  console.log('════════════════════════════════════════════════════════════');
});
