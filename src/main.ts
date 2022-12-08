import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import SpinnerBtn from "@/components/SpinnerBtn.vue";
import FontAwesomeIcon from "./mixin/icons";

import router from "./router";
import "./style.scss";
import { Analysis } from "./analysis";

Analysis.init();

const app = createApp(App);

app.component("spinner-btn", SpinnerBtn);
app.component("FontAwesomeIcon", FontAwesomeIcon);

app.use(createPinia());
app.use(router);

app.mount("#app");
