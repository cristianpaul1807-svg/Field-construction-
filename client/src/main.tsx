import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Side-effect import: configures the shared i18next instance before any
// component that calls useTranslation() renders.
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
