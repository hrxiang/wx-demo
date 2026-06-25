/**
 * main.js — 应用入口文件
 *
 * 本文件是 UniApp 应用的唯一入口，由 HBuilderX 在启动时自动调用。
 * 负责以下五个核心职责：
 *
 * ① 创建 Vue 应用实例
 *   使用 createSSRApp （兼容 SSR 与客户端渲染）创建全局唯一的 Vue 实例。
 *   返回对象中的 app 供 HBuilderX 运行时挂载使用。
 *
 * ② 安装 Pinia 状态管理
 *   调用 app.use(Pinia.createPinia()) 安装 Pinia。
 *   安装后所有页面与组件均可直接通过 useXxxStore() 访问全局状态。
 *   注意： HBuilderX 内置 Pinia，无需 npm install，并且必须将 Pinia 一并返回以支持 SSR。
 *   使用示例：
 *     import { useUserStore } from '@/stores'
 *     const userStore = useUserStore()
 *
 * ③ 全局注入分享 mixin
 *   调用 app.mixin(share) 将分享能力注入所有页面。
 *   注入后所有页面自动支持微信小程序的「分享给朋友」和「分享到朋友圈」功能。
 *   页面如需自定义分享内容，在自身 data 里覆盖 share 对象即可：
 *     data() {
 *       return {
 *         share: { title: '页面标题', path: '/pages/xxx', imageUrl: '/static/xxx.png' }
 *       }
 *     }
 *
 * ④ 初始化全局 loading
 *   导入 '@/utils/loading' 即完成初始化，无需额外操作。
 *   全局任意地方可通过 uni.loading 控制加载状态：
 *     uni.loading.show()  // 显示 loading
 *     uni.loading.hide()  // 隐藏 loading（内部采用引用计数，防止并发请求时提前关闭）
 *
 * ⑤ 初始化路由权限拦截器
 *   调用 initPermission() 安装 uni.addInterceptor 拦截器。
 *   拦截器会在每次路由跳转前检查登录状态，未登录则自动跳转到登录页。
 *   白名单路由（无需登录可直接访问）在 permission.ts 中配置。
 */

import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'               // HBuilderX 内置 Pinia，无需 npm 安装
import App from './App.vue'
import '@/utils/loading'                      // 全局 loading，只需导入一次
import { initPermission } from '@/permission' // 路由权限拦截器
import share from '@/share.js'               // 全局分享 mixin
export function createApp() {
	const app = createSSRApp(App)

	// app.use() — 安装“插件”：插件内部有 install() 方法，用于向全局提供服务（如状态管理、路由、UI 库等）。
	// 适用场景：自带 install 方法的第三方库。
	app.use(Pinia.createPinia()) // 安装 Pinia 状态管理，所有页面可通过 useXxxStore() 获取全局状态

	// app.mixin() — 注入“选项”：将 data/methods/生命周期等选项直接合并到每个页面和组件中。
	// 适用场景：普通 Options API 对象（无 install 方法），需要全局注入行为的场景。
	app.mixin(share)             // 全局注入分享能力，所有页面自动支持「分享给朋友」和「分享到朋友圈」

	initPermission()             // 应用启动时初始化路由拦截器
	return {
		app,
		Pinia, // HBuilderX 要求必须将 Pinia 返回，用于 SSR 支持
	}
}