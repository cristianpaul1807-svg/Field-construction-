/**
 * Los identificadores fiscales italianos, comprobados antes de guardarlos.
 *
 * Una factura electrónica con la Partita IVA mal escrita no llega: el SDI la
 * rechaza días después, cuando el cliente ya espera cobrar. Los dos números
 * llevan un dígito de control justo para esto, así que un error de tecleo se
 * puede decir en el momento de escribirlo en vez de descubrirlo en un rechazo.
 */

/** 11 cifras, la última de control (algoritmo de Luhn con la variante italiana). */
export function esPartitaIvaValida(valor: string): boolean {
  const pi = valor.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(pi)) return false;
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const d = Number(pi[i]);
    if (i % 2 === 0) {
      suma += d;
    } else {
      const doble = d * 2;
      suma += doble > 9 ? doble - 9 : doble;
    }
  }
  return (10 - (suma % 10)) % 10 === Number(pi[10]);
}

/** Lo que vale cada carácter en posición impar (1.ª, 3.ª…) para el control. */
const IMPARES: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/** En posición par las cifras valen lo que son y las letras su orden (A = 0). */
const valorPar = (c: string) => (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65);

/**
 * El codice fiscale.
 *
 * El de una persona son 16 caracteres con una letra de control al final. El
 * de una sociedad son 11 cifras y coincide con su Partita IVA, así que se
 * comprueba igual que ella.
 */
export function esCodiceFiscaleValido(valor: string): boolean {
  const cf = valor.replace(/\s+/g, "").toUpperCase();
  if (/^\d{11}$/.test(cf)) return esPartitaIvaValida(cf);
  // Las cifras pueden venir cambiadas por letras (omocodia), por eso el patrón
  // admite letras donde normalmente hay números.
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
  let suma = 0;
  for (let i = 0; i < 15; i++) {
    suma += i % 2 === 0 ? IMPARES[cf[i]] : valorPar(cf[i]);
  }
  return String.fromCharCode(65 + (suma % 26)) === cf[15];
}

/** A dónde le llega la factura electrónica: 7 caracteres, o «0000000» si va por PEC o es un particular. */
export function esCodiceDestinatarioValido(valor: string): boolean {
  return /^[A-Z0-9]{7}$/.test(valor.replace(/\s+/g, "").toUpperCase());
}

/** El código postal italiano: 5 cifras. */
export function esCapValido(valor: string): boolean {
  return /^\d{5}$/.test(valor.trim());
}
