import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import SpinnerBtn from "@/components/SpinnerBtn.vue";

import router from "./router";
import "./style.scss";

const app = createApp(App);

app.component("spinner-btn", SpinnerBtn);

app.use(createPinia());
app.use(router);

app.mount("#app");
