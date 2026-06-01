import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Vite's BASE_URL is "/" in both local dev and production now that the app
// is served at the root of innovate.bonhams.com. The setBaseUrl branch below
// remains in case we ever re-introduce a path prefix.
const apiBasePath = import.meta.env.BASE_URL.replace(/\/+$/, "");
if (apiBasePath) {
  setBaseUrl(apiBasePath);
}

createRoot(document.getElementById("root")!).render(<App />);
