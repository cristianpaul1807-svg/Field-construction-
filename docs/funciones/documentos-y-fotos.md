# Contratos, documentos y fotos

---

## Contratos y documentos

**Dónde:** menú → Proyectos → Contratos y documentos
**Código:** `client/src/pages/Contracts.tsx` · Rutas: `/api/documents`

### Para qué sirve

El archivo de cada obra: contratos, permisos, planos y garantías. En vez de
estar repartidos entre un correo, una carpeta del ordenador y el móvil de
alguien, están en el proyecto al que pertenecen.

Requiere tener un proyecto seleccionado.

### Subir un documento

1. **Subir documento**.
2. Elige el archivo.
3. Ponle **nombre** — si lo dejas, se usa el del archivo. Un nombre como
   "Permiso municipal 2026" encuentra mejor que "IMG_4471.pdf".
4. Elige la **etiqueta**: contrato, permiso, plano o garantía.
5. **Subir**.

### Descargar

Pulsa el documento. El enlace de descarga es **temporal y se genera en ese
momento**: los archivos no están en una URL pública que alguien pueda adivinar
o reenviar.

### Qué guardar

- **Contratos** firmados, incluidas las órdenes de cambio aceptadas.
- **Permisos** municipales — el que te los pida en obra los quiere ya.
- **Planos**, con su versión en el nombre.
- **Garantías** de los materiales, que es lo que te salva una reclamación dos
  años después.

---

## Galería de fotos

**Dónde:** menú → Proyectos → Galería de fotos
**Código:** `client/src/pages/PhotoGallery.tsx` · Rutas: `/api/photos`

### Para qué sirve

El registro visual de la obra: el antes, el durante y el después. Sirve para
tres cosas distintas, y las tres importan:

1. **Enseñarle el avance al cliente** sin que tenga que ir a la obra.
2. **Documentar** lo que había antes de tocarlo — la mejor defensa cuando
   alguien dice que un daño lo hiciste tú.
3. **Dejar constancia** de lo que queda tapado detrás de una pared.

### Subir fotos

1. **Subir foto**.
2. Elige el archivo.
3. **Zona**: dónde está tomada ("Cocina", "Baño 2", "Fachada").
4. Marca si es **visible para el cliente**.
5. **Subir**.

### La marca de visibilidad

Es la decisión importante de esta pantalla.

- **Visible al cliente** — aparece en su portal.
- **Interno** — solo la ves tú y tu equipo.

Deja como internas las fotos de problemas, de trabajo a medio hacer, o de
cualquier cosa que fuera de contexto preocupe sin motivo. Marca como visible
lo que enseña avance.

Cada foto muestra su etiqueta, así que no hay dudas sobre quién la está
viendo.

### Filtrar

Por proyecto y por zona.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET · POST /api/documents` | Documentos |
| `GET /api/documents/:id/download-url` | Enlace temporal de descarga |
| `GET · POST /api/photos` | Fotos |
| `GET /api/photos/:id/url` | Enlace temporal de la imagen |

Los archivos viven en Supabase Storage, no en la base de datos. Las tablas
`documents` y `photos` guardan la ruta de almacenamiento y los metadatos.

**Ningún archivo tiene URL pública permanente.** Cada acceso genera un enlace
firmado que caduca. Es lo que impide que la foto del interior de la casa de un
cliente quede accesible para siempre a quien tenga el enlace.

Las subidas pasan por `multer` en memoria, con un límite de 10 MB por archivo.
