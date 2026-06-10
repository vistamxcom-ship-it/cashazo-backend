# Cashazo Backend

Backend de solicitudes para Cashazo. Recibe solicitudes con documentos, los guarda en Supabase Storage y registra los datos en la base de datos.

## Setup Local

```bash
npm install
npm run dev
```

El servidor escucha en `http://localhost:3002`

## Endpoints

### POST `/api/solicitud`
Recibe una solicitud con documentos adjuntos. Los documentos se guardan en Supabase Storage y los datos en la tabla `solicitudes`.

**Respuesta:**
```json
{
  "success": true,
  "mensaje": "Solicitud guardada en Supabase",
  "folio": "CZ-1234567890",
  "documentosGuardados": 3
}
```

### GET `/health`
Verifica que el servidor esté activo.

## Variables de Entorno

Copia `.env.example` a `.env` y configura:

- `SUPABASE_URL` - URL de tu proyecto Supabase
- `SUPABASE_KEY` - Service role key de Supabase
- `GMAIL_USER` - Email para notificaciones (opcional)
- `GMAIL_PASS` - Contraseña de app de Gmail (opcional)
- `PORT` - Puerto (default: 3002)

## Deploy en Render

1. Sube a GitHub
2. Crea nuevo Web Service en Render
3. En **Environment**, agrega:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `GMAIL_USER` (opcional)
   - `GMAIL_PASS` (opcional)
4. El deploy automático se conecta a tu repo

## Node.js Version

Requiere Node.js 20 o superior. Render usa la versión especificada en `package.json`.
