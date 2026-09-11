/**
 * CASHAZO - BACKEND NOTIFICACIONES + ALMACENAMIENTO
 * Recibe solicitudes, guarda en Supabase, notifica por email
 * 
 * npm install express cors multer @supabase/supabase-js nodemailer dotenv
 * node backend-final.js
 * 
 * Deployed en: https://cashazo-backend-v1vr.onrender.com
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// ═══════════════════════════════════════════════════════════
// VARIABLES DE ENTORNO (.env)
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

console.log('═══════════════════════════════════════════════════════════');
console.log('🔧 INICIALIZANDO CASHAZO BACKEND');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`✅ SUPABASE_URL: ${SUPABASE_URL ? '✓ Configurado' : '❌ NO CONFIGURADO'}`);
console.log(`✅ SUPABASE_KEY: ${SUPABASE_KEY ? '✓ Configurado' : '❌ NO CONFIGURADO'}`);
console.log(`✅ GMAIL: ${GMAIL_USER ? '✓ Configurado' : '⚠️ No configurado (opcional)'}`);

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5500', 'https://cashazo.netlify.app'],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Multer para archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: SUPABASE_URL ? '✅' : '❌',
    uptime: process.uptime()
  });
});

// ═══════════════════════════════════════════════════════════
// ENDPOINT PRINCIPAL - RECIBIR SOLICITUD + DOCUMENTOS
// ═══════════════════════════════════════════════════════════

app.post('/api/solicitud', upload.any(), async (req, res) => {
  try {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📥 NUEVA SOLICITUD RECIBIDA - ${new Date().toLocaleString('es-MX')}`);
    console.log(`${'═'.repeat(60)}`);
    
    // Datos básicos
    console.log(`📁 Files recibidos: ${req.files ? req.files.length : 0}`);
    console.log(`📋 Body keys: ${Object.keys(req.body).join(', ')}`);
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(f => {
        console.log(`   📄 ${f.fieldname}: ${f.originalname} (${(f.size / 1024).toFixed(2)} KB)`);
      });
    }

    // Generar folio único
    const folio = req.body.folio || 'CZ-' + Date.now();
    console.log(`🎫 Folio generado: ${folio}`);

    // Parsear datos de solicitud
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
      solicitante: {
        nombre: solicitudData.solicitante?.nombre || solicitudData.nombre || '',
        telefono: solicitudData.solicitante?.telefono || solicitudData.tel || '',
        whatsapp: solicitudData.solicitante?.whatsapp || solicitudData.whatsapp || '',
        curp: solicitudData.solicitante?.curp || solicitudData.curp || ''
      },
      credito: {
        monto: solicitudData.credito?.monto || solicitudData.monto || 0,
        destino: solicitudData.credito?.destino || solicitudData.destino || '',
        plazo: solicitudData.credito?.plazo || 'No especificado'
      },
      ubicacion: {
        lat: solicitudData.ubicacion?.lat || null,
        lng: solicitudData.ubicacion?.lng || null,
        precision: solicitudData.ubicacion?.precision || null,
        domicilio: solicitudData.ubicacion?.domicilio || solicitudData.domicilio || ''
      },
      referencias: solicitudData.referencias || {},
      documentos: {},
      aceptaciones: solicitudData.aceptaciones || {},
      estado: 'nueva',
      ip_origen: req.ip,
      user_agent: req.get('user-agent')
    };

    // Procesar y subir documentos a Supabase Storage
    if (req.files && req.files.length > 0) {
      console.log(`\n📤 SUBIENDO DOCUMENTOS A SUPABASE STORAGE:`);
      console.log(`${'─'.repeat(60)}`);
      
      for (const file of req.files) {
        try {
          // Crear nombre de archivo único con folio
          const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
          const fileName = `${folio}/${file.fieldname}-${Date.now()}${ext}`;
          
          console.log(`   ⬆️  ${file.fieldname}...`);
          
          // Subir a Supabase Storage (bucket: "Cashazo Documento")
          const { data, error } = await supabase.storage
            .from('Cashazo Documento')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
              cacheControl: '3600'
            });

          if (error) {
            console.error(`   ❌ Error: ${error.message}`);
          } else {
            console.log(`   ✅ Subido correctamente`);
            
            // Crear URL con firma (privada, válida 1 hora)
            const { data: signedUrl } = await supabase.storage
              .from('Cashazo Documento')
              .createSignedUrl(fileName, 3600); // 3600 segundos = 1 hora

            solicitud.documentos[file.fieldname] = {
              filename: file.originalname,
              fieldname: file.fieldname,
              url: signedUrl?.signedUrl || null,
              path: fileName,
              size: file.size,
              type: file.mimetype,
              uploaded_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600000).toISOString()
            };
          }
        } catch (e) {
          console.error(`   ❌ Error procesando ${file.fieldname}: ${e.message}`);
        }
      }
    }

    console.log(`\n💾 GUARDANDO EN SUPABASE (tabla: solicitudes)`);
    console.log(`${'─'.repeat(60)}`);

    // Guardar solicitud en tabla de Supabase
    const { data, error } = await supabase
      .from('solicitudes')
      .insert([solicitud]);

    if (error) {
      console.error(`❌ Error Supabase: ${error.message}`);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        folio: folio 
      });
    }

    console.log(`✅ Solicitud guardada en Supabase`);
    console.log(`📄 Documentos: ${Object.keys(solicitud.documentos).length}`);
    console.log(`${'═'.repeat(60)}\n`);

    // Respuesta exitosa
    res.json({
      success: true,
      mensaje: 'Solicitud guardada correctamente',
      folio: folio,
      documentosGuardados: Object.keys(solicitud.documentos).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ ERROR GENERAL: ${error.message}`);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// ENDPOINT GET SOLICITUD (para verificar)
// ═══════════════════════════════════════════════════════════

app.get('/api/solicitud/:folio', async (req, res) => {
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
// ENDPOINT LISTADO DE SOLICITUDES (admin)
// ═══════════════════════════════════════════════════════════

app.get('/api/solicitudes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('folio, timestamp, solicitante->nombre, estado')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`🚀 CASHAZO BACKEND ACTIVO`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`\n🌐 Local:   http://localhost:${PORT}`);
  console.log(`🌐 Online:  https://cashazo-backend-v1vr.onrender.com`);
  console.log('\n📋 ENDPOINTS:');
  console.log(`   POST   /api/solicitud           → Recibir solicitud + documentos`);
  console.log(`   GET    /api/solicitud/:folio    → Obtener solicitud específica`);
  console.log(`   GET    /api/solicitudes         → Listar últimas solicitudes`);
  console.log(`   GET    /health                  → Estado del servidor`);
  console.log('\n════════════════════════════════════════════════════════════\n');
});

// ═══════════════════════════════════════════════════════════
// KEEP-ALIVE (para Render free tier)
// ═══════════════════════════════════════════════════════════
setInterval(() => {
  fetch(`https://cashazo-backend-v1vr.onrender.com/health`)
    .then(r => r.json())
    .then(() => console.log('🔄 Keep-alive ping OK'))
    .catch(e => console.log('⚠️ Keep-alive ping falló:', e.message));
}, 10 * 60 * 1000); // Cada 10 minutos
