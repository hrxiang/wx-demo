<template>
	<scroll-page>
		<template #topView>
			<custom-nav-bar title="我是标题">
				<template #right>
					<view style="height: 100%; display: flex; align-items: center;">右</view>
				</template>
			</custom-nav-bar>
		</template>
	</scroll-page>
	<!-- <view>
		<custom-nav-bar>
			<template #right>
				<view style="height: 100%; display: flex; align-items: center;">右</view>
			</template>
		</custom-nav-bar>
		<view v-for="item in 20" style="height: 80rpx; display: flex; align-items: center; justify-content: center;">
			{{ item }}
		</view>
	</view> -->
</template>

<script>
	export default {
		data() {
			return {

			};
		},
		onLoad(args) {
			const deviceInfo = uni.getDeviceInfo();
			console.log('-----deviceInfo---', deviceInfo);
		}
	}
</script>

<style lang="scss">

</style>