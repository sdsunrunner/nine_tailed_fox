import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";

// Vue Flow 样式（core 需显式引入；background/controls/minimap 附加包样式内联，无需引入）
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

import App from "./App.vue";
import router from "./router";
import "./styles/main.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus);
app.mount("#app");
