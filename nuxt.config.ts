import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: true,
  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: {
    cssPath: '~/assets/css/main.css'
  },
  runtimeConfig: {
    // 服务端私密配置（也可通过.env覆盖）
    mongodbUri: process.env.MONGODB_URI || 'mongodb://192.168.28.9:27017',
    aiApiKey: process.env.AI_API_KEY || '',
    aiBaseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
    aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 300000),
    // 优化提示词专用模型（独立大模型，可选；留空则回退到上面的 AI_*）
    optAiApiKey: process.env.OPT_AI_API_KEY || '',
    optAiBaseUrl: process.env.OPT_AI_BASE_URL || '',
    optAiModel: process.env.OPT_AI_MODEL || '',
    optAiTimeoutMs: Number(process.env.OPT_AI_TIMEOUT_MS || 120000),
    appSecret: process.env.APP_SECRET || 'gamehub-default-secret',
    public: {
      // 暴露给前端的配置
      wsPath: '/ws',
      wsPort: Number(process.env.WS_PORT || 3001)
    }
  },
  devtools: { enabled: false },
  compatibilityDate: '2024-09-01',
  nitro: {
    // 使用真实的 undici 包（流式读取 SSE）。Nitro 默认会把 undici 别名为 unenv 的
    // fetch polyfill，而 unenv 的流式读取在部分网关（如 amd.com.cn）下不会分块/会挂起。
    // 将其标记为 external，运行时直接从 node_modules 加载真正的 undici。
    externals: {
      external: ['undici']
    }
  }
})
