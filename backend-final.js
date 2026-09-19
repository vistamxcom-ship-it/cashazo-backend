/**
 * CASHAZO - BACKEND CON REST API DIRECTO
 * Sin Supabase SDK (evita Realtime completamente)
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ocietbqwmhvaxgpggifb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jaWV0YnF3bWh2YXhncGdnaWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDgwNjAsImV4cCI6MjEwNTEyNDA2MH0.pwl-uFBnTyRsfx9JVEQvYyZAsGcN_t3XeO2uhoXz7hM';

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

// SUBIR A STORAGE VIA REST
async function uploadToStorage(fileName, fileBuffer, mimetype) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/Cashazo Documento/${fileName}`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${SUPABASE_KEY}`,
          'content-type': mimetype
        },
        body: fileBuffer
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    // Generar URL firmada
    const signedResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/Cashazo Documento/${fileName}`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${SUPABASE_KEY}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 3600 })
      }
    );

    if (!signedResponse.ok) {
      throw new Error(`Sign failed: ${signedResponse.statusText}`);
    }

    const signedData = await signedResponse.json();
    return {
      path: fileName,
      url: `${SUPABASE_URL}/storage/v1/object/sign/Cashazo Documento/${fileName}?token=${signedData.signedURL.split('token=')[1]}`
    };
  } catch (error) {
    console.error('Storage error:', error.message);
    return null;
  }
}

// INSERTAR EN BD VIA REST
async function insertSolicitud(solicitud) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/solicitudes`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${SUPABASE_KEY}`,
          'content-type': 'application/json',
          'prefer': 'return=minimal'
        },
        body: JSON.stringify(solicitud)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Insert failed: ${error}`);
    }

    return true;
  } catch (error) {
    console.error('Insert error:', error.message);
    return false;
  }
}

app.post('/api/solicitud', upload.any(), async (req, res) => {
  try {
    console.log(`\n📥 Solicitud recibida`);
    console.log(`   Files: ${req.files ? req.files.length : 0}`);

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

    // SUBIR ARCHIVOS
    if (req.files && req.files.length > 0) {
      console.log(`   📤 Subiendo ${req.files.length} archivo(s)...`);
      
      for (const file of req.files) {
        try {
          const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${fileExtension}`;
          
          console.log(`      ⬆️ Subiendo: ${fileName}`);
          
          const uploadResult = await uploadToStorage(fileName, file.buffer, file.mimetype);
          
          if (uploadResult) {
            solicitud.documentos[file.fieldname] = {
              filename: file.originalname,
              url: uploadResult.url,
              size: file.size,
              type: file.mimetype
            };
            console.log(`      ✅ Subido: ${file.fieldname}`);
          }
        } catch (e) {
          console.error(`      ❌ Error: ${e.message}`);
        }
      }
    }

    // GUARDAR EN BD
    console.log(`   💾 Guardando en BD...`);
    const inserted = await insertSolicitud(solicitud);

    if (!inserted) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error guardando en base de datos' 
      });
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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🚀 Backend CASHAZO EN LÍNEA`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`📝 ENDPOINTS:`);
  console.log(`   POST /api/solicitud → Recibir solicitud + documentos`);
  console.log(`   GET  /health        → Estado`);
  console.log('════════════════════════════════════════════════════════════');
});
