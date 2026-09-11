# 🚀 CASHAZO - GUÍA DE DEPLOYMENT

## 📋 FLUJO COMPLETO
```
GitHub (código) → Render (backend) → Netlify (frontend) → Supabase (datos)
```

---

## 1️⃣ GITHUB - SETUP INICIAL

### Estructura del repositorio:
```
cashazo-backend/
├── backend-final.js
├── package.json
├── package-lock.json
├── .env (NUNCA SUBIR, usar .env.example)
├── .env.example
├── .gitignore
└── README.md
```

### .gitignore (crear en raíz):
```
node_modules/
.env
.DS_Store
npm-debug.log*
```

### .env.example (para documentación):
```
SUPABASE_URL=https://mxjlfcjmmjweetmrotgr.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3002
NODE_ENV=production
```

### Comandos GitHub:
```bash
# Crear repositorio
git init
git add .
git commit -m "Initial commit: Cashazo backend"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/cashazo-backend.git
git push -u origin main
```

---

## 2️⃣ RENDER - DEPLOYMENT DEL BACKEND

### Pasos en https://render.com:

1. **Crear nuevo "Web Service"**
   - Conectar repositorio GitHub: `cashazo-backend`
   - Branch: `main`

2. **Configuración del servicio:**
   - **Name:** `cashazo-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (ok para desarrollo)

3. **Agregar variables de entorno (Environment):**
   ```
   SUPABASE_URL=https://mxjlfcjmmjweetmrotgr.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   PORT=3002
   NODE_ENV=production
   ```

4. **Deploy:**
   - Click en "Create Web Service"
   - Esperar a que compile (2-3 minutos)
   - URL resultante: `https://cashazo-backend-v1vr.onrender.com`

### Verificar que funciona:
```bash
curl https://cashazo-backend-v1vr.onrender.com/health
# Respuesta:
# {"status":"ok","timestamp":"...","supabase":"✅","uptime":...}
```

---

## 3️⃣ NETLIFY - DEPLOYMENT DEL FRONTEND

### Pasos en https://netlify.com:

1. **Opción A: Netlify CLI**
   ```bash
   npm install -g netlify-cli
   cd tu-carpeta-frontend
   netlify deploy --prod --dir=. --files=cashazo_v4_render_final.html
   ```

2. **Opción B: Deploy manual (drag & drop)**
   - Ir a https://app.netlify.com
   - Drag & drop: `cashazo_v4_render_final.html`
   - Tu sitio aparecerá en: `https://cashazo-xxxxx.netlify.app`

3. **Conectar dominio personalizado (opcional)**
   - En Netlify → Domain Management
   - Agregar tu dominio

### Verificar que apunta al backend correcto:
Abre la consola (F12) y verifica que:
```
fetch('https://cashazo-backend-v1vr.onrender.com/api/solicitud', {
```

---

## 4️⃣ SUPABASE - SETUP DE BASE DE DATOS

### Crear tabla `solicitudes`:

```sql
CREATE TABLE solicitudes (
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

-- Índices para búsquedas rápidas
CREATE INDEX idx_folio ON solicitudes(folio);
CREATE INDEX idx_timestamp ON solicitudes(timestamp DESC);
CREATE INDEX idx_estado ON solicitudes(estado);
```

### Crear bucket `Cashazo Documento`:

1. En Supabase Dashboard → Storage → Create New Bucket
   - **Name:** `Cashazo Documento`
   - **Public policy:** OFF (privado, acceso con URL firmada)
   - Click "Create"

---

## 5️⃣ VERIFICACIÓN COMPLETA

### Test desde HTML:
```javascript
// Abrir consola (F12) y ejecutar:
fetch('https://cashazo-backend-v1vr.onrender.com/health')
  .then(r => r.json())
  .then(d => console.log(d))
  .catch(e => console.error(e));

// Debe responder:
// {status: 'ok', timestamp: '...', supabase: '✅', uptime: 123.45}
```

### Test de solicitud:
```javascript
const formData = new FormData();
formData.append('folio', 'CZ-TEST-' + Date.now());
formData.append('dataSolicitud', JSON.stringify({
  solicitante: { nombre: 'Test Usuario', tel: '5551234567' }
}));

fetch('https://cashazo-backend-v1vr.onrender.com/api/solicitud', {
  method: 'POST',
  body: formData
})
  .then(r => r.json())
  .then(d => console.log(d));
```

---

## 📊 MONITOREO Y MANTENIMIENTO

### Logs en Render:
- Dashboard → cashazo-backend → Logs (live feed)

### Logs en Netlify:
- Site → Analytics

### Revisar solicitudes en Supabase:
- Dashboard → Table Editor → solicitudes
- Buscar por folio o fecha

---

## 🔄 HACER CAMBIOS Y ACTUALIZAR

### Si cambias backend (JavaScript):
```bash
git add backend-final.js
git commit -m "Update: [descripción]"
git push origin main
# Render auto-redeploy (2-3 minutos)
```

### Si cambias frontend (HTML):
```bash
# Opción A: Usar Netlify CLI
netlify deploy --prod --dir=. --files=cashazo_v4_render_final.html

# Opción B: Manual
# Subirlo nuevamente a Netlify drag & drop
```

---

## 🚨 TROUBLESHOOTING

| Error | Solución |
|-------|----------|
| `Cannot find module 'express'` | Ejecutar `npm install` en Render |
| `SUPABASE_URL is undefined` | Verificar variables env en Render |
| `CORS error` | Asegurar que CORS esté habilitado en backend |
| `Failed to fetch documents` | Verificar que bucket `Cashazo Documento` existe en Supabase |
| `Render takes 15min to wake up (free tier)` | Usar keep-alive endpoint `/health` cada 10min |

---

## 💡 TIPS Y MEJORES PRÁCTICAS

1. **Seguridad:**
   - Nunca compartir `.env` real
   - Usar variables de entorno en Render
   - Bucket Supabase con acceso privado (URLs firmadas)

2. **Performance:**
   - Keep-alive endpoint evita que Render se "duerma"
   - URLs firmadas expiran en 1 hora (seguridad)
   - Máximo 100MB por archivo

3. **Escalabilidad:**
   - Si necesitas más capacidad en Render, cambiar a plan pagado
   - Supabase free tier aguanta bastante (500MB)

---

## 📱 URLs FINALES

| Servicio | URL |
|----------|-----|
| Backend API | `https://cashazo-backend-v1vr.onrender.com` |
| Frontend | `https://cashazo-xxxxx.netlify.app` |
| Admin (Supabase) | `https://supabase.com/dashboard/projects` |
| GitHub | `https://github.com/TU-USUARIO/cashazo-backend` |

---

**Última actualización:** 2024
**Status:** ✅ Producción
