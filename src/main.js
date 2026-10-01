import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { siteConfig } from './config/site'

document.title = siteConfig.brandName
createApp(App).mount('#app')
