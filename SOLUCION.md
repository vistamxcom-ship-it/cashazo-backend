# 🔧 SOLUCIÓN: Error de WebSocket en Render

## El Problema

```
Error: Node.js 18 detected without native WebSocket support.
```

El error ocurre porque:
- **Supabase v2.38** necesita WebSocket nativo (disponible en Node.js 16.10+)
- **Node.js 18** SÍ tiene WebSocket, pero Supabase a veces no lo detecta correctamente
- Necesitas instalar **explícitamente** el paquete `ws`

---

## ✅ Solución (3 pasos)

### 1️⃣ Actualizar `package.json`

Agrega `"ws": "^8.14.2"` a las dependencias:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.0.3",
    "@supabase/supabase-js": "^2.38.0",
    "nodemailer": "^6.9.6",
    "ws": "^8.14.2"
  },
  "engines": {
    "node": "20.x"
  }
}
```

**Cambios:**
- ✅ Agregué `"ws": "^8.14.2"`
- ✅ Cambié `"node": "18.x"` a `"node": "20.x"` (recomendado)

---

### 2️⃣ Actualizar `backend-final.js`

Importa `ws` ANTES de Supabase:

```javascript
const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

// ✅ Importar ws ANTES de Supabase (si Node.js < 20)
let supabaseOptions = {};
const nodeVersion = parseInt(process.versions.node.split('.')[0]);
if (nodeVersion < 20) {
  const ws = require('ws');
  supabaseOptions.realtime = {
    transport: ws
  };
}

const { createClient } = require('@supabase/supabase-js');

// ... resto del código

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, supabaseOptions);
```

---

### 3️⃣ Actualizar Render (Opcional pero Recomendado)

Crea un archivo `render.yaml` en la raíz de tu repositorio:

```yaml
services:
  - type: web
    name: cashazo-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: 20.x
```

---

## 🚀 Después de actualizar:

1. **Haz commit** de los archivos actualizados:
   ```bash
   git add package.json backend-final.js render.yaml
   git commit -m "Fix: Agregar ws package y actualizar Node.js a 20"
   git push origin main
   ```

2. **Render se desplegará automáticamente** y debería funcionar ✅

3. **Si sigue fallando**, prueba esto en Render:
   - Ve a **Settings** → **Environment**
   - Asegúrate de que `NODE_VERSION` esté en **20.x** o superior
   - Haz clic en **Deploy** nuevamente

---

## 📋 Resumen de Cambios

| Archivo | Cambio | Razón |
|---------|--------|-------|
| `package.json` | Agregar `ws: ^8.14.2` | Supabase lo necesita para WebSocket |
| `package.json` | Cambiar a `node: 20.x` | Node.js 18 está deprecated |
| `backend-final.js` | Importar `ws` antes de Supabase | Configura WebSocket correctamente |
| `render.yaml` | Crear archivo | Asegura Node.js 20 en Render |

---

## ❓ ¿Por qué sucede esto?

- Supabase necesita WebSocket para **Realtime** (escuchar cambios en BD en tiempo real)
- Node.js < 22 no tiene WebSocket nativo en algunas versiones
- El paquete `ws` es un polyfill que lo proporciona
- Node.js 18 está **end-of-life** desde octubre 2024

---

## 🆘 Si aún falla:

```bash
# En tu máquina, prueba:
npm install
npm start

# Deberías ver:
# ✅ Supabase: Conectado
# 🌐 Backend CASHAZO en http://localhost:3002
```

Si ves un error diferente, copia el mensaje completo y podemos investigar más.
