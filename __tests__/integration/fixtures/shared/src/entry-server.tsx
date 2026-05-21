import React from "react";
import { renderToString } from "react-dom/server";
import App from "./App";

export function render(url: string): string {
    return renderToString(<App />);
}
