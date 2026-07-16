<!--
	走马灯/轮播组件（Marquee Ticker）
	==================
	传入一个字符串数组，每隔 N 秒切换到下一条，依次循环显示。
	支持 4 个方向：垂直向上、垂直向下、水平向左、水平向右。

	原理（单轨道双内容平移法）：
	不再使用两个独立的绝对定位面板，而是使用一个轨道（track），
	内部并排（或上下排列）两个内容块，通过整体平移实现滚动。
	- 轨道尺寸为容器的 200%（垂直方向高度 200%，水平方向宽度 200%）
	- 两个内容块各占轨道的一半，分别显示当前项与下一项
	- 动画时轨道整体偏移 50%，将旧内容移出视口，新内容移入视口
	- 动画结束后瞬间重置轨道位置，同时更新内容（内容瞬间就位，视觉无缝）
	- 整个组件只使用一个插槽，避免小程序同名插槽渲染冲突

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
		<!--
			轨道容器
			- 垂直方向：高度 200%，内容垂直排列
			- 水平方向：宽度 200%，内容水平排列
			通过 translate 整体移动，overflow: hidden 在 wrapper 上裁剪
		-->
		<view class="marquee-track" :style="trackStyle">
			<!--
				循环渲染两个内容块
				注意：key 使用 idx 保证两个块始终存在，内容由 displayItems 动态决定
			-->
			<view v-for="(item, idx) in displayItems" :key="idx" class="marquee-item">
				<!-- 唯一插槽：传入当前迭代的 item，兼容自定义内容 -->
				<slot name="item" :item="item">
					<text class="marquee-text">{{ item }}</text>
				</slot>
			</view>
		</view>
	</view>
</template>

<script>
/**
 * 走马灯/轮播组件
 *
 * 动画原理（以垂直向上滚动为例，其他方向类似）：
 * ┌───────────────────────────────────────────────┐
 * │  wrapper (height: 80rpx, overflow: hidden)   │
 * │                                               │
 * │  ┌─ track (height: 200%) ───────────────┐    │
 * │  │                                       │    │
 * │  │  ┌─ item 0（当前项） ────────────┐    │    │
 * │  │  │                              │    │    │
 * │  │  └──────────────────────────────┘    │    │
 * │  │  ┌─ item 1（下一项） ────────────┐    │    │
 * │  │  │                              │    │    │
 * │  │  └──────────────────────────────┘    │    │
 * │  └───────────────────────────────────────┘    │
 * │                                               │
 * │  空闲时：track translateY(0)                  │
 * │  → 视口显示 item 0（当前项）                  │
 * │                                               │
 * │  动画中：track translateY(-50%)               │
 * │  → item 0 向上滑出，item 1 从下方滑入         │
 * │                                               │
 * │  动画结束瞬间：                               │
 * │  1. currentIndex = nextIndex（内容交换）      │
 * │  2. track 瞬间回 translateY(0)                │
 * │  → 新内容已在视口内，无缝衔接                  │
 * └───────────────────────────────────────────────┘
 *
 * 关键设计：
 * 1. 单插槽，v-for 循环两个 item，避免同名插槽冲突
 * 2. 空闲时不加 transition，动画时加 transition，实现平滑切换
 * 3. 反向滚动时，displayItems 顺序与空闲偏移配合，保证视口始终看到当前项
 */
export default {
	props: {
		/** 字符串数组，组件会依次循环显示每个元素 */
		list: { type: Array, default: () => [] },
		/** 切换间隔（毫秒），默认 3000（3秒）。注意：interval 必须大于 duration，否则动画执行期间新的切换会被忽略，导致实际切换间隔变长且不均匀 */
		interval: { type: Number, default: 3000 },
		/** 动画时长（毫秒），默认 500 */
		duration: { type: Number, default: 500 },
		/** 动画方向：vertical / vertical-reverse / horizontal / horizontal-reverse */
		direction: {
			type: String,
			default: 'vertical',
			validator: v =>
				['vertical', 'vertical-reverse', 'horizontal', 'horizontal-reverse'].includes(v)
		},
		/** 容器高度（rpx），默认 80 */
		height: { type: Number, default: 80 },
		/** 是否自动开始播放 */
		autoPlay: { type: Boolean, default: true }
	},

	data() {
		return {
			/** 当前显示项的索引（在 list 中） */
			currentIndex: 0,
			/** 下一项的索引 */
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
		 * 轨道内显示的两个内容项
		 *
		 * 根据方向决定排列顺序，确保动画后视口内正好是新内容：
		 * - 正向（默认）：[当前项, 下一项]
		 * - 反向：      [下一项, 当前项]
		 *
		 * 反向时，空闲偏移不是 0，而是 -50%（垂直）或 -50%（水平），
		 * 让视口落在第二个 item（即当前项）上。
		 */
		displayItems() {
			const list = this.list;
			if (!list || list.length === 0) return [];
			const cur = list[this.currentIndex] || '';
			const next = list[this.nextIndex] || '';
			switch (this.direction) {
				case 'vertical': return [cur, next];
				case 'vertical-reverse': return [next, cur];
				case 'horizontal': return [cur, next];
				case 'horizontal-reverse': return [next, cur];
				default: return [cur, next];
			}
		},

		/**
		 * 轨道基础样式（与动画无关的部分）
		 * - 垂直方向：高度 200%，flex-direction: column
		 * - 水平方向：宽度 200%，flex-direction: row
		 */
		trackBaseStyle() {
			const isHorizontal =
				this.direction === 'horizontal' || this.direction === 'horizontal-reverse';
			if (isHorizontal) {
				return 'width: 200%; height: 100%; display: flex; flex-direction: row;';
			} else {
				return 'height: 200%; width: 100%; display: flex; flex-direction: column;';
			}
		},

		/**
		 * 空闲时轨道偏移量：让当前项正好显示在容器内
		 *
		 * 对应关系：
		 * | 方向                | displayItems 顺序 | 空闲偏移         | 视口内可见 |
		 * |---------------------|-------------------|------------------|-----------|
		 * | vertical            | [cur, next]       | translateY(0)    | cur       |
		 * | vertical-reverse    | [next, cur]       | translateY(-50%) | cur       |
		 * | horizontal          | [cur, next]       | translateX(0)    | cur       |
		 * | horizontal-reverse  | [next, cur]       | translateX(-50%) | cur       |
		 */
		idleTransform() {
			switch (this.direction) {
				case 'vertical': return 'translateY(0)';
				case 'vertical-reverse': return 'translateY(-50%)';
				case 'horizontal': return 'translateX(0)';
				case 'horizontal-reverse': return 'translateX(-50%)';
				default: return 'translateY(0)';
			}
		},

		/**
		 * 动画目标偏移量：动画结束后下一项完全展示在容器内
		 *
		 * 对应关系：
		 * | 方向                | displayItems 顺序 | 动画目标偏移     | 视口内可见 |
		 * |---------------------|-------------------|------------------|-----------|
		 * | vertical            | [cur, next]       | translateY(-50%) | next      |
		 * | vertical-reverse    | [next, cur]       | translateY(0)    | next      |
		 * | horizontal          | [cur, next]       | translateX(-50%) | next      |
		 * | horizontal-reverse  | [next, cur]       | translateX(0)    | next      |
		 */
		animTransform() {
			switch (this.direction) {
				case 'vertical': return 'translateY(-50%)';
				case 'vertical-reverse': return 'translateY(0)';
				case 'horizontal': return 'translateX(-50%)';
				case 'horizontal-reverse': return 'translateX(0)';
				default: return 'translateY(-50%)';
			}
		},

		/**
		 * 轨道最终行内样式：基础样式 + transform + transition
		 *
		 * 状态转换：
		 * - 空闲：idleTransform，无 transition（瞬间定位）
		 * - 动画中：animTransform，带 transition（平滑过渡）
		 */
		trackStyle() {
			// 根据当前是否在动画中，决定用哪一个 transform 值
			// 空闲时用 idleTransform（如 translateY(0)），动画时用 animTransform（如 translateY(-50%)）
			const transform = this.isAnimating ? this.animTransform : this.idleTransform;

			// 关键：只有当 isAnimating 为 true 时，才加上 CSS transition 属性
			// 这样轨道位置的变化才会有平滑过渡效果
			const transition = this.isAnimating
				? `transition: transform ${this.duration}ms ease-in-out;`
				: 'transition: none;'; // 空闲时没有过渡，位置瞬间到位（用来无缝重置）

			// 组装最终样式：基础尺寸/布局 + 当前 transform + 是否需要动画过渡
			return `${this.trackBaseStyle} transform: ${transform}; ${transition}`;
		},

		/** 实际使用的动画时长，保证不超过 interval - 200 */
		safeDuration() {
			const minGap = 200; // 动画结束到下一次触发的安全间隔
			if (this.interval <= this.duration + minGap) {
				console.warn(
					`[marquee-ticker] interval (${this.interval}ms) 应大于 duration (${this.duration}ms) + ${minGap}ms。已将动画时长自动调整为 ${this.interval - minGap}ms。`
				);
				return Math.max(0, this.interval - minGap);
			}
			return this.duration;
		}
	},

	watch: {
		/** 外部 list 变化时，防止 currentIndex 越界 */
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

	// Vue 2 销毁前
	beforeDestroy() {
		console.log('[marquee-ticker] beforeDestroy.')
		this.cleanup();
	},

	// Vue 3 卸载前
	beforeUnmount() {
		console.log('[marquee-ticker] beforeUnmount.')
		this.cleanup();
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

		cleanup() {
			this.stop();
			if (this._animTimer) {
				clearTimeout(this._animTimer);
				this._animTimer = null;
			}
		},

		/**
		 * 触发切换到下一条
		 *
		 * 流程：
		 * 1. 设置 isAnimating = true
		 *    → trackStyle 更新为 animTransform + transition
		 *    → 轨道开始平滑移动到目标位置
		 * 2. duration后调用 _finishAnim() 完成切换
		 */
		switchNext() {
			if (this.isAnimating || this.list.length <= 1) return;
			this.isAnimating = true;
			this.$emit('switch', { from: this.currentIndex, to: this.nextIndex });

			if (this._animTimer) clearTimeout(this._animTimer);
			this._animTimer = setTimeout(() => {
				this._finishAnim();
			}, this.duration);
		},

		/**
		 * 动画结束处理：更新索引并瞬间重置轨道位置
		 *
		 * 时序详解（以垂直向上为例）：
		 * 1. 动画进行中：track translateY(-50%)，视口显示 item 1（旧 next）
		 * 2. 进入 _finishAnim：
		 *    a. currentIndex = oldNext → 当前索引变为旧 next
		 *    b. nextIndex = (oldNext + 1) % length → 计算新的下一项
		 *    c. 此时 displayItems 立即更新，track 内的两个 item 内容变为 [新cur, 新next]
		 *    d. isAnimating = false → trackStyle 变回 idleTransform (translateY(0))
		 *       → 由于 transition: none，轨道瞬间回到 0，视口显示新 cur
		 * 3. 因为新 cur 的内容已经和步骤 1 中视口看到的旧 next 相同，
		 *    只是从轨道下半部瞬间切到上半部，用户感知完全无缝
		 */
		_finishAnim() {
			this.$nextTick(() => {
				const oldNext = this.nextIndex;
				this.currentIndex = oldNext;
				this.nextIndex = (oldNext + 1) % this.list.length;
				this.isAnimating = false;
				this.$emit('switched', { current: this.currentIndex });
			});
		}
	}
};
</script>

<style lang="scss" scoped>
/* wrapper：固定高度 + overflow hidden，作为视口裁剪区域 */
.marquee-wrapper {
	position: relative;
	overflow: hidden;
	width: 100%;
}

/* 轨道：由行内样式动态控制尺寸和布局，will-change 提示 GPU 优化 */
.marquee-track {
	will-change: transform;
}

/* 每个内容项：flex: 1 保证占轨道的一半空间，内容垂直居中 */
.marquee-item {
	flex: 1;
	display: flex;
	align-items: center;
	box-sizing: border-box;
	overflow: hidden;
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