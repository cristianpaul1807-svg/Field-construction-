# Instalar la aplicación en el móvil

La aplicación es una PWA: se instala desde el propio navegador y **no está en
ninguna tienda**. Eso es una ventaja real —nada que aprobar, nada que esperar,
y una actualización llega a todos a la vez— y tiene un coste: nadie la busca en
la App Store, nadie la encuentra, y nadie descubre solo que esto se puede poner
en la pantalla de inicio.

Por eso hay que decirlo. El aviso está en `client/src/components/InstalarApp.tsx`
y sale en `/`, que es la puerta por la que pasan el jefe, el trabajador y el
cliente.

---

## Cómo se usa

En la pantalla de inicio, debajo de las dos puertas de trabajador y cliente,
aparece una tarjeta: **«Llévala en el móvil»**. Empieza plegada — quien llega
ahí viene a entrar a trabajar, no a instalar nada.

Lo que pasa al tocarla depende del teléfono, porque cada sistema lo hace
distinto y sólo uno se puede automatizar.

| Dónde está | Qué ve | Por qué |
|---|---|---|
| Android o escritorio con Chrome o Edge | Un botón **Instalar** que abre el diálogo del navegador | Avisan con `beforeinstallprompt` y dejan abrirlo desde un botón |
| iPhone o iPad con Safari | Los tres pasos: Compartir → Añadir a pantalla de inicio → Añadir | Safari no tiene ninguna API para esto |
| iPhone con otro navegador, o dentro de WhatsApp | «Aquí no se puede instalar. Ábrelo en Safari», con la dirección lista para copiar | Ahí esa opción **no existe** |
| Android con otro navegador | Cómo llegar por el menú de los tres puntos | Existe en todos, con nombres parecidos |
| Ya instalada | Nada | No hay nada que ofrecer |
| Escritorio que no lo soporta | Nada | Contar cómo instalar algo que este navegador no instala es hacer perder el tiempo |

### El caso de WhatsApp es el que más importa

Al trabajador el enlace le llega por WhatsApp. Si lo abre desde ahí está dentro
de una ventana incrustada, que es exactamente donde **no se puede instalar**.

Enseñarle ahí «toca Compartir → Añadir a pantalla de inicio» es mandarle a
buscar un botón que no está en su pantalla, y el resultado es que se queda
convencido de que la aplicación está rota. Es la regla de **no dar controles
muertos**, aplicada a unas instrucciones: si no se puede, no se explica cómo —
se dice lo único que sí funciona.

---

## Por dentro

| Pieza | Dónde |
|---|---|
| La detección y el evento del navegador | `client/src/lib/instalar.ts` |
| La tarjeta | `client/src/components/InstalarApp.tsx` |
| Dónde sale | `client/src/pages/Landing.tsx` |
| Los textos | `client/src/i18n/locales/*.json`, grupo `instalar.` |

### El oyente se engancha al arrancar, no en el componente

`escucharLaInstalacion()` se llama desde `client/src/main.tsx`, junto al
registro del *service worker*.

`beforeinstallprompt` se dispara **una vez y pronto**, normalmente antes de que
React haya montado nada. Escucharlo desde un `useEffect` es llegar tarde al
único aviso que da el navegador: el evento ya pasó, no se repite, y el botón de
instalar no aparece nunca aunque el navegador estuviera dispuesto. Es un fallo
que no da ningún error; simplemente no sale el botón.

El evento se guarda en el módulo y los componentes se suscriben con
`alCambiar()`.

### Cómo se distingue Safari de la ventana de WhatsApp

Todos los navegadores del iPhone usan el motor de Safari, así que **todos dicen
«Safari»** en su identificación. Lo que los separa es `Version/`: lo pone el
navegador completo y no lo ponen las ventanas que abren WhatsApp, Instagram o
Facebook dentro de sí mismas.

```ts
if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;  // Chrome, Firefox…
return / Version\/\d/.test(ua);                          // Safari de verdad
```

### Ya instalada

`display-mode: standalone` lo dice en todas partes menos en iOS, que tiene su
propio `navigator.standalone` desde antes de que existiera el estándar. Se
miran los dos.

Además se escucha `appinstalled` para retirar el ofrecimiento **en el momento**
en que se acepta, y no en la siguiente carga.

---

## Comprobado

Las cinco situaciones se probaron con un navegador de verdad, cambiando la
identificación y lanzando el evento del sistema:

| Situación | Resultado |
|---|---|
| iPhone en Safari | Los tres pasos |
| iPhone dentro de WhatsApp | «Aquí no se puede instalar, ábrelo en Safari» |
| Android con Chrome | Se abre el diálogo de instalación del navegador |
| Ya instalada (`navigator.standalone` y `display-mode`) | No sale la tarjeta |
| Escritorio sin soporte | No sale la tarjeta |

Vale la pena repetirlo si se toca la detección: es lógica que depende de cómo
se presenta cada navegador, y eso cambia sin avisar.

---

## Lo que hay que cuidar al tocarlo

**No prometer lo que el navegador no hace.** Es toda la razón de ser de este
aviso. Antes de añadir un camino nuevo, comprobar que ahí esa opción existe de
verdad.

**El icono es el casco.** Sale de `assets/logo-source.png` por
`scripts/build-icons.mjs`, y el paso 3 de iOS dice literalmente «ya la tienes
con el casco en tu pantalla». Si cambia el logo, esa frase sigue siendo
verdad sólo si se regeneran los iconos — ver `docs/funciones/sitio-web.md`.
