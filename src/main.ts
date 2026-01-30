import { createPinia } from 'pinia'
import { Dialog, Notify, Quasar } from 'quasar'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Quasar, {
  plugins: { Notify, Dialog },
})
app.mount('#app')
