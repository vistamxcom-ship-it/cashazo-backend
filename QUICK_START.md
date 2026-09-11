# ⚡ CASHAZO - QUICK START (15 MINUTOS)

## ✅ PASO 1: Preparar GitHub (2 min)

```bash
# En tu máquina local
mkdir cashazo-backend && cd cashazo-backend

# Copiar archivos
# backend-final.js
# package.json
# render.yaml
# .gitignore (copiar abajo)
# .env.example (copiar abajo)

# Crear .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
.DS_Store
npm-debug.log*
*.log
EOF

# Crear .env.example (para documentación)
cat > .env.example << 'EOF'
SUPABASE_URL=https://mxjlfcjmmjweetmrotgr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3002
NODE_ENV=production
EOF

# Crear .env real (en local solamente)
cat > .env << 'EOF'
SUPABASE_URL=https://mxjlfcjmmjweetmrotgr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amxmY2ptbWp3ZWV0bXJvdGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzIwMDEsImV4cCI6MjA5NjYwODAwMX0.PXvUEYwePiTWP7DwmD79cl-B2iSp2o9MbEaZWrvY_3o
PORT=3002
NODE_ENV=production
EOF

# Push a GitHub
git init
git add .
git commit -m "Initial: Cashazo backend"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/cashazo-backend.git
git push -u origin main
```

---

## ✅ PASO 2: Deploy en Render (5 min)

1. Ir a https://render.com (crear cuenta si no tienes)
2. Click **"New +"** → **"Web Service"**
3. Conectar repo: `cashazo-backend`
4. Llenar:
   - **Name:** `cashazo-backend`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Bajar a "Environment" y agregar variables:
   ```
   SUPABASE_URL=https://mxjlfcjmmjweetmrotgr.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   NODE_ENV=production
   ```
6. Click "Create Web Service"
7. **Esperar 2-3 minutos** (te da URL automática)
8. Tu URL será: `https://cashazo-backend-xxxxx.onrender.com`

---

## ✅ PASO 3: Supabase - Crear tabla (3 min)

1. Ir a https://supabase.com/dashboard
2. Seleccionar proyecto
3. SQL Editor → New Query → Pegar esto:

```sql
CREATE TABLE IF NOT EXISTS solicitudes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  folio TEXT UNIQUE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  solicitante JSONB,
  credito JSONB,
  ubicacion JSONB,
  referencias JSONB,
  documentos JSONB,
  aceptaciones JSONB,
  estado TEXT DEFAULT 'nueva',
  ip_origen TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_folio ON solicitudes(folio);
CREATE INDEX idx_timestamp ON solicitudes(timestamp DESC);
```

4. Ejecutar (▶️)
5. Ir a **Storage** → **Create New Bucket**
   - Name: `Cashazo Documento`
   - Público: OFF (Privado)
   - Click "Create"

---

## ✅ PASO 4: Netlify - Deploy Frontend (3 min)

1. Descargar `cashazo_v4_render_final.html` (ya tiene URL correcta de Render)
2. Ir a https://app.netlify.com
3. Drag & drop el archivo HTML
4. Tu sitio aparecerá en `https://cashazo-xxxxx.netlify.app`
5. Verifica en consola (F12) que dice:
   ```
   fetch('https://cashazo-backend-xxxxx.onrender.com/api/solicitud'
   ```

---

## ✅ PASO 5: Prueba Rápida (2 min)

### En consola del navegador (F12):
```javascript
// Test 1: ¿Render responde?
fetch('https://cashazo-backend-xxxxx.onrender.com/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend OK:', d))
  .catch(e => console.error('❌ Error:', e));

// Test 2: ¿Puedo enviar una solicitud?
const fd = new FormData();
fd.append('folio', 'TEST-' + Date.now());
fd.append('dataSolicitud', JSON.stringify({
  solicitante: { nombre: 'Test' }
}));

fetch('https://cashazo-backend-xxxxx.onrender.com/api/solicitud', {
  method: 'POST',
  body: fd
})
  .then(r => r.json())
  .then(d => console.log('✅ Solicitud enviada:', d))
  .catch(e => console.error('❌ Error:', e));
```

---

## 🎯 ENDPOINTS LISTA

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del server |
| POST | `/api/solicitud` | Enviar solicitud + archivos |
| GET | `/api/solicitud/:folio` | Obtener una solicitud |
| GET | `/api/solicitudes` | Listar todas (últimas 100) |

---

## 📝 NOTAS IMPORTANTES

⚠️ **Render free tier se duerme después de 15 min sin actividad**
- El backend incluye keep-alive cada 10 min
- Primer request después de dormir toma 30 seg

✅ **Los archivos se suben a Supabase Storage privado**
- URLs con firma válidas por 1 hora
- Después expiran (seguridad)

✅ **Todos los datos se guardan en Supabase**
- Acceso en: Dashboard → Table Editor → solicitudes

---

## 🚀 LISTO!

Tu app está en:
- 🌐 Frontend: `https://cashazo-xxxxx.netlify.app`
- 🔌 Backend API: `https://cashazo-backend-xxxxx.onrender.com`
- 💾 Base de datos: Supabase (privada)

---

**Si algo falla:**
1. Revisar logs en Render (Dashboard → Logs)
2. Revisar consola (F12) en el navegador
3. Verificar que Supabase tabla existe (SQL Editor)
4. Revisar variables ENV en Render
