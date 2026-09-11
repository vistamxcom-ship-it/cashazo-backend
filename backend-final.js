/**
 * CASHAZO - BACKEND
 * Recibe solicitudes, guarda en Supabase Storage
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: SUPABASE_URL ? '✅' : '❌'
  });
});

// POST /api/solicitud
app.post('/api/solicitud', upload.any(), async (req, res) => {
  try {
    console.log(`\n📥 Solicitud recibida`);
    
    const folio = req.body.folio || 'CZ-' + Date.now();
    let solicitudData = {};

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

    // Subir documentos
    if (req.files && req.files.length > 0) {
      console.log(`📁 Subiendo ${req.files.length} archivos...`);
      
      for (const file of req.files) {
        try {
          const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${ext}`;
          
          const { error } = await supabase.storage
            .from('Cashazo Documento')
            .upload(fileName, file.buffer, { contentType: file.mimetype });

          if (!error) {
            const { data: signedUrl } = await supabase.storage
              .from('Cashazo Documento')
              .createSignedUrl(fileName, 3600);

            solicitud.documentos[file.fieldname] = {
              filename: file.originalname,
              url: signedUrl?.signedUrl,
              size: file.size,
              type: file.mimetype
            };
            console.log(`✅ ${file.fieldname} subido`);
          }
        } catch (e) {
          console.error(`❌ Error ${file.fieldname}:`, e.message);
        }
      }
    }

    // Guardar en Supabase
    const { error } = await supabase
      .from('solicitudes')
      .insert([solicitud]);

    if (error) {
      console.error('Error Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ Solicitud ${folio} guardada`);

    res.json({
      success: true,
      mensaje: 'Solicitud guardada',
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

// Iniciar
app.listen(PORT, () => {
  console.log(`\n🚀 Backend CASHAZO en puerto ${PORT}`);
  console.log(`✅ POST /api/solicitud`);
  console.log(`✅ GET /health\n`);
});
