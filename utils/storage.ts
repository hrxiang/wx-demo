/**
 * 本地存储工具
 *
 * 封装 uni.setStorage / uni.getStorage / uni.removeStorage 等 API，
 * 提供同步接口，支持基本类型、对象、数组的读写，并统一处理异常。
 *
 * 使用示例：
 *   import { storage } from '@/utils/storage'
 *
 *   storage.setString('nickname', '张三')
 *   storage.setNumber('age', 18)
 *   storage.setBoolean('agreed', true)
 *   storage.setObject('userInfo', { id: 1, name: '张三' })
 *   storage.setArray('tags', ['vip', 'new'])
 *
 *   const name    = storage.getString('nickname')         // '张三' | null
 *   const age     = storage.getNumber('age')              // 18 | null
 *   const agreed  = storage.getBoolean('agreed')          // true | null
 *   const user    = storage.getObject<UserInfo>('userInfo') // UserInfo | null
 *   const tags    = storage.getArray<string>('tags')      // string[] | null
 *
 *   storage.remove('nickname')
 *   storage.clear()
 */

// ==================== 底层读写 ====================

/**
 * 同步写入任意值（内部方法）
 *
 * 基本类型直接存储；对象/数组序列化为 JSON 字符串后存储。
 *
 * @param key   存储键名
 * @param value 待存储的值
 * @returns 写入成功返回 true，失败返回 false
 */
function set(key: string, value: unknown): boolean {
	try {
		const data = typeof value === 'object' && value !== null
			? JSON.stringify(value)
			: String(value);
		uni.setStorageSync(key, data);
		return true;
	} catch (e) {
		console.error(`[storage] set "${key}" 失败:`, e);
		return false;
	}
}

/**
 * 同步读取原始字符串（内部方法）
 *
 * @param key 存储键名
 * @returns 存储的字符串，键不存在或读取失败返回 null
 */
function getRaw(key: string): string | null {
	try {
		const value = uni.getStorageSync(key);
		// uni.getStorageSync 在键不存在时返回空字符串 ''
		return (value !== '' && value != null) ? String(value) : null;
	} catch (e) {
		console.error(`[storage] get "${key}" 失败:`, e);
		return null;
	}
}

// ==================== 写入方法 ====================

/**
 * 存储字符串
 * @param key   键名
 * @param value 字符串值
 */
function setString(key: string, value: string): boolean {
	return set(key, value);
}

/**
 * 存储数字
 * @param key   键名
 * @param value 数字值
 */
function setNumber(key: string, value: number): boolean {
	return set(key, value);
}

/**
 * 存储布尔值
 * @param key   键名
 * @param value 布尔值
 */
function setBoolean(key: string, value: boolean): boolean {
	return set(key, value);
}

/**
 * 存储对象（自动 JSON 序列化）
 * @param key   键名
 * @param value 任意对象
 */
function setObject<T extends object>(key: string, value: T): boolean {
	return set(key, value);
}

/**
 * 存储数组（自动 JSON 序列化）
 * @param key   键名
 * @param value 任意数组
 */
function setArray<T>(key: string, value: T[]): boolean {
	return set(key, value);
}

// ==================== 读取方法 ====================

/**
 * 读取字符串
 * @param key          键名
 * @param defaultValue 键不存在时的默认值，默认为 null
 * @returns 字符串值，或 defaultValue
 */
function getString(key: string, defaultValue: string | null = null): string | null {
	const raw = getRaw(key);
	return raw !== null ? raw : defaultValue;
}

/**
 * 读取数字
 *
 * 自动将存储的字符串转换为 number，转换失败返回 defaultValue。
 *
 * @param key          键名
 * @param defaultValue 键不存在或转换失败时的默认值，默认为 null
 */
function getNumber(key: string, defaultValue: number | null = null): number | null {
	const raw = getRaw(key);
	if (raw === null) return defaultValue;
	const num = Number(raw);
	return isNaN(num) ? defaultValue : num;
}

/**
 * 读取布尔值
 *
 * 存储值为字符串 'true' 时返回 true，其余均返回 false。
 *
 * @param key          键名
 * @param defaultValue 键不存在时的默认值，默认为 null
 */
function getBoolean(key: string, defaultValue: boolean | null = null): boolean | null {
	const raw = getRaw(key);
	if (raw === null) return defaultValue;
	return raw === 'true';
}

/**
 * 读取对象（自动 JSON 反序列化）
 *
 * @template T         期望的对象类型
 * @param key          键名
 * @param defaultValue 键不存在或解析失败时的默认值，默认为 null
 *
 * @example
 *   interface UserInfo { id: number; name: string }
 *   const user = storage.getObject<UserInfo>('userInfo')
 */
function getObject<T extends object>(key: string, defaultValue: T | null = null): T | null {
	const raw = getRaw(key);
	if (raw === null) return defaultValue;
	try {
		const parsed = JSON.parse(raw);
		// 确保解析结果是对象而不是数组或基本类型
		if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as T;
		}
		return defaultValue;
	} catch (e) {
		console.error(`[storage] getObject "${key}" JSON 解析失败:`, e);
		return defaultValue;
	}
}

/**
 * 读取数组（自动 JSON 反序列化）
 *
 * @template T         数组元素类型
 * @param key          键名
 * @param defaultValue 键不存在或解析失败时的默认值，默认为 null
 *
 * @example
 *   const tags = storage.getArray<string>('tags')
 *   const ids  = storage.getArray<number>('ids')
 */
function getArray<T>(key: string, defaultValue: T[] | null = null): T[] | null {
	const raw = getRaw(key);
	if (raw === null) return defaultValue;
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			return parsed as T[];
		}
		return defaultValue;
	} catch (e) {
		console.error(`[storage] getArray "${key}" JSON 解析失败:`, e);
		return defaultValue;
	}
}

// ==================== 删除方法 ====================

/**
 * 删除指定键
 * @param key 键名
 */
function remove(key: string): void {
	try {
		uni.removeStorageSync(key);
	} catch (e) {
		console.error(`[storage] remove "${key}" 失败:`, e);
	}
}

/**
 * 清空所有本地存储
 *
 * 注意：会清除该小程序下所有的本地缓存，谨慎使用。
 */
function clear(): void {
	try {
		uni.clearStorageSync();
	} catch (e) {
		console.error('[storage] clear 失败:', e);
	}
}

// ==================== 工具方法 ====================

/**
 * 判断某个键是否存在
 * @param key 键名
 */
function has(key: string): boolean {
	return getRaw(key) !== null;
}

/**
 * 获取当前存储信息（已用空间、限制大小等）
 *
 * @returns uni.getStorageInfoSync 返回的存储信息
 *
 * @example
 *   const info = storage.info()
 *   console.log(info.keys)          // 所有键名列表
 *   console.log(info.currentSize)   // 当前已用大小（KB）
 *   console.log(info.limitSize)     // 存储上限（KB）
 */
function info() {
	try {
		return uni.getStorageInfoSync();
	} catch (e) {
		console.error('[storage] info 失败:', e);
		return null;
	}
}

// ==================== 导出 ====================

export const storage = {
	// 写入
	setString,
	setNumber,
	setBoolean,
	setObject,
	setArray,
	// 读取
	getString,
	getNumber,
	getBoolean,
	getObject,
	getArray,
	// 删除
	remove,
	clear,
	// 工具
	has,
	info,
};
