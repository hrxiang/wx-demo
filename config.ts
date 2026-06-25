/**
 * 全局应用配置
 *
 * 集中管理项目中跨模块共享的常量配置，避免分散定义导致改一处漏改其他地方。
 *
 * 修改指引：
 *   - 路由路径变更    → 修改 ROUTES 对应字段
 *   - token 键名变更  → 修改 STORAGE_KEYS.token
 *   - 后端状态码变更  → 修改 API_CODE 对应字段
 *   - 接口基础路径变更 → 修改对应环境的 env/env.{mode}.ts 中的 baseUrl
 */

import { envConfig } from '@/env';

// ==================== 路由路径 ====================

/**
 * 应用路由路径配置
 *
 * 所有页面路径在此统一定义，permission.ts / request.ts 等模块从此处引用，
 * 路径变更时只需修改此处即可。
 */
export const ROUTES = {
	/** 登录页（未登录时跳转目标、白名单成员） */
	login: '/pages/login/index',

	/** 登录后的默认首页（已登录用户访问登录页时跳转目标） */
	home: '/pages/index/index',

	/** 公共 WebView 页（白名单成员） */
	webview: '/pages/common/webview/index',
} as const;

// ==================== 本地存储键名 ====================

/**
 * 本地存储键名配置
 *
 * 统一管理 storage key，避免拼写错误和重复定义。
 * 修改键名时此处改一次，所有使用方自动同步。
 */
export const STORAGE_KEYS = {
	/** 登录 token */
	token: 'token',

	/** 首页公告已读标记 */
	latestAnnouncement: 'Key_LatestAnnouncement',
} as const;

// ==================== 接口配置 ====================

/**
 * 后端接口基础配置
 *
 * baseUrl 自动从当前激活的环境配置读取（env/env.current.ts），
 * 切换环境只需在 HBuilderX 运行菜单中选择对应环境，无需手动修改代码。
 */
export const API = {
	/** 接口基础路径，自动从当前环境读取 */
	baseUrl: envConfig.baseUrl,

	/** 请求超时时间（毫秒） */
	timeout: 15000,
} as const;

// ==================== 业务状态码 ====================

/**
 * 后端约定的业务状态码
 *
 * 根据实际后端约定修改此处，request.ts 的响应拦截器从此处读取。
 */
export const API_CODE = {
	/** 请求成功 */
	success: 200,

	/**
	 * token 异常状态码列表（命中任意一个则清除 token 并跳登录页）
	 *
	 * 常见场景：
	 *   401 — 未登录 / token 缺失
	 *   403 — token 已过期
	 *   423 — 账号已被冻结
	 *
	 * 添加新的 token 异常码：在数组里直接尾部添加即可，无需修改 request.ts
	 */
	tokenExpired: [401, 403],
} as const;
