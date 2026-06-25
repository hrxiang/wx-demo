/**
 * 页面导航工具
 *
 * 解决 uni-app 页面传参痛点：
 *   - 传对象需要手动 JSON.stringify + encodeURIComponent
 *   - 接收参数需要手动 decodeURIComponent + JSON.parse
 *   - 基本类型和对象类型混传时编码逻辑繁琐
 *
 * 使用方式：
 *   import { nav } from '@/utils/nav'
 *
 *   // 跳转（自动编码）
 *   nav.to('/pages/detail/detail', { id: 1, name: '张三' })
 *   nav.to('/pages/detail/detail', { list: [1, 2, 3], info: { a: 1 } })
 *   nav.to('/pages/detail/detail', 123)                       // 基本类型自动包装为 { q: 123 }
 *
 *   // 接收参数（自动解码）
 *   import { nav } from '@/utils/nav'
 *   const params = nav.getArgs()                             // { id: 1, name: '张三' }
 *   const { id, name } = nav.getArgs<{ id: number; name: string }>()
 *
 *   // 替代原有写法
 *   // 之前：uni.navigateTo({ url: `/page?data=${encodeURIComponent(JSON.stringify(obj))}` })
 *   // 之后：nav.to('/page', { data: obj })
 */

// ==================== 类型定义 ====================

/** 可序列化的参数值类型 */
type ParamValue = string | number | boolean | object | null | undefined;

/** 页面参数对象，所有值必须是可序列化类型 */
type Params = Record<string, ParamValue>;

/** uni-app 导航方法类型 */
type NavMethod = 'navigateTo' | 'redirectTo' | 'reLaunch' | 'switchTab' | 'navigateBack';

// ==================== 内部工具函数 ====================

/**
 * 判断值是否为对象（非 null、非数组）
 */
function isObject(val: ParamValue): val is Record<string, unknown> {
	return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * 将参数对象编码为 URL 查询字符串
 *
 * 编码规则：
 *   - 基本类型（string / number / boolean） → 直接拼接
 *   - 对象 / 数组 → JSON.stringify + encodeURIComponent
 *   - null / undefined → 跳过该字段
 */
function encodeParams(params: Params): string {
	const parts: string[] = [];

	for (const key of Object.keys(params)) {
		const val = params[key];

		// null 和 undefined 不传
		if (val === null || val === undefined) continue;

		// 基本类型直接拼
		if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
			parts.push(`${key}=${encodeURIComponent(String(val))}`);
			continue;
		}

		// 对象和数组：JSON 序列化后再编码
		parts.push(`${key}=${encodeURIComponent(JSON.stringify(val))}`);
	}

	return parts.length > 0 ? '?' + parts.join('&') : '';
}

/**
 * 解码 URL 查询字符串为参数对象
 *
 * 解码规则：
 *   - 尝试 JSON.parse，成功则还原为对象 / 数组
 *   - JSON.parse 失败则当作基本类型字符串
 *   - 纯数字字符串自动转 number
 */
function decodeParams<T = Params>(queryString: string): T {
	if (!queryString) return {} as T;

	// 去掉开头的 ?
	const search = queryString.startsWith('?') ? queryString.slice(1) : queryString;

	const result: Params = {};

	for (const pair of search.split('&')) {
		if (!pair) continue;

		const eqIndex = pair.indexOf('=');
		if (eqIndex === -1) continue;

		const key = decodeURIComponent(pair.slice(0, eqIndex));
		const rawVal = decodeURIComponent(pair.slice(eqIndex + 1));

		// 尝试 JSON.parse（对象 / 数组 / 布尔 / 数字 经过编码的值）
		try {
			result[key] = JSON.parse(rawVal);
		} catch {
			// 解析失败，保持字符串
			result[key] = rawVal;
		}
	}

	return result as T;
}

// ==================== 导航工具 ====================

export const nav = {
	/**
	 * 保留当前页面，跳转到应用内的某个页面
	 *
	 * @param url    页面路径，如 '/pages/detail/detail'
	 * @param params 参数对象或基本类型值
	 *
	 * @example
	 *   nav.to('/pages/detail', { id: 1, name: '张三' })
	 *   nav.to('/pages/detail', { list: [{ a: 1 }], flag: true })
	 *   nav.to('/pages/detail', 123)  // 基本类型自动包装为 { q: 123 }
	 */
	to(url: string, params?: Params | ParamValue): void {
		const finalUrl = buildUrl(url, params);
		uni.navigateTo({ url: finalUrl });
	},

	/**
	 * 关闭当前页面，跳转到应用内的某个页面
	 *
	 * @param url    页面路径
	 * @param params 参数对象或基本类型值
	 */
	replace(url: string, params?: Params | ParamValue): void {
		const finalUrl = buildUrl(url, params);
		uni.redirectTo({ url: finalUrl });
	},

	/**
	 * 关闭所有页面，打开到应用内的某个页面
	 *
	 * @param url    页面路径
	 * @param params 参数对象或基本类型值
	 */
	reboot(url: string, params?: Params | ParamValue): void {
		const finalUrl = buildUrl(url, params);
		uni.reLaunch({ url: finalUrl });
	},

	/**
	 * 跳转到 tabBar 页面，并关闭其他所有非 tabBar 页面
	 * 注意：tabBar 页面不支持传参，params 会被忽略
	 *
	 * @param url tabBar 页面路径
	 */
	switchTab(url: string): void {
		uni.switchTab({ url });
	},

	/**
	 * 关闭当前页面，返回上一页面或多级页面
	 *
	 * @param delta 返回的页面数，默认 1
	 */
	back(delta: number = 1): void {
		uni.navigateBack({ delta });
	},

	/**
	 * 获取当前页面的导航参数（自动解码）
	 *
	 * 在 onLoad(options) 中调用，替代手动 decodeURIComponent + JSON.parse
	 *
	 * @param options  页面 onLoad 接收到的 options 对象，不传则自动从页面栈获取
	 * @returns 解码后的参数对象，类型由泛型 T 指定
	 *
	 * @example
	 *   // Options API
	 *   onLoad(options) {
	 *     const { id, name } = nav.getArgs(options)
	 *   }
	 *
	 *   // Composition API（setup 里直接获取页面栈参数）
	 *   const args = nav.getArgs()
	 *
	 *   // 带类型
	 *   const args = nav.getArgs<{ id: number; info: { name: string } }>()
	 */
	getArgs<T = Params>(options?: Record<string, string>): T {
		if (options) {
			// 从 onLoad 传入的 options 解码
			return decodeParams<T>(Object.entries(options)
				.map(([k, v]) => `${k}=${v}`)
				.join('&'));
		}

		// 未传 options 时，从页面栈获取当前页面的参数
		const pages = getCurrentPages();
		const currentPage = pages[pages.length - 1];
		if (currentPage) {
			// currentPage.$page?.options 或 currentPage.options
			const pageOptions = (currentPage as any).$page?.options || (currentPage as any).options || {};
			return decodeParams<T>(
				Object.entries(pageOptions)
					.map(([k, v]) => `${k}=${v}`)
					.join('&')
			);
		}

		return {} as T;
	},
};

// ==================== 内部辅助 ====================

/**
 * 构建带参数的完整 URL
 *
 * @param url    页面路径
 * @param params 参数对象或基本类型值
 *                - 对象：直接展开为查询参数
 *                - 基本类型：自动包装为 { q: value }
 */
function buildUrl(url: string, params?: Params | ParamValue): string {
	if (params === undefined || params === null) return url;

	// 基本类型自动包装
	const finalParams: Params = isObject(params)
		? (params as Params)
		: { q: params };

	const query = encodeParams(finalParams);
	return url + query;
}

export type { Params, ParamValue };
