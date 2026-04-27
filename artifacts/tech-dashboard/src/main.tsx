import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When the dashboard is served under a path prefix (e.g. /tech-dashboard/),
// prepend that prefix to every API request so browser fetches resolve to the
// right Traefik route. Vite's BASE_URL is "/" in local dev, so this is a
// no-op there.
const apiBasePath = import.meta.env.BASE_URL.replace(/\/+$/, "");
if (apiBasePath) {
  setBaseUrl(apiBasePath);
}

createRoot(document.getElementById("root")!).render(<App />);
