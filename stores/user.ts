/**
 * 用户信息全局状态
 *
 * 使用 Pinia defineStore 定义，整个应用共享同一份数据，
 * 任意组件修改后其他组件自动响应更新，无需手动传递 props/emit。
 *
 * 快速上手：
 *   import { useUserStore } from '@/stores/user'
 *   const userStore = useUserStore()
 *
 *   读取：userStore.userInfo.name
 *   修改：userStore.setUserInfo({ name: '张三', ... })
 *   清除：userStore.clearUserInfo()
 *   watch：watch(() => userStore.userInfo, handler)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// ==================== 类型定义 ====================

/**
 * 用户信息结构
 * 根据实际后端接口字段调整此接口定义
 */
export interface UserInfo {
	/** 用户 ID */
	userId: string;
	/** 用户名 */
	name: string;
	/** 头像 URL */
	avatar: string;
	/** 手机号 */
	phone: string;
	/** 角色标识，如 admin / user */
	role: string;
}

// ==================== Store 定义 ====================

/**
 * useUserStore — 用户信息 Store
 *
 * 采用 Composition API 风格（setup store），与 Vue3 <script setup> 写法一致，
 * 比 Options 风格更灵活，易于提取逻辑。
 */
export const useUserStore = defineStore('user', () => {

	// ---- state：响应式数据 ----

	/** 用户信息，null 表示未登录 */
	const userInfo = ref<UserInfo | null>(null);

	/** 是否正在加载用户信息 */
	const loading = ref(false);


	// ---- getters：计算属性（相当于 Options store 里的 getters） ----

	/** 是否已登录（userInfo 不为 null 即视为已登录） */
	const isLoggedIn = computed(() => userInfo.value !== null);

	/** 用户显示名（未登录时返回空字符串） */
	const displayName = computed(() => userInfo.value?.name ?? '');


	// ---- actions：修改状态的方法 ----

	/**
	 * 设置用户信息（登录成功后调用）
	 * @param info 后端返回的用户信息对象
	 */
	function setUserInfo(info: UserInfo) {
		userInfo.value = info;
	}

	/**
	 * 更新用户信息的部分字段（如修改头像后只更新 avatar）
	 * @param partial 要更新的字段，未传的字段保持不变
	 */
	function updateUserInfo(partial: Partial<UserInfo>) {
		if (!userInfo.value) return;
		userInfo.value = { ...userInfo.value, ...partial };
	}

	/**
	 * 清除用户信息（退出登录时调用）
	 */
	function clearUserInfo() {
		userInfo.value = null;
	}

	/**
	 * 模拟从接口加载用户信息（实际项目替换为真实请求）
	 *
	 * 示例：
	 *   await userStore.fetchUserInfo()
	 */
	async function fetchUserInfo() {
		loading.value = true;
		try {
			// TODO: 替换为真实接口
			// const info = await request.get<UserInfo>('/api/user/info')
			// setUserInfo(info)

			// 模拟数据（删除后换成上面的真实请求）
			await new Promise(resolve => setTimeout(resolve, 500));
			setUserInfo({
				userId: '10001',
				name: '张三',
				avatar: 'https://example.com/avatar.jpg',
				phone: '138****8888',
				role: 'admin',
			});
		} finally {
			loading.value = false;
		}
	}

	return {
		// state
		userInfo,
		loading,
		// getters
		isLoggedIn,
		displayName,
		// actions
		setUserInfo,
		updateUserInfo,
		clearUserInfo,
		fetchUserInfo,
	};
});
