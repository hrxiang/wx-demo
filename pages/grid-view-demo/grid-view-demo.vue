<template>
	<my-grid-view :columns="columns" :items="items">
		<!-- 注意：插槽属性名用 "item"，不可用 "data"（微信小程序保留属性名） -->
		<template #cell="{item}">
			<view
				style="display: flex; align-items: center; justify-content: center;height: 100rpx; background-color: red;">
				{{item.text}}
			</view>
		</template>
	</my-grid-view>
</template>

<script setup>
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
</script>

<style lang="scss" scoped>

</style>