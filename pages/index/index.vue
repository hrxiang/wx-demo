<template>
	<view style="background-color: yellow;">
		<button @click="toTestPage">click</button>
		<button @click="testApi" style="margin-top: 10rpx;">
			测试api
		</button>
		<!-- ==================== Pinia Store 使用示例 ==================== -->
		<view style="padding: 20rpx; background: #f5f5f5; margin-top: 20rpx;">

			<!-- 1. 读取状态 -->
			<view>登录状态：{{ userStore.isLoggedIn ? '已登录' : '未登录' }}</view>
			<view>用户名：{{ userStore.displayName || '-' }}</view>
			<view>手机号：{{ userStore.userInfo?.phone || '-' }}</view>
			<view>角色：{{ userStore.userInfo?.role || '-' }}</view>

			<!-- 2. 修改状态按钮 -->
			<button @click="handleFetchUser" style="margin-top: 10rpx;">
				模拟登录（加载用户信息）
			</button>
			<button @click="handleUpdateName" style="margin-top: 10rpx;">
				修改名字
			</button>
			<button @click="handleClear" style="margin-top: 10rpx;">
				清除用户信息（退出登录）
			</button>

			<!-- 3. watch 变化提示 -->
			<view style="margin-top: 10rpx; color: #666;">最近变化：{{ watchLog }}</view>
		</view>
	</view>
</template>

<script setup lang="ts">
	import { ref, watch } from 'vue';
	import { useUserStore } from '@/stores';
	import { storage } from '@/utils/storage'
	import { STORAGE_KEYS } from '@/config';
	import { nav } from '@/utils/nav';
	import { request } from '@/utils/request'

	// 跳过打开新页面时的token验证
	storage.setString(STORAGE_KEYS.token, 'xxxxx');

	// ==================== 初始化 ====================

	/**
	 * 第一步：调用 useUserStore() 获取 store 实例
	 * 注意：必须在组件/页面内调用，不能在模块顶层直接调用
	 */
	const userStore = useUserStore();

	// watch 日志（用于展示 watch 结果）
	const watchLog = ref('尚未变化');

	// ==================== watch 状态变化 ====================

	/**
	 * 监听用户信息变化
	 *
	 * () => userStore.userInfo  ← getter 写法，监听对象是 store 里的属性
	 * { deep: true }            ← 深度监听，内部字段修改也会触发
	 */
	watch(
		() => userStore.userInfo,
		(newVal, oldVal) => {
			if (newVal === null) {
				watchLog.value = '用户已退出登录';
			} else {
				watchLog.value = `用户信息更新 → ${newVal.name}`;
			}
			console.log('[watch] userInfo 变化:', { newVal, oldVal });
		},
		{ deep: true }
	);

	const dateRef = ref(null);

	// ==================== 事件处理 ====================

	/** 模拟登录：加载用户信息 */
	async function handleFetchUser() {
		await userStore.fetchUserInfo(); // action 内部已处理 loading
		console.log('[home] 用户信息已加载:', userStore.userInfo);
	}

	/** 修改名字：演示 updateUserInfo 更新部分字段 */
	function handleUpdateName() {
		// 只传要更新的字段，其他字段保持不变
		userStore.updateUserInfo({ name: '李四（已修改）' });
	}

	/** 退出登录：清除用户信息 */
	function handleClear() {
		userStore.clearUserInfo();
	}

	// ==================== 原有页面逻辑 ====================

	const columns = [
		{ key: 'name', dataIndex: 'name', title: '姓名', ellipsis: true },
		{ key: 'age', dataIndex: 'age', title: '年龄' },
		{ key: 'sex', dataIndex: 'sex', title: '性别' },
	];
	const dataSource = [
		{ id: 0, name: '张三张三张三张三张三张三张三张三张三张三张三张三张三张三张三', age: 19, sex: '男' },
		{ id: 1, name: '李四', age: 22, sex: '男' },
		{ id: 2, name: '王五', age: 20, sex: '男' },
	];

	function toTestPage() {
		//custom-nav-bar-demo
		//marquee-ticker-demo
		//font-align-grid-demo
		//message-read-demo
		//grid-view-demo
		//table-demo
		//state-sharing-demo
		nav.to('/pages/marquee-ticker-demo/marquee-ticker-demo')
	}
	function testApi() {
		request.get('https://api.github.com/users/hrxiang', null, { custom: { loading: true } });
	}
</script>

<style lang="scss">

</style>