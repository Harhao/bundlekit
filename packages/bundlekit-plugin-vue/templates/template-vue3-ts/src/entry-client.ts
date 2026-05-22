import { createSSRApp, createApp } from "vue";
import App from "./App.vue";

const root = document.getElementById("app");
if (root) {
  if (root.firstElementChild) {
    // SSR：Vue 用 createSSRApp + mount('#app', true) 启用 hydration
    createSSRApp(App).mount("#app", true);
  } else {
    createApp(App).mount("#app");
  }
}
