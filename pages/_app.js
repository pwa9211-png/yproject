// pages/_app.js (必须创建此文件以导入全局 CSS)
import '../styles/global.css' // 引入我们创建的响应式 CSS

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}