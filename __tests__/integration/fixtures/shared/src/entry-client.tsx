import React from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./App";

(window as any).__navigationCount = ((window as any).__navigationCount || 0) + 1;

const container = document.getElementById("app-root") || document.getElementById("root");
if (container) {
    if (container.firstChild) {
        hydrateRoot(container, <App />);
    } else {
        createRoot(container).render(<App />);
    }
}
