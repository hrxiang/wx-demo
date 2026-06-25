/**
 * 网络请求工具
 *
 * 基于 luch-request 封装，提供统一的请求拦截、响应拦截和错误处理。
 *
 * 功能：
 *   - 请求拦截：自动注入 token、统一设置 Content-Type
 *   - 响应拦截：统一解析业务状态码、处理 token 过期跳登录页
 *   - 错误处理：网络异常、超时、服务器错误统一提示
 *   - 支持跳过鉴权：单次请求可通过 custom.noAuth = true 跳过 token 注入
 *   - 支持跳过错误提示：单次请求可通过 custom.silent = true 跳过 toast 提示
 *   - 支持全局 loading：单次请求可通过 custom.loading = true 开启请求中 loading
 *     loading 基于全局 uni.$loading，支持引用计数，多个并发请求时 loading 不会提前关闭
 *
 * 使用示例：
 *   import { http } from '@/utils/request'
 *
 *   // GET 请求（返回单个对象）
 *   const user = await request.get<UserInfo>('/api/user/info')
 *   console.log(user.name)  // 直接使用，无需转换
 *
 *   // GET 请求（带查询参数） → /api/user/list?page=1&size=10
 *   const list = await request.get<UserInfo[]>('/api/user/list', { page: 1, size: 10 })
 *
 *   // GET 请求（返回数组 / List<Object>）
 *   const list = await request.get<UserInfo[]>('/api/user/list')
 *   list.forEach(item => console.log(item.name))  // 直接遍历，无需转换
 *
 *   // GET 请求（返回分页数据）
 *   interface PageResult<T> { total: number; records: T[] }
 *   const page = await request.get<PageResult<UserInfo>>('/api/user/page', { page: 1, size: 10 })
 *   console.log(page.total, page.records[0].name)
 *
 *   // POST 请求
 *   const res = await request.post<LoginResult>('/api/login', { username, password })
 *
 *   // 不注入 token
 *   const res = await request.get('/api/public', {}, { custom: { noAuth: true } })
 *
 *   // 不弹错误提示（由调用方自行处理）
 *   const res = await request.post('/api/submit', data, { custom: { silent: true } })
 *
 *   // 开启 loading（请求期间自动显示/隐藏）
 *   const list = await request.get('/api/list', {}, { custom: { loading: true } })
 *
 *   // 开启 loading 并自定义文案
 *   const res = await request.post('/api/save', data, { custom: { loading: true, loadingTitle: '保存中...' } })
 *
 * 注意：注入的注射类型仅是 TypeScript 编译期断言，运行时数据就是后端返回的原始 JSON。
 * 请确保接口类型定义与后端文档保持一致，否则字段不匹配时运行时不报错只会得到 undefined。
 */

import Request, {
	type HttpRequestConfig,
	type HttpResponse,
	type HttpError,
} from '@/js_sdk/luch-request/luch-request/index.js'; // DCloud 插件市场导入版本，适配小程序/H5/App 多端
import { storage } from '@/utils/storage';
import { ROUTES, STORAGE_KEYS, API, API_CODE } from '@/config';

// ==================== loading 工具 ====================

/**
 * 显示全局 loading
 *
 * 通过 uni.$loading.show() 展示 loading，返回关闭函数。
 * uni.$loading 由 utils/loading.ts 在应用启动时挂载，支持引用计数，
 * 多个并发请求同时调用 show() 时，只有所有请求都结束后 loading 才会真正关闭。
 *
 * @param title loading 文案，默认 '加载中...'
 * @returns 关闭当前这次 loading 的函数
 */
function showLoading(title = '加载中...'): () => void {
	if (typeof uni !== 'undefined' && uni.$loading) {
		return uni.$loading.show({ title });
	}
	// uni.$loading 未挂载时降级为原生 loading
	uni.showLoading({ title, mask: true });
	return () => uni.hideLoading();
}

// ==================== 类型定义 ====================

/**
 * 后端统一响应结构
 *
 * 根据实际后端约定调整字段名和类型。
 */
export interface ApiResponse<T = any> {
	/** 业务状态码，如 200 表示成功 */
	code: number;
	/** 业务提示信息 */
	message: string;
	/** 实际数据 */
	data: T;
}

/**
 * 自定义请求扩展参数（挂在 luch-request 的 custom 字段上）
 */
export interface RequestCustom {
	/** true = 跳过 token 注入，适合登录、注册等公开接口 */
	noAuth?: boolean;
	/** true = 跳过错误弹窗，由调用方自行处理异常 */
	silent?: boolean;
	/**
	 * true = 请求期间自动显示全局 loading，请求结束（成功或失败）后自动隐藏。
	 * 基于 uni.$loading 的引用计数，多个并发请求同时开启时 loading 不会提前关闭。
	 */
	loading?: boolean;
	/**
	 * loading 显示的文案，仅在 loading = true 时生效。
	 * 默认为 '加载中...'
	 */
	loadingTitle?: string;
	/**
	 * 内部字段：请求拦截器注入 showLoading 返回的关闭函数，响应拦截器调用它关闭 loading。
	 * 请勿在调用方中手动设置此字段。
	 */
	_hideLoading?: () => void;
}

// ==================== 创建实例 ====================

const http = new Request();

// ==================== 全局配置 ====================

http.setConfig((config: HttpRequestConfig) => {
	/** 接口基础路径 */
	config.baseURL = API.baseUrl;
	/** 超时时间 */
	config.timeout = API.timeout;
	/** 默认请求头 */
	config.header = {
		'Content-Type': 'application/json; charset=utf-8',
	};
	return config;
});

// ==================== 请求拦截器 ====================

/**
 * 请求拦截器
 *
 * 在请求发出前执行，可修改 header、body 等。
 * config.custom 为调用方传入的自定义参数（见 RequestCustom）。
 */
http.interceptors.request.use(
	(config: HttpRequestConfig) => {
		const custom = (config.custom || {}) as RequestCustom;

		// 开启 loading：展示全局 loading，并将关闭函数挂到 custom 上，
		// 响应拦截器会通过 custom._hideLoading() 将其关闭
		if (custom.loading) {
			custom._hideLoading = showLoading(custom.loadingTitle);
		}

		// 注入 token（noAuth = true 时跳过）
		if (!custom.noAuth) {
			const token = storage.getString(STORAGE_KEYS.token);
			if (token) {
				// 根据后端要求选择 Bearer / token 等格式
				config.header = {
					...config.header,
					Authorization: `Bearer ${token}`,
				};
			}
		}

		return config;
	},
	(error: HttpError) => {
		// 请求配置出错（极少发生）——确保 loading 关闭
		const custom = (error.config?.custom || {}) as RequestCustom;
		custom._hideLoading?.();
		return Promise.reject(error);
	}
);

// ==================== 响应拦截器 ====================

/**
 * 响应拦截器
 *
 * 在收到响应后执行，统一处理业务状态码。
 * 成功时直接返回 data 字段，调用方无需再 .data.data。
 * 失败时 reject 出去，由调用方 catch 处理，或由全局错误处理兜底。
 */
http.interceptors.response.use(
	(response: HttpResponse) => {
		const custom = (response.config?.custom || {}) as RequestCustom;

		// 请求结束，关闭 loading
		custom._hideLoading?.();

		const body = response.data as ApiResponse;

		// HTTP 状态码非 2xx（luch-request 默认验证器已过滤，此处为兜底）
		if (!body) {
			return Promise.reject(new Error('响应数据为空'));
		}

		// 业务成功
		if (body.code === API_CODE.success) {
			// 直接返回 data 字段，调用方可直接解构
			return body.data;
		}

		// token 异常（命中配置中任意一个异常码），清除 token 并跳登录页
		if ((API_CODE.tokenExpired as unknown as number[]).includes(body.code)) {
			storage.remove(STORAGE_KEYS.token);
			uni.reLaunch({ url: ROUTES.login });
			return Promise.reject(new Error('登录已过期，请重新登录'));
		}

		// 其他业务错误
		const message = body.message || '请求失败';
		if (!custom.silent) {
			uni.showToast({ title: message, icon: 'none' });
		}
		return Promise.reject(new Error(message));
	},
	(error: HttpError) => {
		// HTTP 层面的错误（网络断开、超时、服务器 5xx 等）
		const custom = (error.config?.custom || {}) as RequestCustom;

		// 请求失败，关闭 loading
		custom._hideLoading?.();

		let message = '网络请求失败';
		if (error?.errMsg?.includes('timeout')) {
			message = '请求超时，请稍后重试';
		} else if (error?.statusCode >= 500) {
			message = '服务器异常，请稍后重试';
		} else if (error?.statusCode === 404) {
			message = '请求地址不存在';
		}

		if (!custom.silent) {
			uni.showToast({ title: message, icon: 'none' });
		}

		return Promise.reject(error);
	}
);

// ==================== 类型安全封装层 ====================

/**
 * luch-request 原生的 get/post 等方法不支持泛型直接推断业务数据类型，
 * 这里对 http 实例做一层包装，让调用方可以用泛型直接拿到期望的实体类型。
 *
 * 原理：响应拦截器已将 response.data.data（业务数据）直接 return，
 * 所以运行时 await http.get() 拿到的就是业务数据本身，
 * 包装层只是补齐 TypeScript 的类型推断，消除 any。
 *
 * 使用示例：
 *   import { request } from '@/utils/request'
 *
 *   // GET - 返回单个对象
 *   const user = await request.get<UserInfo>('/api/user/info')
 *   console.log(user.name)  // 有类型提示，无 any
 *
 *   // GET - 返回数组
 *   const list = await request.get<UserInfo[]>('/api/user/list')
 *
 *   // GET - 返回分页
 *   interface PageResult<T> { total: number; records: T[] }
 *   const page = await request.get<PageResult<UserInfo>>('/api/user/page')
 *
 *   // POST
 *   const res = await request.post<LoginResult>('/api/login', { username, password })
 *
 *   // 带 custom 配置
 *   const res = await request.get<UserInfo>('/api/user/info', {
 *     custom: { loading: true, noAuth: false }
 *   })
 */

/**
 * 请求配置类型
 * - params：查询参数，自动拼接为 URL 查询字符串（GET/DELETE 传参用这个）
 * - data：  请求体（POST/PUT/PATCH 传参用这个，也可直接用第二个参数）
 * - custom：自定义配置（loading、noAuth、silent 等）
 */
type ReqConfig = Omit<HttpRequestConfig, 'custom'> & { custom?: RequestCustom };

export const request = {
	/**
	 * GET 请求
	 *
	 * @param url    接口路径
	 * @param params 查询参数对象，自动拼接为 ?key=value 格式（可选）
	 * @param config 其他请求配置（custom.loading、custom.noAuth 等）
	 *
	 * @example
	 *   // 无参数
	 *   const user = await request.get<UserInfo>('/api/user/info')
	 *
	 *   // 带查询参数 → /api/user/list?page=1&size=10
	 *   const list = await request.get<UserInfo[]>('/api/user/list', { page: 1, size: 10 })
	 *
	 *   // 带查询参数 + loading
	 *   const list = await request.get<UserInfo[]>('/api/user/list', { page: 1 }, {
	 *     custom: { loading: true }
	 *   })
	 */
	get<T = any>(url: string, params?: Record<string, any>, config?: ReqConfig): Promise<T> {
		// as unknown as Promise<T>：两步断言，因为 http.get() 返回 Promise<HttpResponse<any>>，
		// 与 Promise<T> 结构差异太大，TypeScript 不允许直接 as，必须先 as unknown 放弃原类型后再声明目标类型
		return http.get(url, { ...config, params }) as unknown as Promise<T>;
	},

	/**
	 * POST 请求
	 *
	 * @param url    接口路径
	 * @param data   请求体（JSON 对象）
	 * @param config 其他请求配置
	 *
	 * @example
	 *   const res = await request.post<LoginResult>('/api/login', { username, password })
	 */
	post<T = any>(url: string, data?: Record<string, any>, config?: ReqConfig): Promise<T> {
		// 同上：as unknown 作为跳板，绕过 TypeScript 的类型重叠检查限制
		return http.post(url, data, config) as unknown as Promise<T>;
	},

	/**
	 * PUT 请求
	 *
	 * @param url    接口路径
	 * @param data   请求体（JSON 对象）
	 * @param config 其他请求配置
	 *
	 * @example
	 *   await request.put('/api/user/update', { id: 1, name: 'Tom' })
	 */
	put<T = any>(url: string, data?: Record<string, any>, config?: ReqConfig): Promise<T> {
		// 同上：as unknown 作为跳板，绕过 TypeScript 的类型重叠检查限制
		return http.put(url, data, config) as unknown as Promise<T>;
	},

	/**
	 * DELETE 请求
	 *
	 * @param url    接口路径
	 * @param params 查询参数对象（如 id），自动拼接为查询字符串
	 * @param config 其他请求配置
	 *
	 * @example
	 *   // 带路径参数（手动拼 url）
	 *   await request.delete(`/api/user/${id}`)
	 *
	 *   // 带查询参数 → /api/user?id=1
	 *   await request.delete('/api/user', { id: 1 })
	 */
	delete<T = any>(url: string, params?: Record<string, any>, config?: ReqConfig): Promise<T> {
		// 同上：as unknown 作为跳板，绕过 TypeScript 的类型重叠检查限制
		return http.delete(url, undefined, { ...config, params }) as unknown as Promise<T>;
	},

	/**
	 * PATCH 请求
	 *
	 * @param url    接口路径
	 * @param data   请求体（局部更新字段）
	 * @param config 其他请求配置
	 *
	 * @example
	 *   await request.patch('/api/user/1', { name: 'Tom' })
	 */
	patch<T = any>(url: string, data?: Record<string, any>, config?: ReqConfig): Promise<T> {
		// 同上：as unknown 作为跳板，绕过 TypeScript 的类型重叠检查限制
		return http.patch(url, data, config) as unknown as Promise<T>;
	},
};

// ==================== 导出 ====================

/**
 * http  — luch-request 原始实例，保留供需要底层能力时使用
 * request — 类型安全的封装层，日常业务请求推荐使用
 */
export { http };
