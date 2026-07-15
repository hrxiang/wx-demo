<!--
	走马灯/轮播组件（Marquee Ticker）
	==================
	传入一个字符串数组，每隔 N 秒切换到下一条，依次循环显示。
	支持 4 个方向：垂直向上、垂直向下、水平向左、水平向右。

	原理（双面板独立变换法）：
	两个面板各自绝对定位在容器内，通过独立的 transform 实现滑入/滑出。
	- 面板 A 空闲时不加任何 transform（避免 GPU 层导致 overflow:hidden 失效）
	- 动画结束后，在 transform 仍生效的瞬间交换文字内容，然后移除 transform

	Props:
	- list:       字符串数组
	- interval:   切换间隔（毫秒），默认 3000
	- duration:   动画时长（毫秒），默认 500
	- direction:  vertical | vertical-reverse | horizontal | horizontal-reverse
	- height:     容器高度（rpx），默认 80
	- autoPlay:   是否自动开始，默认 true

	基本用法：
	<marquee-ticker :list="['消息1', '消息2', '消息3']" :interval="3000" />

	自定义样式：
	<marquee-ticker :list="messages" direction="horizontal">
		<template v-slot:item="{ item }">
			<text style="color: red;">{{ item }}</text>
		</template>
	</marquee-ticker>

	手动控制：
	<marquee-ticker ref="ticker" :list="data" :autoPlay="false" />
	this.$refs.ticker.start()
	this.$refs.ticker.stop()
-->
<template>
	<view class="marquee-wrapper" :style="wrapperStyle">
		<!-- 面板 A：当前显示的条目 -->
		<view class="marquee-panel" :style="panelAStyle">
			<slot name="item" :item="list[currentIndex]">
				<text class="marquee-text">{{ list[currentIndex] }}</text>
			</slot>
		</view>
		<!-- 面板 B：下一条条目（在屏幕外等待滑入） -->
		<view class="marquee-panel" :style="panelBStyle">
			<slot name="item" :item="list[nextIndex]">
				<text class="marquee-text">{{ list[nextIndex] }}</text>
			</slot>
		</view>
	</view>
</template>

<script>
/**
 * 走马灯/轮播组件
 *
 * 动画原理：
 * ┌──────────────────────────────────────────────────┐
 * │  wrapper (overflow: hidden)                      │
 * │                                                  │
 * │  Panel A — 空闲时：无 transform（自然定位）       │
 * │            动画中：translate 滑出方向             │
 * │                                                  │
 * │  Panel B — 空闲时：translate 在屏幕外             │
 * │            动画中：translate(0, 0) 滑入           │
 * │                                                  │
 * │  关键：Panel A 空闲时不加 transform: translate(0,0)
 * │  因为该值会创建 GPU 合成层，破坏 overflow:hidden│
 * │  导致滑出面板的内容残影可见                       │
 * └──────────────────────────────────────────────────┘
 *
 * 文字交换时序（解决"替换后从中间出现"的问题）：
 * 1. isAnimating = true → 面板 A 滑出，面板 B 滑入（有 transition）
 * 2. duration 后 _finishAnim 触发
 * 3. 先更新 currentIndex/nextIndex（交换文字）
 *    此时 isAnimating 仍为 true，所以：
 *    - 面板 A 仍然有 slideOut transform → 新文字在屏幕外，不可见
 *    - 面板 B 仍然有 translate(0,0) → 旧文字在面板 B 上
 * 4. 然后设 isAnimating = false → 面板 A 瞬间无 transform（新文字出现）
 *    面板 B 瞬间回到屏幕外
 * 5. 效果：用户看到的是「旧文字滑出 → 新文字瞬间出现」，无缝衔接
 */
export default {
	props: {
		/** 字符串数组，组件会依次循环显示每个元素 */
		list: { type: Array, default: () => [] },
		/** 切换间隔（毫秒），默认 3000（3秒） */
		interval: { type: Number, default: 3000 },
		/** 动画时长（毫秒），默认 500 */
		duration: { type: Number, default: 500 },
		/** 动画方向：vertical / vertical-reverse / horizontal / horizontal-reverse */
		direction: {
			type: String,
			default: 'vertical',
			validator: v => ['vertical', 'vertical-reverse', 'horizontal', 'horizontal-reverse'].includes(v)
		},
		/** 容器高度（rpx），默认 80 */
		height: { type: Number, default: 80 },
		/** 是否自动开始播放 */
		autoPlay: { type: Boolean, default: true }
	},

	data() {
		return {
			currentIndex: 0,
			nextIndex: 1,
			/** 是否正在播放切换动画 */
			isAnimating: false
		};
	},

	computed: {
		/** wrapper 行内样式：固定高度 + overflow hidden */
		wrapperStyle() {
			return `height: ${this.height}rpx;`;
		},

		/**
		 * 面板 A 样式
		 *
		 * 关键设计：空闲时不加任何 transform
		 * - 不加 transform → 面板处于自然文档流中，overflow:hidden 正常裁剪
		 * - 加了 transform:translate(0,0) → 创建 GPU 层，overflow:hidden 裁剪失效 → 残影
		 *
		 * 状态转换：
		 * - 空闲：无 transform，无 transition
		 * - 动画中：slideOut + transition
		 */
		panelAStyle() {
			if (this.isAnimating) {
				return `transform: ${this.slideOutTransform}; transition: transform ${this.duration}ms ease-in-out;`;
			}
			// 空闲：不加 transform，让 overflow:hidden 正常工作
			return 'transition: none;';
		},

		/**
		 * 面板 B 样式
		 *
		 * 面板 B 始终需要 transform（因为在屏幕外等待），
		 * 所以不存在 GPU 层干扰 overflow:hidden 的问题。
		 *
		 * 状态转换：
		 * - 空闲：offScreen transform，无 transition
		 * - 动画中：translate(0,0) + transition
		 */
		panelBStyle() {
			if (this.isAnimating) {
				return `transform: translate(0, 0); transition: transform ${this.duration}ms ease-in-out;`;
			}
			return `transform: ${this.offScreenTransform}; transition: none;`;
		},

		/** 面板 A 滑出方向的 transform 值 */
		slideOutTransform() {
			switch (this.direction) {
				case 'vertical':           return 'translateY(-100%)';
				case 'vertical-reverse':   return 'translateY(100%)';
				case 'horizontal':         return 'translateX(-100%)';
				case 'horizontal-reverse': return 'translateX(100%)';
				default:                   return 'translateY(-100%)';
			}
		},

		/** 面板 B 在屏幕外的初始位置（动画进入方向的起点） */
		offScreenTransform() {
			switch (this.direction) {
				case 'vertical':           return 'translateY(100%)';
				case 'vertical-reverse':   return 'translateY(-100%)';
				case 'horizontal':         return 'translateX(100%)';
				case 'horizontal-reverse': return 'translateX(-100%)';
				default:                   return 'translateY(100%)';
			}
		}
	},

	watch: {
		list: {
			handler(val) {
				if (val && val.length > 0 && this.currentIndex >= val.length) {
					this.currentIndex = 0;
					this.nextIndex = val.length > 1 ? 1 : 0;
				}
			},
			immediate: true
		}
	},

	mounted() {
		if (this.autoPlay) this.start();
	},

	beforeDestroy() {
		this.stop();
		if (this._animTimer) clearTimeout(this._animTimer);
	},

	methods: {
		/** 开始自动轮播 */
		start() {
			if (this._timer) return;
			if (this.list.length <= 1) return;
			this._timer = setInterval(() => {
				this.switchNext();
			}, this.interval);
		},

		/** 停止轮播 */
		stop() {
			if (this._timer) {
				clearInterval(this._timer);
				this._timer = null;
			}
		},

		/**
		 * 触发切换到下一条
		 *
		 * 流程：
		 * 1. isAnimating = true
		 *    → 面板 A：无 transform → slideOut transform（有 transition，平滑滑出）
		 *    → 面板 B：offScreen → translate(0,0)（有 transition，平滑滑入）
		 * 2. duration + 50ms 后调用 _finishAnim()
		 */
		switchNext() {
			if (this.isAnimating || this.list.length <= 1) return;
			this.isAnimating = true;
			this.$emit('switch', { from: this.currentIndex, to: this.nextIndex });

			if (this._animTimer) clearTimeout(this._animTimer);
			this._animTimer = setTimeout(() => {
				this._finishAnim();
			}, this.duration + 50);
		},

		/**
		 * 动画结束：交换文字内容并重置位置
		 *
		 * 关键时序（解决"替换后从中间出现"的问题）：
		 * 1. 先更新 currentIndex / nextIndex（交换文字内容）
		 *    此时 isAnimating 仍为 true：
		 *    - 面板 A 仍有 slideOut transform → 新文字在屏幕外，不可见 ✓
		 *    - 面板 B 仍有 translate(0,0) → 旧文字可见（但即将消失）
		 * 2. 再设 isAnimating = false：
		 *    - 面板 A：移除 transform → 新文字瞬间出现在正确位置 ✓
		 *    - 面板 B：回到 offScreen → 旧文字瞬间消失 ✓
		 * 3. 同一个 Vue 渲染帧内完成，用户看不到中间状态
		 */
		_finishAnim() {
			// 第一步：交换索引（文字互换），此时 isAnimating 仍为 true
			const oldNext = this.nextIndex;
			this.currentIndex = oldNext;
			this.nextIndex = (oldNext + 1) % this.list.length;

			// 第二步：关闭动画 → 面板 A 瞬间无 transform，面板 B 瞬间回到屏幕外
			this.isAnimating = false;

			this.$emit('switched', { current: this.currentIndex });
		}
	}
};
</script>

<style lang="scss" scoped>
/* wrapper：固定高度 + overflow hidden + position relative */
.marquee-wrapper {
	position: relative;
	overflow: hidden;
	width: 100%;
}

/* panel：各自绝对定位，铺满容器 */
.marquee-panel {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	box-sizing: border-box;
	user-select: none;
}

/* 默认文字样式（未使用自定义 slot 时生效） */
.marquee-text {
	font-size: 28rpx;
	color: #333;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	width: 100%;
}
</style>
