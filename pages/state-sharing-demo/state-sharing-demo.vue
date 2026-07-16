<template>
	<view>
		<view>登录状态：{{ userStore.isLoggedIn ? '已登录' : '未登录' }}</view>
		<view>用户名：{{ userStore.displayName || '-' }}</view>
		<view>手机号：{{ userStore.userInfo?.phone || '-' }}</view>
		<view>角色：{{ userStore.userInfo?.role || '-' }}</view>

		<button @click="handleClear" style="margin-top: 10rpx;">
			清除用户信息（退出登录）
		</button>

		<view style="margin-top: 10rpx; color: #666;">最近变化：{{ watchLog }}</view>
	</view>
</template>

<script setup>
	import {
		ref,
		watch
	} from 'vue';
	import {
		useUserStore
	} from '@/stores';

	const userStore = useUserStore();
	// watch 日志（用于展示 watch 结果）
	const watchLog = ref('尚未变化');
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
			console.log('[watch] userInfo 变化:', {
				newVal,
				oldVal
			});
		}, {
			deep: true
		}
	);

	/** 退出登录：清除用户信息 */
	function handleClear() {
		userStore.clearUserInfo();
	}
</script>

<style lang="scss">

</style>