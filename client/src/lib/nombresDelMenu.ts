import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Los nombres de las pantallas, sacados del propio menú.
 *
 * Para cuando un texto tiene que decir «ve a Configuración → Datos de la
 * empresa». Escribirlo a mano parece inofensivo y no lo es: son cuatro copias,
 * una por idioma, que nadie vuelve a comparar con el menú.
 *
 * Ya había divergido en varios sitios a la vez. La ayuda mandaba en francés a
 * «TERRAIN → Registre de travail» cuando el menú dice CHANTIER → Suivi des
 * travaux; el aviso del GPS decía «Company details» cuando pone Company Data;
 * las nóminas mandaban en castellano a «Check-in» cuando la entrada se llama
 * Fichaje. Ninguno daba error: simplemente mandaban a una opción que no
 * existe con ese nombre, que es la peor forma de ayudar a alguien.
 *
 * Se usa interpolando en `t()`:
 *
 * ```tsx
 * const menu = useNombresDelMenu();
 * t("gps.noAddressHint", menu)   // "…en {{menuAjustes}} → {{menuEmpresa}}…"
 * ```
 *
 * Lo vigila `scripts/check-help-menu.py`, que falla si alguien vuelve a
 * copiar el nombre de una pantalla dentro de un texto.
 */
export function useNombresDelMenu() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      menuAjustes: t("nav.settings"),
      menuEmpresa: t("nav.companyData"),
      menuCampo: t("nav.field"),
      menuTecnicos: t("nav.technicians"),
      menuOrdenes: t("nav.workOrders"),
      menuRegistro: t("nav.workLog"),
      menuFichaje: t("nav.checkIn"),
      menuFinanzas: t("nav.finance"),
      menuFacturacion: t("nav.invoicing"),
      menuInformes: t("nav.reports"),
      menuCrm: t("nav.crm"),
      menuPagos: t("nav.payments"),
      menuMargenes: t("nav.margins"),
      menuTipos: t("nav.serviceTypes"),
      menuPortal: t("nav.clientPortalShort"),
      menuProyectos: t("nav.projects"),
    }),
    [t]
  );
}
