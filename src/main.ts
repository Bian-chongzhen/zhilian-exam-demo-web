import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import { bootstrapMockDb } from './mock/db'
import { setupIcons } from './plugins/icons'
import './styles/global.css'

// 初始化 Mock 数据库（首次运行写入假数据种子）
bootstrapMockDb()

// 注册 Iconify 的 ph 图标集（离线打包；图标集固定为 ph，见 16 号 §8.1）
setupIcons()

const app = createApp(App)

Object.entries(ElementPlusIconsVue).forEach(([key, component]) => {
  app.component(key, component)
})

// 业务语义图标统一走 Iconify（图标名前缀固定为 ph，写法示例见 AppLayout 的菜单渲染）
// （Element Plus 自身组件内部仍使用其内置图标，见 16 号 §8.1 第 4 条）
app.component('Icon', Icon)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
