import { createSSRApp, createApp } from "vue";
import App from "./App.vue";

const root = document.getElementById("app");
if (root) {
  if (root.firstElementChild) {
    createSSRApp(App).mount("#app", true);
  } else {
    createApp(App).mount("#app");
  }
}
