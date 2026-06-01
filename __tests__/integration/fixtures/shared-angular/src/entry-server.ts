import "zone.js/node";
import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { renderApplication } from "@angular/platform-server";
import { AppComponent } from "./app/app.component";
import { config } from "./app/app.config.server";

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Angular Fixture</title></head>
<body><app-root><!--ssr-outlet--></app-root></body>
</html>`;

export async function render(url: string): Promise<string> {
    const bootstrap = () => bootstrapApplication(AppComponent, config);
    return renderApplication(bootstrap, { document: TEMPLATE, url });
}
