# LeadFlow — Estructura de archivos

## Archivos a colocar en tu proyecto (`src/`):

```
src/
├── App.jsx          ← NUEVO: Router principal (reemplaza tu App.jsx actual)
├── Dashboard.jsx    ← RENOMBRADO: Tu panel privado (antes era App.jsx)
├── PublicLanding.jsx ← NUEVO: Landing pública por inmobiliaria
├── main.jsx         ← No tocar (ya existe en tu proyecto Vite)
└── index.css        ← Dejarlo vacío (ya lo tenés)
```

## Pasos de instalación:

1. Copiá `App.jsx`, `Dashboard.jsx` y `PublicLanding.jsx` a tu carpeta `src/`
2. Borrá el viejo `src/App.jsx` (ahora se llama `Dashboard.jsx`)
3. Asegurate de que `src/main.jsx` importe el nuevo `App`:

```jsx
import App from './App'
```

## Rutas:

- `http://localhost:5173/` → Panel privado (dashboard)
- `http://localhost:5173/panel` → Panel privado (dashboard)
- `http://localhost:5173/inmo001` → Landing pública de inmo001
- `http://localhost:5173/inmo002` → Landing pública de inmo002

## Backend necesario:

La landing necesita este endpoint en n8n:

### GET /webhook/api-branding?inmobiliaria_id={slug}

Debe devolver:
```json
{
  "nombre": "Inmobiliaria Centro",
  "logo_url": "https://...",
  "color_primario": "#6366f1",
  "color_secundario": "#a78bfa",
  "hero_titulo": "Encontrá tu hogar ideal",
  "hero_subtitulo": "Las mejores propiedades de Rosario",
  "whatsapp": "5493415550000",
  "telefono": "341-555-0000",
  "email": "info@inmobiliaria.com",
  "direccion": "Av. Pellegrini 1234"
}
```

### POST /webhook/lead

Recibe los leads del formulario:
```json
{
  "inmobiliaria_id": "inmo001",
  "nombre": "Juan",
  "telefono": "341555555",
  "propiedad": "Casa 3 ambientes",
  "mensaje": "Quiero alquilar"
}
```
