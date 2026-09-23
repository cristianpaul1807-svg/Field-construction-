import { Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AvisoDeFallo } from "@/components/AvisoDeFallo";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lo que se ve cuando una pantalla se rompe entera.
 *
 * Esto contaba el fallo a su manera: dos frases en inglés fijo —las únicas del
 * producto que no pasaban por `t()`— y debajo la traza de JavaScript en crudo,
 * de primeras y a pantalla completa. Un carpintero en una obra leía
 * «An unexpected error occurred» seguido de veinte líneas de `at Qee
 * (index-DF_FYj5N.js:42:1337)`, en un idioma que puede no ser el suyo, sin
 * ninguna frase que le dijera si había perdido lo que estaba escribiendo ni a
 * quién preguntar.
 *
 * Ya había una respuesta a eso en el producto —`AvisoDeFallo`, que es lo que
 * sale cuando falla una petición— y decía justo lo que aquí faltaba: la frase
 * primero, en su idioma, con una salida a la que ir; el detalle técnico
 * plegado detrás de un enlace, porque no se tira (es lo único que sirve cuando
 * alguien nos escribe) pero tampoco se pone delante. Este era el único sitio
 * que se había quedado fuera, y es precisamente el peor, porque es el que sale
 * cuando ya no funciona nada más.
 */
function PantallaRota({ traza }: { traza: string | null }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-8 bg-background">
      <div className="w-full max-w-2xl">
        <AvisoDeFallo
          mensaje={t("errores.pantallaRota")}
          detalle={traza}
          // Recargar y no reintentar: el árbol de React ya está roto, así que
          // volver a pintar lo mismo da el mismo fallo. Lo que hace falta es
          // empezar de cero.
          onReintentar={() => window.location.reload()}
        />
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        // El atributo lo mira `comprobar-ancho-panel.mjs`: un aviso de error
        // cabe en cualquier móvil, así que sin poder reconocerlo el guardia
        // daba por buenas tres pantallas que en realidad habían reventado.
        <div data-error-boundary>
          <PantallaRota traza={this.state.error?.stack ?? null} />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
