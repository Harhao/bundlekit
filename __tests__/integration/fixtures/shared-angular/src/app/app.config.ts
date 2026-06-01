import type { ApplicationConfig } from "@angular/core";
import { provideZoneChangeDetection } from "@angular/core";
import { provideClientHydration } from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideClientHydration(),
    ],
};
