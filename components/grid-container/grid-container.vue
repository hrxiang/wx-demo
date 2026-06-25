<template>
	<view :style="gridStyle">
		<view v-for="(item, index) in items" :style="`grid-column: span ${item.span ?? 1};`" :key="`gi_${index}`">
			<slot name="cell" :data="item" :index="index"></slot>
		</view>
	</view>
</template>

<script>
	export default {
		name: "grid-container",
		props: {
			columns: {
				type: Number,
				default: 4,
			},
			items: {
				type: Array,
				default: null,
			},
			gap: {
				type: Number,
				default: 10,
			}
		},
		data() {
			return {

			};
		},
		computed: {
			gridStyle() {
				return `display: grid; grid-template-columns: repeat(${this.columns}, 1fr); gap: ${this.gap}rpx;`;
			}
		}
	}
</script>

<style lang="scss" scoped>
	.span-1 {
		grid-column: span 1;
	}

	.span-2 {
		grid-column: span 2;
	}

	.span-3 {
		grid-column: span 3;
	}

	.span-4 {
		grid-column: span 4;
	}
</style>