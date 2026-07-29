/**
 * 用户相关 API
 *
 * 所有用户模块的接口请求在此统一定义，页面/组件通过 api/index.ts 导入。
 *
 * 使用示例：
 *   import { userApi } from '@/api'
 *
 *   // 登录
 *   const result = await userApi.login({ username: 'admin', password: '123456' })
 *
 *   // 获取用户信息
 *   const info = await userApi.getInfo()
 *
 *   // 分页查询用户列表
 *   const page = await userApi.getList({ page: 1, size: 10 })
 *
 * 路径修改：
 *   后端接口路径变更时，只需修改本文件中的常量，所有调用方自动同步。
 */

import { request } from '@/utils/request';
import type { UserInfo } from '@/stores/user';

// ==================== 请求/响应类型定义 ====================

/** 登录请求参数 */
interface LoginParams {
	/** 用户名 */
	username: string;
	/** 密码 */
	password: string;
}

/** 登录响应数据 */
interface LoginResult {
	/** 登录 token */
	token: string;
	/** 用户信息 */
	userInfo: UserInfo;
}

/** 分页查询参数 */
interface PageParams {
	page: number;
	size: number;
}

/** 分页查询响应 */
interface PageResult<T> {
	/** 总记录数 */
	total: number;
	/** 当前页数据 */
	records: T[];
}

// ==================== 接口定义 ====================

/**
 * 用户登录
 *
 * @param params 用户名 + 密码
 * @returns token 和用户信息
 *
 * @example
 *   const result = await userApi.login({ username: 'admin', password: '123456' })
 *   storage.setString(STORAGE_KEYS.token, result.token)
 */
export const login = (params: LoginParams): Promise<LoginResult> => {
	return request.post<LoginResult>('/api/user/login', params, {
		custom: { noAuth: true, loading: true, loadingTitle: '登录中...' }
	});
};

/**
 * 获取当前登录用户信息
 *
 * @returns 用户信息对象
 *
 * @example
 *   const info = await userApi.getInfo()
 *   userStore.setUserInfo(info)
 */
export const getInfo = (): Promise<UserInfo> => {
	return request.get<UserInfo>('/api/user/info');
};

/**
 * 分页查询用户列表
 *
 * @param params 分页参数
 * @returns 分页结果
 *
 * @example
 *   const page = await userApi.getList({ page: 1, size: 10 })
 *   console.log(page.total, page.records)
 */
export const getList = (params: PageParams): Promise<PageResult<UserInfo>> => {
	return request.get<PageResult<UserInfo>>('/api/user/list', params);
};

/**
 * 根据 ID 获取用户详情
 *
 * @param id 用户 ID
 * @returns 用户信息
 *
 * @example
 *   const info = await userApi.getById('10001')
 */
export const getById = (id: string): Promise<UserInfo> => {
	return request.get<UserInfo>(`/api/user/${id}`);
};

/**
 * 更新用户信息
 *
 * @param data 要更新的字段（部分更新）
 *
 * @example
 *   await userApi.update({ name: '新名字', avatar: 'https://...' })
 */
export const update = (data: Partial<UserInfo>): Promise<void> => {
	return request.put<void>('/api/user/update', data);
};

/**
 * 退出登录
 *
 * @example
 *   await userApi.logout()
 *   userStore.clearUserInfo()
 */
export const logout = (): Promise<void> => {
	return request.post<void>('/api/user/logout');
};
