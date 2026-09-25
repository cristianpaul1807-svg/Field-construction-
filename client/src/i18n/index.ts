import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const LANGUAGE_STORAGE_KEY = "fsm-language";

/**
 * Donde cae quien habla un idioma que no tenemos.
 *
 * Era el castellano, porque las claves se escribieron en castellano. Pero el
 * servidor cae en francés —correos, documentos, el chat— y la misma persona
 * con el navegador en alemán leía el portal en castellano y la factura que le
 * llegaba en francés. Francés porque es el idioma del mercado y el que manda
 * la ley allí. Lo vigila `scripts/check-idioma-respaldo.py`.
 */
export const IDIOMA_DE_RESPALDO = "fr";

/**
 * Cada idioma se baja cuando hace falta, no los cuatro de entrada.
 *
 * Son 660 KB de textos y cada persona lee uno. Con los cuatro dentro del
 * paquete, el trabajador que abre `/campo` con media raya de cobertura se
 * bajaba el italiano, el inglés y el castellano para leer francés.
 *
 * i18next se baja también el de respaldo, así que quien lee francés —el
 * mercado— baja un solo fichero, y quien lee otro, dos.
 */
const cargarIdioma = {
  type: "backend" as const,
  init() {},
  read(lng: string, _ns: string, listo: (err: unknown, datos: Record<string, unknown> | null) => void) {
    import(`./locales/${lng}.json`).then(
      (m: { default: Record<string, unknown> }) => listo(null, m.default),
      (err: unknown) => listo(err, null),
    );
  },
};

/** Se espera antes de pintar nada: un texto que aún no llegó se vería como su clave. */
export const idiomaListo = i18n
  .use(cargarIdioma)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: IDIOMA_DE_RESPALDO,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    // A visitor arriving at /c/[slug] should get their browser's language
    // without ever having picked one; the explicit choice, once made, wins
    // and persists.
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

// El index.html se sirve con lang="en" fijo. Un producto en cuatro idiomas que
// dice ser inglés hace que el lector de pantalla pronuncie el francés con
// fonética inglesa y que el navegador ofrezca traducir una página que ya está
// en el idioma del usuario. Se corrige aquí, que es donde se sabe el idioma.
const marcarIdioma = (lng: string) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
};
marcarIdioma(i18n.language);
i18n.on("languageChanged", marcarIdioma);

export default i18n;
