# El canal de YouTube de Logiciel Construction

Todo lo que hace falta para abrir el canal y subir los dos primeros vídeos.
Las imágenes están en esta carpeta; los textos, abajo, listos para copiar.

| Archivo | Para qué | Medida |
|---|---|---|
| `perfil.png` | Foto del canal (YouTube la recorta en círculo) | 800 × 800 |
| `banner.png` | Imagen de cabecera; todo cabe en la zona que se ve en el móvil | 2560 × 1440 |
| `miniatura-it.jpg` | Miniatura del vídeo italiano | 1280 × 720 |
| `miniatura-fr.jpg` | Miniatura del vídeo francés | 1280 × 720 |

Los vídeos son `sitio/videos/logiciel-it.mp4` y `sitio/videos/logiciel-fr.mp4`
(los que tienen audio; los `-scroll.mp4` son sólo para la web).

---

## 1. Crear el canal

Créalo como **cuenta de marca**, no como canal personal: así pueden
gestionarlo varias personas sin compartir contraseñas, y si un día cambia
quién lo lleva, el canal no se va con esa persona.

1. Entra en YouTube con la cuenta de Google de la empresa.
2. Foto de perfil (arriba a la derecha) → **Configuración** → **Añadir o
   administrar canales** → **Crear un canal**.
3. Nombre: **Logiciel Construction**.
4. Identificador (handle): **@LogicielConstruction** — es el que quedó:
   https://www.youtube.com/@LogicielConstruction. Si algún día cambia, hay
   que cambiarlo también en `CANAL_YOUTUBE` de `sitio/construir.mjs`. Ya está enlazado desde
   el pie de la web y en los datos que leen los buscadores (`sameAs`).

## 2. Personalizarlo

YouTube Studio → **Personalización**:

- **Imagen de banner**: `banner.png`.
- **Foto**: `perfil.png`.
- **Información básica → Descripción**: la francesa de abajo (el mercado
  principal es Quebec). Después, en **Añadir idioma**, la italiana, la
  española y la inglesa: cada persona ve la de su idioma.
- **Enlaces**: `https://logiciel-construction.com` con el título «Essai
  gratuit — 30 jours».
- **Correo de contacto**: el de soporte.

### Descripción del canal

**Français**

> Logiciel Construction : la gestion complète d'une entreprise de
> construction, du chantier jusqu'au paiement. Pointage GPS des travailleurs,
> soumissions, factures avec les bonnes taxes (TPS/TVQ, retenue de 10 %),
> rapport mensuel CCQ, portail client, et un assistant qui répond avec vos
> vraies données. Fait pour le Québec, disponible aussi en Italie.
> Essai gratuit de 30 jours, sans carte : logiciel-construction.com

**Italiano**

> Logiciel Construction: la gestione completa di un'impresa edile, dal
> cantiere all'incasso. Timbratura GPS degli operai, preventivi, fatture con
> l'IVA giusta e l'XML per lo SDI, SAL, congruità della manodopera, portale
> del cliente e un assistente che risponde con i tuoi dati veri.
> Prova gratuita di 30 giorni, senza carta: logiciel-construction.com

**Español**

> Logiciel Construction: la gestión completa de una empresa de construcción,
> de la obra al cobro. Fichaje con GPS, presupuestos, facturas con el
> impuesto correcto, portal del cliente y un asistente que responde con tus
> datos reales. Prueba gratuita de 30 días, sin tarjeta:
> logiciel-construction.com

**English**

> Logiciel Construction: complete management for a construction business,
> from the job site to getting paid. GPS clock-in for your crew, estimates,
> invoices with the right tax, client portal, and an assistant that answers
> with your real data. 30-day free trial, no card:
> logiciel-construction.com

---

## 3. Subir los vídeos

Uno por idioma, cada uno con su idioma puesto en **Idioma del vídeo**: así
YouTube se lo enseña a quien habla ese idioma, y los subtítulos automáticos
salen en el idioma correcto.

Para cada uno: **Crear → Subir vídeos**, y:

- **Miniatura**: la suya de esta carpeta.
- **Lista de reproducción**: crea dos, «Logiciel Construction — Italiano» y
  «Logiciel Construction — Français».
- **Público**: «No, no es contenido creado para niños».
- **Categoría**: Ciencia y tecnología.
- **Licencia de música**: si el vídeo lleva música, confirma que es de uso
  libre antes de publicarlo; si YouTube marca un aviso de derechos, el vídeo
  puede quedar bloqueado en algunos países.

Los capítulos salen solos: YouTube los lee de la descripción porque empiezan
en `0:00` y cada uno dura al menos 10 segundos. Los he medido sobre el vídeo.

### Vídeo italiano — `logiciel-it.mp4`

**Título**

> Gestionale per imprese edili: cantiere, fatture e SDI in 2 minuti | Logiciel Construction

**Descrizione**

> Il cantiere senza carte. In meno di due minuti: la timbratura con GPS degli
> operai, le fatture con l'IVA giusta e l'XML pronto per lo SDI, e il tuo
> assistente che risponde con i tuoi dati veri.
>
> Prova gratuita di 30 giorni, senza carta:
> https://logiciel-construction.com/it/?utm_source=youtube&utm_medium=video&utm_campaign=presentazione
>
> 0:00 Tu costruisci
> 0:16 Tre problemi di ogni settimana, risolti
> 0:33 Fatture con l'IVA giusta e l'XML per lo SDI
> 0:48 Non cercare: chiedi al tuo assistente
> 1:06 Le regole del tuo paese, già dentro
> 1:26 Nella tua lingua — provalo con i tuoi cantieri
>
> Operai illimitati · Mese per mese, senza contratto · Italiano, francese,
> inglese e spagnolo.

**Tag**

> gestionale edilizia, software impresa edile, fatturazione elettronica edilizia, SDI, fattura elettronica, SAL, congruità manodopera, timbratura GPS, preventivi edilizia, gestione cantiere, Logiciel Construction

### Vídeo francés — `logiciel-fr.mp4`

**Titre**

> Logiciel de gestion pour entrepreneurs en construction au Québec en 2 minutes | Logiciel Construction

**Description**

> Le chantier sans paperasse. En moins de deux minutes : le pointage GPS de
> vos travailleurs, des factures avec les bonnes taxes (TPS/TVQ et retenue),
> et votre assistant qui répond avec vos vraies données.
>
> Essai gratuit de 30 jours, sans carte :
> https://logiciel-construction.com/fr/?utm_source=youtube&utm_medium=video&utm_campaign=presentation
>
> 0:00 Vous construisez
> 0:16 Trois problèmes de chaque semaine, réglés
> 0:31 Des factures avec les taxes de votre pays
> 0:41 Ne cherchez pas : demandez à votre assistant
> 0:56 Ce qui change d'un pays à l'autre, déjà fait
> 1:14 Dans votre langue — essayez-le avec vos vrais chantiers
>
> Travailleurs illimités · Au mois, sans contrat · Français, anglais,
> espagnol et italien.

**Mots-clés**

> logiciel construction, logiciel entrepreneur construction, gestion de chantier, facturation construction, TPS TVQ, retenue 10 %, rapport mensuel CCQ, pointage GPS, soumission construction, Québec, Logiciel Construction

---

## 4. Lo que viene después

- **Shorts.** El formato que más se ve en el móvil es vertical (9:16) y de
  menos de un minuto. Una versión vertical de cada escena del vídeo —«Non
  cercare. Chiedi.», las facturas, la timbratura— sirve a la vez para
  YouTube Shorts, Instagram Reels y TikTok, y es también la que haría falta
  para que el vídeo de la web ocupe toda la pantalla del móvil.
- **Un vídeo por función** (2–4 minutos): el SAL, la congruità, la factura
  electrónica, el rapport CCQ. Responden a búsquedas concretas que hace un
  contratista antes de buscar un programa, igual que la página de la CCQ.
- **Cuando los vídeos estén subidos**, la web puede enlazar cada uno desde
  su sección para quien prefiera verlo en YouTube.
