/**
 * 路由权限拦截器
 *
 * 作用：在每次页面跳转前自动检查登录状态，实现全局路由守卫。
 *
 * 工作流程：
 *   页面跳转 → invoke 触发 → 提取目标路径
 *     ↓
 *   命中白名单？→ 是 → 直接放行
 *     ↓
 *   有 token？→ 是 → 放行（若目标是登录页则跳首页）
 *     ↓
 *   无 token → 跳转登录页，拦截本次跳转
 *
 * 接入方式：在 main.js（Vue3 分支）中 import 本文件：
 *   import '@/permission'
 */

import { storage } from '@/utils/storage';
import { ROUTES, STORAGE_KEYS } from '@/config';

// ==================== 路由配置 ====================

/**
 * 白名单路径集合（无需登录即可访问）
 *
 * 白名单内的页面跳转不做 token 校验，直接放行。
 * 添加新白名单页面：在 config.ts 的 ROUTES 添加路径后，在此引用即可。
 */
const WHITE_LIST = new Set<string>([
	ROUTES.login,
	ROUTES.home,
	ROUTES.webview,
]);

// ==================== 工具函数 ====================

/**
 * 获取登录 token
 *
 * 从本地存储读取 token，用于判断登录状态。
 * 如有独立的 auth 模块，可替换此实现。
 */
function getToken() : string {
	return storage.getString(STORAGE_KEYS.token) || '';
}

/**
 * 判断路径是否在白名单中
 * @param path 不含查询参数的路径，如 '/pages/login/index'
 */
function isWhitelisted(path : string) : boolean {
	return WHITE_LIST.has(path);
}

/**
 * 页面进入前的副作用处理
 *
 * 某些页面进入时需要额外处理，如进入登录页时清除公告缓存。
 * 可在此按需扩展。
 *
 * @param path 目标页面路径
 */
function onBeforeEnter(path : string) : void {
	if (path === ROUTES.login) {
		// 进入登录页时清除首页公告已读记录，确保重新登录后能看到最新公告
		storage.remove(STORAGE_KEYS.latestAnnouncement);
	}
}

// ==================== 拦截器注册 ====================

/**
 * 初始化路由权限拦截器
 *
 * 监听所有页面跳转方式（navigateTo / redirectTo / reLaunch / switchTab），
 * 统一做权限校验。
 *
 * 调用时机：在 main.js 应用启动时调用一次即可。
 */
export function initPermission() : void {
	const navigateMethods = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'] as const;

	navigateMethods.forEach((method) => {
		uni.addInterceptor(method, {
			/**
			 * 跳转前拦截
			 * @returns true 放行，false 拦截
			 */
			invoke(to : { url : string }) : boolean {

				// 提取不含查询参数的路径（如 /pages/index/index?id=1 → /pages/index/index）
				const path = to.url.split('?')[0];

				// 触发页面进入前的副作用
				onBeforeEnter(path);

				if (isWhitelisted(path)) {
					return true;
				}

				const token = getToken();

				if (token) {
					// 已登录时，若目标是登录页则跳首页（防止已登录用户回到登录页）
					if (path === ROUTES.login) {
						uni.reLaunch({ url: ROUTES.home });
						return false;
					}
					return true;
				} else {
					// 未登录，跳转登录页
					uni.reLaunch({ url: ROUTES.login });
					return false;
				}
			},

			fail(err : any) : void {
				console.error(`[Permission] ${method} 跳转失败:`, err);
			},
		});
	});
}
