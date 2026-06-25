<template>
	<view class="scroll-page" id="pageView">
		<!-- 滚动区域上方固定内容（标题栏、搜索框等） -->
		<view id="topView">
			<slot name="topView"></slot>
		</view>

		<!--
			核心滚动区域
			- flexHeight=true 时使用 flex:1 自适应撑满，无需手动计算高度
			- flexHeight=false 时用 SelectorQuery 动态计算 scrollHeight
			- 支持小程序原生下拉刷新（refresher-enabled）
		-->
		<scroll-view id="scrollView" :scroll-y="true"
			:style="`${flexHeight ? 'height: 0; flex: 1;' : `${scrollHeight}px;`}`"
			:refresher-enabled="refresherEnabled" :refresher-triggered="triggered" :scroll-top="scrollTop"
			@refresherpulling="refresherpulling" @refresherrefresh="refresherrefresh"
			@refresherrestore="refresherrestore" @refresherabort="refresherabort" @scrolltolower="scrolltolower"
			@scroll="scroll">
			<view>
				<slot name="scrollView"></slot>
				<!-- safeAreaScrollable=true 时，安全间距在滚动区域内，随内容滚动 -->
				<view v-if="safeArea && safeAreaScrollable" style="height: env(safe-area-inset-bottom);"></view>
			</view>
		</scroll-view>

		<!-- 滚动区域下方固定内容（底部按钮、tab 等） -->
		<view id="bottomView">
			<slot name="bottomView"></slot>
		</view>

		<!-- safeAreaScrollable=false 时，安全间距固定在页面底部，始终可见不滚动 -->
		<view v-if="safeArea && !safeAreaScrollable" style="height: env(safe-area-inset-bottom);"></view>
	</view>
</template>

<script>
	/**
	 * 通用滚动页面布局组件
	 *
	 * 三段式布局：topView（固定） + scrollView（可滚动） + bottomView（固定）
	 *
	 * ┌───────────────────────────────┐
	 * │  topView 插槽   （固定顶部）    │
	 * ├───────────────────────────────┤
	 * │                               │
	 * │  scrollView 插槽（可滚动）      │
	 * │                               │
	 * ├───────────────────────────────┤
	 * │  bottomView 插槽（固定底部）    │
	 * │  [安全间距 - 仅在 safeAreaScrollable=false 时] │
	 * └───────────────────────────────┘
	 *
	 * 功能特性：
	 * - 自适应高度：flexHeight=true 用 flex:1 自动撑满，无需手动计算
	 * - 手动计算：flexHeight=false 时通过 SelectorQuery 动态计算高度
	 * - 安全区域：支持 safeArea 适配 iPhone X 等全面屏底部横条
	 * - 下拉刷新：支持小程序原生 refresher 下拉刷新
	 * - 触底加载：滚动到底部触发 loadmore 事件
	 * - 滚动到顶：scrolltoTop() 方法可重置滚动位置
	 *
	 * 使用示例：
	 * ```
	 * <scroll-page :safe-area="true" :safe-area-scrollable="true" :refresher-enabled="true"
	 *   @refresh="handleRefresh" @loadmore="handleLoadMore" ref="page">
	 *   <template #topView> <!-- 固定顶部搜索栏 --> </template>
	 *   <template #scrollView> <!-- 列表内容 --> </template>
	 *   <template #bottomView> <!-- 固定底部按钮 --> </template>
	 * </scroll-page>
	 * ```
	 */
	export default {
		name: "scroll-page",
		emits: [
			/** 下拉刷新触发 */
			'refresh',
			/** 滚动到底部，触发加载更多 */
			'loadmore'
		],
		props: {
			/** 是否启用安全区域适配（iPhone X 等底部横条） */
			safeArea: {
				type: Boolean,
				default: false,
			},
			/**
			 * 安全间距是否在滚动区域内
			 * - true：安全间距在 scroll-view 内部，滚到底部才可见，滚动区域更高
			 * - false：安全间距固定在页面底部，始终可见不滚动，滚动区域更短
			 */
			safeAreaScrollable: {
				type: Boolean,
				default: false,
			},
			/**
			 * 是否使用 flex 自适应高度
			 * - true：scroll-view 用 flex:1 自动撑满剩余空间（推荐）
			 * - false：通过 SelectorQuery 手动计算 scrollHeight（需手动处理屏幕旋转等场景）
			 */
			flexHeight: {
				type: Boolean,
				default: true,
			},
			/** 是否启用小程序原生下拉刷新 */
			refresherEnabled: {
				type: Boolean,
				default: false,
			},
			/**
			 * 滚动到指定元素的 ID
			 *
			 * 目标元素在 scrollView 插槽内，属于父组件作用域，
			 * 所以组件内部通过全局 SelectorQuery（不加 .in(this)）查找目标元素位置，
			 * 再结合 scoped 查询获取 scroll-view 自身位置，动态计算偏移量后滚动。
			 */
			topViewId: {
				type: String,
				default: null,
			},
		},
		data() {
			return {
				/** 手动模式下的滚动区域高度（px） */
				scrollHeight: 0,
				/** 控制 scroll-view 滚动到指定位置 */
				scrollTop: 0,
				/** 上一次滚动位置，用于 scrolltoTop 重置 */
				oldScrollTop: 0,
				/** 下拉刷新状态：true=刷新中，false=未触发 */
				triggered: false,
			};
		},
		mounted() {
			// 手动模式才需要在 mounted 时计算高度（flex 模式由 CSS 自动处理）
			if (!this.flexHeight) this.calcScrollViewHeight();
		},
		watch: {
			/**
			 * 监听 topViewId 变化，通过查询目标元素位置动态计算偏移量并滚动
			 *
			 * 两个查询的作用域差异：
			 *   - 查询 #scrollView 用 .in(this)，因为 scroll-view 在组件自身模板内
			 *   - 查询目标元素不用 .in(this)，因为它在插槽内，属于父组件作用域，必须全局查询
			 *
			 * 计算逻辑：
			 *   offset = 目标元素顶部 - scroll-view 顶部 + 当前已滚动距离
			 *   然后通过「先设回旧值 → $nextTick 设目标值」触发 scroll-view 滚动
			 */
			topViewId(newVal) {
				if (!newVal) return;
				this.$nextTick(() => {
					uni.createSelectorQuery().in(this)
						.select('#scrollView').boundingClientRect()
						.exec((scrollRes) => {
							const scrollViewRect = scrollRes[0];
							uni.createSelectorQuery()
								.select('#' + newVal).boundingClientRect()
								.exec((targetRes) => {
									const targetRect = targetRes[0];
									if (scrollViewRect && targetRect) {
										const offset = targetRect.top - scrollViewRect.top + this.oldScrollTop;
										this.scrollTop = this.oldScrollTop;
										this.$nextTick(() => {
											this.scrollTop = offset;
										});
									}
								});
						});
				});
			}
		},
		methods: {
			/**
			 * 滚动到顶部
			 * 原理：先设回旧值（无变化不触发），再在 $nextTick 中设为 0 触发滚动
			 */
			scrolltoTop() {
				this.scrollTop = this.oldScrollTop;
				this.$nextTick(() => {
					this.scrollTop = 0;
				});
			},
			/** 滚动事件，记录当前滚动位置 */
			scroll(e) {
				this.oldScrollTop = e.detail.scrollTop;
			},
			/** 滚动到底部，触发加载更多 */
			scrolltolower(e) {
				this.$emit('loadmore');
			},
			/** 设置刷新中状态，触发 refresh 事件 */
			refreshing() {
				this.triggered = true;
				this.$emit('refresh');
			},
			/** 外部调用：刷新完成，关闭下拉刷新动画 */
			refreshCompleted() {
				this.triggered = false;
			},
			/** 下拉刷新 —— 被下拉时 */
			refresherpulling(e) {},
			/** 下拉刷新 —— 触发刷新 */
			refresherrefresh(e) {
				this.refreshing();
			},
			/** 下拉刷新 —— 复位 */
			refresherrestore(e) {
				this.refresherrest();
			},
			/** 下拉刷新 —— 中止 */
			refresherabort(e) {
				this.refresherrest();
			},
			/** 重置下拉刷新状态 */
			refresherrest() {
				this.triggered = false;
			},
			/**
			 * 手动计算 scroll-view 高度（flexHeight=false 时使用）
			 *
			 * 计算逻辑：
			 *   scrollHeight = 页面高度 - topView高度 - bottomView高度 - 安全间距
			 *
			 * 注意：
			 * - 自定义导航栏模式下 windowHeight === screenHeight，需用 screenHeight 计算
			 * - 模拟器识别：devtools 平台下自定义导航栏判断不可靠，回退到 pageView.height
			 */
			calcScrollViewHeight() {
				this.$nextTick(() => {
					uni.createSelectorQuery().in(this)
						.select('#pageView').boundingClientRect()
						.select('#topView').boundingClientRect()
						.select('#bottomView').boundingClientRect()
						.exec((res) => {
							const windowInfo = uni.getWindowInfo();
							const deviceInfo = uni.getDeviceInfo();

							// 自定义导航栏：整个屏幕都是可用窗口，windowHeight === screenHeight
							const isCustomNav = windowInfo.windowHeight === windowInfo.screenHeight;
							// 模拟器上 isCustomNav 判断不可靠，需特殊处理
							const isDevtools = deviceInfo.platform === 'devtools';

							const [pageView, topView, bottomView] = res;
							if (pageView && topView && bottomView) {
								// 自定义导航栏（非模拟器）用 screenHeight，否则用 DOM 实际高度
								const height = isCustomNav && !isDevtools ? windowInfo.screenHeight : pageView.height;
								// 安全间距固定在底部时，需从 scroll-view 高度中扣除
								const bottomGap = !this.safeAreaScrollable && this.safeArea;
								const safeAreaInsetsBottom = bottomGap ? windowInfo.safeAreaInsets.bottom : 0;
								this.scrollHeight = height - topView.height - bottomView.height - safeAreaInsetsBottom;
							}
						});
				});
			},
		}
	}
</script>

<style lang="scss" scoped>
	/* 页面容器：flex 纵向布局，撑满整个视口 */
	.scroll-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}
</style>