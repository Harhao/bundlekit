import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import App from "./App.vue";

export async function render(url) {
  const app = createSSRApp(App);
  return renderToString(app);
}
