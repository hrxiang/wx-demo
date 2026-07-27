<template>
	<scroll-view id="scrollView" :scroll-y="true" :style="customStyle" :refresher-enabled="refresherEnabled"
		:refresher-triggered="triggered" :scroll-top="scrollTop" @refresherpulling="refresherpulling"
		@refresherrefresh="refresherrefresh" @refresherrestore="refresherrestore" @refresherabort="refresherabort"
		@scrolltolower="scrolltolower" @scroll="scroll">
		<view>
			<slot></slot>
			<view :style="`height: ${scrollViewBottomGap}rpx;`"></view>
		</view>
	</scroll-view>
</template>

<script>
	export default {
		name: "scroll-fragment",
		props: {
			refresherEnabled: {
				type: Boolean,
				default: false,
			},
			customStyle: {
				type: Object,
				default: {
					height: '100%',
				},
			},
			scrollViewBottomGap: {
				type: Number,
				default: 20,
			}
		},
		emits: ['refresh', 'loadmore'],
		data() {
			return {
				scrollHeight: 0,
				scrollTop: 0,
				oldScrollTop: 0,
				// 设置当前下拉刷新状态，true 表示下拉刷新已经被触发，false 表示下拉刷新未被触发
				triggered: false,
			};
		},
		computed: {},
		watch: {},
		created() {},
		mounted() {},
		methods: {
			// 重置滚动距离
			scrollToTop() {
				this.scrollTop = this.oldScrollTop;
				this.$nextTick(() => {
					this.scrollTop = 0;
				});
			},
			scroll(e) {
				this.oldScrollTop = e.detail.scrollTop;
			},
			scrolltolower(e) {
				// 滚动到底部加载更多
				this.$emit('loadmore');
			},
			refreshing() {
				// 下拉刷新中
				this.triggered = true;
				this.$emit('refresh');
			},
			// 刷新成功
			refreshCompleted() {
				this.triggered = false;
			},
			//自定义下拉刷新控件被下拉
			refresherpulling(e) {},
			// 自定义下拉刷新被触发
			refresherrefresh(e) {
				this.refreshing();
			},
			// 自定义下拉刷新被复位
			refresherrestore(e) {
				this.refresherrest();
			},
			// 自定义下拉刷新被中止
			refresherabort(e) {
				this.refresherrest();
			},
			refresherrest() {
				this.triggered = false;
			},
		}
	}
</script>

<style lang="scss" scoped>
</style>