/**
 * Lo que comparten los vídeos de la serie 2 (el equipo en la obra): la hora
 * de la mañana en el móvil y la tarjeta final de los Shorts, que manda al
 * vídeo largo.
 *
 * No es un guion (no tiene `pasos`): `--todos` lo salta.
 */
import { TRABAJADOR, primeraHora } from "../demo.mjs";

/** Las siete y pico en el teléfono, se grabe cuando se grabe. Ver primeraHora(). */
export const MANANA = primeraHora();

export const contextoDeObra = (idioma) => ({
  geolocation: TRABAJADOR[idioma].obra,
  permissions: ["geolocation"],
  timezoneId: MANANA.zona,
});

export const FINAL_SERIE2 = {
  fr: {
    sobre: "La vidéo complète est sur la chaîne",
    titulo: "Votre équipe *pointée, localisée*, ses heures prêtes.",
    texto: "Le code, la journée, le pointage GPS, la carte et les heures pour la paie.",
    pie: "<b>Essai gratuit de 30 jours</b> · logiciel-construction.com",
  },
};
