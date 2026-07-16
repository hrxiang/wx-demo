<template>
	<!--
		根容器：通过 gridStyle 设置 CSS Grid 布局。
		每个子 view 通过 grid-column: span N 控制跨列数。
	-->
	<view :style="gridStyle">
		<!--
			遍历 items 数组，为每个条目生成一个 Grid 单元格。
			- item.span: 可选，指定该单元格横向占据的列数（默认 1）
			- 通过 inline style 动态设置 span，比预定义 CSS 类更灵活
		-->
		<view v-for="(item, index) in items" :style="`grid-column: span ${item.span ?? 1};`" :key="`gi_${index}`">
			<!--
				具名插槽 "cell"：将每个条目的数据和索引暴露给父组件。
				父组件通过 v-slot:cell="{ item, index }" 接收并自定义渲染内容。

				注意：插槽属性名不可用 "data"，因为 "data" 是微信小程序的保留属性名，
				会导致编译后插槽值被覆盖为 undefined。
			-->
			<slot name="cell" :item="item" :index="index"></slot>
		</view>
	</view>
</template>

<script>
	/**
	 * Grid View — CSS Grid 布局容器组件
	 * ==================================
	 *
	 * 基于 CSS Grid 实现的响应式网格布局，支持动态列数、间距和单元格跨列。
	 * 通过具名插槽 "cell" 将渲染权交给父组件，实现内容与布局的彻底分离。
	 *
	 * ─────────────────────────────────────────────────────────────────
	 * 布局结构示例（columns = 4, 间距 = gap）
	 * ─────────────────────────────────────────────────────────────────
	 *
	 *   全部 span = 1（默认 4 列等宽）：
	 *   ┌────┬────┬────┬────┐
	 *   │ A  │ B  │ C  │ D  │
	 *   ├────┼────┼────┼────┤
	 *   │ E  │ F  │ G  │ H  │
	 *   └────┴────┴────┴────┘
	 *
	 *   A 跨 2 列（span = 2），其余 span = 1：
	 *   ┌─────────┬────┬────┐
	 *   │    A    │ B  │ C  │   ← A 占据 2/4 宽度
	 *   ├────┬────┼────┴────┤
	 *   │ D  │ E  │   F     │   ← Grid 自动流入下一行
	 *   └────┴────┴─────────┘
	 *
	 *   A 跨 4 列（span = 4），整行通栏：
	 *   ┌───────────────────────┐
	 *   │         A             │   ← A 占据整行
	 *   ├────┬────┬────┬────┐
	 *   │ B  │ C  │ D  │ E  │
	 *   └────┴────┴────┴────┘
	 *
	 * ─────────────────────────────────────────────────────────────────
	 * 使用示例
	 * ─────────────────────────────────────────────────────────────────
	 *
	 *   示例 1：基础用法（4 列等宽网格）
	 *   ----------------------------------------------------------------
	 *   <grid-view :items="icons" :columns="4" :gap="20">
	 *   	<template v-slot:cell="{ item }">
	 *   		<view class="icon-item">
	 *   			<image :src="item.icon" />
	 *   			<text>{{ item.label }}</text>
	 *   		</view>
	 *   	</template>
	 *   </grid-view>
	 *
	 *   // items 数据：每项都是 span = 1（默认）
	 *   icons: [
	 *   	{ icon: '/static/home.png', label: '首页' },
	 *   	{ icon: '/static/cart.png', label: '购物车' },
	 *   	{ icon: '/static/user.png', label: '我的' },
	 *   	{ icon: '/static/set.png',  label: '设置' }
	 *   ]
	 *
	 *   示例 2：混合跨列（部分项占多列）
	 *   ----------------------------------------------------------------
	 *   <grid-view :items="dashboard" :columns="3" :gap="16">
	 *   	<template v-slot:cell="{ item }">
	 *   		<view class="card">
	 *   			<text class="card-title">{{ item.title }}</text>
	 *   			<text class="card-value">{{ item.value }}</text>
	 *   		</view>
	 *   	</template>
	 *   </grid-view>
	 *
	 *   // B 设置 span = 2，占据 2/3 宽度；A 和 C 各占 1/3
	 *   dashboard: [
	 *   	{ title: '今日订单', value: '128', span: 1 },   // 1 列
	 *   	{ title: '销售额',   value: '¥9,860', span: 2 }, // 2 列（较宽）
	 *   	{ title: '访客数',   value: '532',  span: 2 }, // 2 列
	 *   	{ title: '转化率',   value: '3.2%', span: 1 }   // 1 列
	 *   ]
	 *
	 *   示例 3：自定义 cell 渲染（使用 index）
	 *   ----------------------------------------------------------------
	 *   <grid-view :items="menuList" :columns="2" :gap="12">
	 *   	<template v-slot:cell="{ item, index }">
	 *   		<view :class="index % 2 === 0 ? 'cell-even' : 'cell-odd'">
	 *   			<text>{{ index + 1 }}. {{ item.name }}</text>
	 *   		</view>
	 *   	</template>
	 *   </grid-view>
	 */
	export default {
		name: "my-grid-view",
		props: {
			/** 网格列数，默认 4 列 */
			columns: {
				type: Number,
				default: 4,
			},
			/**
			 * 网格数据数组。
			 * 每个元素会作为一个 Grid 单元格渲染，通过 "cell" 插槽暴露给父组件。
			 * 如果元素包含 span 属性，则该单元格会横向占据 span 列。
			 */
			items: {
				type: Array,
				default: null,
			},
			/** 单元格之间的间距（rpx），默认 10rpx */
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
			/**
			 * 生成 CSS Grid 容器的 inline style
			 *
			 * - display: grid               → 启用 CSS Grid 布局
			 * - grid-template-columns: repeat(N, 1fr) → N 列等宽
			 * - gap: Nrpx                   → 行列间距
			 */
			gridStyle() {
				return `display: grid; grid-template-columns: repeat(${this.columns}, 1fr); gap: ${this.gap}rpx;`;
			}
		}
	}
</script>

<style lang="scss" scoped>
	/*
	 * 预定义的跨列样式类（备用）。
	 * 实际跨列通过 inline style `grid-column: span N` 动态控制，
	 * 这些类保留作为备用方案或手动使用。
	 */

	/* 占据 1 列 */
	.span-1 {
		grid-column: span 1;
	}

	/* 占据 2 列 */
	.span-2 {
		grid-column: span 2;
	}

	/* 占据 3 列 */
	.span-3 {
		grid-column: span 3;
	}

	/* 占据 4 列（整行通栏，当 columns = 4 时） */
	.span-4 {
		grid-column: span 4;
	}
</style>