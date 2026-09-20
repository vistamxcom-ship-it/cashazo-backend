/**
 * CASHAZO - BACKEND SIMPLE
 * Netlfiy (frontend) → Render (backend) → Supabase (datos)
 * 
 * npm install express cors multer @supabase/supabase-js dotenv
 * node backend-final.js
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

console.log('\n🚀 INICIANDO BACKEND...\n');

// ═══════════════════════════════════════════════════════════
// VARIABLES DE ENTORNO
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ FALTA SUPABASE_URL o SUPABASE_KEY en .env');
  process.exit(1);
}

console.log('✅ Supabase URL:', SUPABASE_URL);
console.log('✅ Supabase Key: ' + SUPABASE_KEY.substring(0, 20) + '...\n');

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE - SUPER IMPORTANTE
// ═══════════════════════════════════════════════════════════

// CORS PRIMERO (antes de cualquier otra cosa)
app.use(cors({
  origin: '*', // Permite todos los origenes
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  headers: ['Content-Type', 'Authorization'],
  credentials: false
}));

// OPTIONS para preflight requests
app.options('*', cors());

// Body parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Multer para archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK - Básico
// ═══════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    backend: 'Cashazo',
    supabase: 'conectado'
  });
});

// ═══════════════════════════════════════════════════════════
// ENDPOINT PRINCIPAL - RECIBIR SOLICITUD
// ═══════════════════════════════════════════════════════════

app.post('/api/solicitud', upload.any(), async (req, res) => {
  try {
    const folio = req.body.folio || 'CZ-' + Date.now();
    
    console.log('\n' + '='.repeat(60));
    console.log('📥 SOLICITUD RECIBIDA');
    console.log('='.repeat(60));
    console.log(`Folio: ${folio}`);
    console.log(`Archivos: ${req.files ? req.files.length : 0}`);
    console.log(`Body keys: ${Object.keys(req.body).join(', ')}`);

    // Parsear dataSolicitud
    let dataSolicitud = {};
    try {
      dataSolicitud = JSON.parse(req.body.dataSolicitud || '{}');
    } catch (e) {
      dataSolicitud = req.body;
    }

    console.log(`Solicitante: ${dataSolicitud.solicitante?.nombre || 'No especificado'}`);

    // ═══════════════════════════════════════════════════════════
    // PASO 1: SUBIR ARCHIVOS A SUPABASE STORAGE
    // ═══════════════════════════════════════════════════════════
    const documentos = {};

    if (req.files && req.files.length > 0) {
      console.log(`\n📁 Subiendo ${req.files.length} archivo(s)...`);

      for (const file of req.files) {
        try {
          const ext = file.originalname.substring(file.originalname.lastIndexOf('.')) || '.bin';
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${ext}`;

          console.log(`  ⬆️  ${file.fieldname}: ${file.originalname}`);

          // Subir a Storage
          const { error: uploadError } = await supabase.storage
            .from('Cashazo Documento')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype
            });

          if (uploadError) {
            console.log(`  ❌ Error: ${uploadError.message}`);
          } else {
            // Generar URL con firma (válida 1 hora)
            const { data: signed } = await supabase.storage
              .from('Cashazo Documento')
              .createSignedUrl(fileName, 3600);

            documentos[file.fieldname] = {
              filename: file.originalname,
              url: signed?.signedUrl || '',
              size: file.size,
              type: file.mimetype,
              expira_en: '1 hora'
            };

            console.log(`  ✅ Subido`);
          }
        } catch (error) {
          console.log(`  ❌ Error procesando: ${error.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 2: GUARDAR EN SUPABASE DATABASE
    // ═══════════════════════════════════════════════════════════
    console.log(`\n💾 Guardando en Supabase...`);

    const solicitud = {
      folio: folio,
      timestamp: new Date().toISOString(),
      solicitante: dataSolicitud.solicitante || {},
      credito: dataSolicitud.credito || {},
      ubicacion: dataSolicitud.ubicacion || {},
      referencias: dataSolicitud.referencias || {},
      documentos: documentos,
      aceptaciones: dataSolicitud.aceptaciones || {},
      estado: 'nueva'
    };

    const { data, error: insertError } = await supabase
      .from('solicitudes')
      .insert([solicitud])
      .select();

    if (insertError) {
      console.log(`❌ Error Supabase: ${insertError.message}`);
      return res.status(500).json({
        success: false,
        error: `Error guardando en BD: ${insertError.message}`,
        folio: folio
      });
    }

    console.log(`✅ Guardado en Supabase`);
    console.log(`✅ Documentos: ${Object.keys(documentos).length}`);
    console.log('='.repeat(60) + '\n');

    // ═══════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═══════════════════════════════════════════════════════════
    res.json({
      success: true,
      mensaje: '✅ Solicitud guardada en Supabase',
      folio: folio,
      documentosGuardados: Object.keys(documentos).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.log(`\n❌ ERROR GENERAL: ${error.message}`);
    console.log(`Stack: ${error.stack}`);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ═══════════════════════════════════════════════════════════
// ENDPOINT PARA OBTENER SOLICITUD (opcional)
// ═══════════════════════════════════════════════════════════
app.get('/api/solicitudes/:folio', async (req, res) => {
  try {
    const { folio } = req.params;

    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .eq('folio', folio)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// MANEJO DE ERRORES
// ═══════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// ═══════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🟢 BACKEND INICIADO`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health                → Verificar que está vivo`);
  console.log(`  POST /api/solicitud         → Recibir solicitud + archivos`);
  console.log(`  GET  /api/solicitudes/:folio → Obtener solicitud`);
  console.log('════════════════════════════════════════════════════════════\n');
});
