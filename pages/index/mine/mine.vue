<template>
	<view>
		<grid-container :columns="columns" :items="items">
			<template #cell="{data}">
				<view
					style="display: flex; align-items: center; justify-content: center;height: 100prx; background-color: red;">
					{{data.text}}
				</view>
			</template>
		</grid-container>
		<view>登录状态：{{ userStore.isLoggedIn ? '已登录' : '未登录' }}</view>
		<view>用户名：{{ userStore.displayName || '-' }}</view>
		<view>手机号：{{ userStore.userInfo?.phone || '-' }}</view>
		<view>角色：{{ userStore.userInfo?.role || '-' }}</view>
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
	const columns = 4;
	const items = [{
		text: 'A1',
		span: 4
	}, {
		text: 'A2',
		span: 2
	}, {
		text: 'A3',
		span: 2
	}, {
		text: 'A4',
		span: 1
	}, {
		text: 'A5',
		span: 1
	}];
	const userStore = useUserStore();
</script>

<style lang="scss">

</style>