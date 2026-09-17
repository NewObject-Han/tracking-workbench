// 线上启动脚本：从环境变量 PORT 读取端口（发布沙箱注入），0.0.0.0 监听
import { preview } from 'vite'
import { resolve } from 'node:path'

const port = Number(process.env.PORT || 3000)
const root = process.cwd()

const server = await preview({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  preview: { host: '0.0.0.0', port },
})

console.log('LISTENING_ON=' + port)
console.log('URLS=' + (server.resolvedUrls?.local || []).join(','))
