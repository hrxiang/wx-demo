<!--
	自定义导航栏组件

	布局结构：
	  1. 占位 view：高度 = 状态栏 + 导航栏，撑开文档流防止内容被 fixed 遮挡
	  2. fixed 容器：固定在屏幕顶部，不占文档流空间
	     ├── navbar：包含 paddingTop 把内容推到状态栏下方
	     │   ├── left slot（左侧区域）：默认显示返回箭头 + 左对齐标题
	     │   ├── right slot（右侧区域）：右边距适配胶囊按钮位置，避免被遮挡
	     │   └── default slot（居中区域）：默认显示居中标题

	使用示例：
	  基础用法：       <custom-nav-bar title="首页" />
	  自定义右侧按钮： <custom-nav-bar title="详情"><template #right><text @click="share">分享</text></template></custom-nav-bar>
	  自定义返回行为： <custom-nav-bar title="编辑" :onBack="handleBack" />
-->
<template>
	<view class="nav-bar">
		<!-- 占位元素：撑开文档流，高度 = 状态栏 + 导航栏，防止后续内容被 fixed 遮挡 -->
		<view :style="{ width: '100%', height: (statusbarHeight + navbarHeight) + 'px' }"></view>
		<!-- fixed 容器：固定在屏幕顶部，脱离文档流 -->
		<view style="top: 0; left: 0; right: 0; position: fixed; z-index: 10;">
			<!-- navbar：paddingTop 把内容推到状态栏下方，customStyle 可覆盖 defaultStyle -->
			<view id="navbar"
				:style="{height: navbarHeight + 'px', paddingTop: statusbarHeight + 'px', ...defaultStyle, ...customStyle}">
				<!-- 左侧区域：绝对定位到左边，padding-left 适配刘海屏安全区 -->
				<view style="position: absolute; left: 0; padding-left: env(safe-area-inset-left);"
					:style="{height: navbarHeight + 'px'}">
					<slot name="left">
						<!-- 默认内容：返回箭头 + 左对齐标题 -->
						<view style="display: flex; align-items: center; height: 100%;">
							<!-- 返回箭头：showBack 控制显示，onBack 控制点击行为 -->
							<view v-if="showBack" class="arrow-container" @click="onBack">
								<view class="arrow-left-thin"></view>
							</view>
							<view v-if="position === 'left'" class="title title-left">{{title}}</view>
						</view>
					</slot>
				</view>
				<!-- 右侧区域：绝对定位到右边，right 值 = 胶囊按钮距屏幕右边距离，避免被胶囊遮挡 -->
				<view style="position: absolute; padding-right: env(safe-area-inset-right);"
					:style="{height: navbarHeight + 'px', right: rightMargin + 'px'}">
					<slot name="right"></slot>
				</view>
				<!-- 居中区域：默认插槽，z-index: 10 确保标题层级在左右 slot 之上 -->
				<view style="z-index: 10;">
					<slot>
						<view v-if="position === 'center'" class="title title-center">{{title}}</view>
					</slot>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		name: "custom-nav-bar",
		props: {
			/** 是否显示左侧返回箭头 */
			showBack: {
				type: Boolean,
				default: true,
			},
			/**
			 * 返回箭头的点击回调
			 * 默认行为是 uni.navigateBack()，传自定义函数可覆盖（如在返回前做二次确认）
			 */
			onBack: {
				type: Function,
				default: () => {
					uni.navigateBack()
				}
			},
			/** 标题文字 */
			title: {
				type: String,
				default: '',
			},
			/** 标题对齐方式：'center' 居中 | 'left' 左对齐 */
			position: {
				type: String,
				default: 'center',
			},
			/** 自定义样式，通过展开运算符覆盖 defaultStyle 中的对应属性 */
			customStyle: {
				type: Object,
				default: null,
			}
		},
		data() {
			return {
				/** 导航栏内容区高度（不含状态栏），由胶囊按钮位置计算得出 */
				navbarHeight: 0,
				/** 状态栏高度（px），导航栏 paddingTop 用此值将内容推到状态栏下方 */
				statusbarHeight: 0,
				/** 右侧区域距屏幕右边的距离（px），避免内容被微信胶囊按钮遮挡 */
				rightMargin: 0,
				/**
				 * navbar 默认内联样式
				 * created() 中会根据平台调整 fontSize 和 backgroundColor
				 * customStyle prop 可覆盖此处的任意属性
				 */
				defaultStyle: {
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					fontSize: '17px',
					fontWeight: '500',
					color: '#000000',
					background: '#fff',
				}
			};
		},
		created() {
			const windowInfo = uni.getWindowInfo();
			const deviceInfo = uni.getDeviceInfo();
			const platform = deviceInfo.platform;
			const osName = deviceInfo.osName;
			const isIos = platform === 'ios';
			const isAndroid = platform === 'android';
			const isWindows = platform === 'windows';
			const isMac = platform === 'mac';
			const isOhos = platform === 'ohos';
			const isOhosPc = platform === 'ohos_pc';
			const isDevtools = platform === 'devtools';

			if (platform === 'devtools') {
				// 模拟器环境：uni.getMenuButtonBoundingClientRect 返回的值不可靠，使用固定值模拟
				const simulatedStatusBarHeight = 20;
				const simulatedCapsuleWidth = 87;
				const simulatedCapsuleHeight = 32;
				const simulatedCapsuleRight = 10;
				// 模拟器中 osName 取决于宿主机系统，此处仅做粗略适配
				const simulatedCapsuleTop = simulatedStatusBarHeight + (osName === 'ios' ? 6 : 8);
				const capsuleLeft2ScreenRightDistance = simulatedCapsuleWidth + simulatedCapsuleRight;

				// 导航栏高度 = 胶囊高度 + (胶囊顶部 - 状态栏高度) × 2（上下对称留白）
				this.navbarHeight = simulatedCapsuleHeight + (simulatedCapsuleTop - simulatedStatusBarHeight) * 2;
				this.statusbarHeight = simulatedStatusBarHeight;
				this.rightMargin = capsuleLeft2ScreenRightDistance;
				this.defaultStyle.fontSize = '13px';
				// this.defaultStyle.backgroundColor = osName === 'ios' ? '#F8F8F8' : '#FFFFFF';
			} else {
				// 真机环境：通过系统 API 获取精确值
				const statusBarHeight = windowInfo.statusBarHeight;
				// 获取微信胶囊按钮位置（width, height, top, right, left, bottom）
				const custom = uni.getMenuButtonBoundingClientRect();
				// 胶囊左边缘到屏幕右边的距离 = right slot 的右偏移量
				const capsuleLeft2ScreenRightDistance = windowInfo.screenWidth - custom.left;

				// 导航栏高度 = 胶囊高度 + (胶囊顶部 - 状态栏高度) × 2（上下对称留白）
				this.navbarHeight = custom.height + (custom.top - statusBarHeight) * 2;
				this.statusbarHeight = statusBarHeight;
				this.rightMargin = capsuleLeft2ScreenRightDistance;
				this.defaultStyle.fontSize = isWindows || isMac ? '14px' : '17px';
				// this.defaultStyle.backgroundColor = osName === 'ios' ? '#F8F8F8' : '#FFFFFF';
			}
		}
	}
</script>

<style lang="scss" scoped>
	/* 外层容器：relative 定位 + z-index 确保导航栏在页面内容之上 */
	.nav-bar {
		position: relative;
		z-index: 10;
	}

	/* 返回箭头：用 border-left + border-bottom 旋转 45° 绘制，无需引入图标资源 */
	.arrow-left-thin {
		width: 10px;
		height: 10px;
		border-left: 2px solid #191919;
		border-bottom: 2px solid #191919;
		transform: rotate(45deg);
	}

	/* 返回箭头点击区域：左侧 15px padding 扩大点击热区 */
	.arrow-container {
		padding-left: 15px;
		height: 100%;
		display: flex;
		align-items: center;
	}

	/* 标题公共样式：单行溢出省略 */
	.title {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;

		/* 居中标题：限制宽度为视口 1/3，避免与左右区域重叠 */
		&-center {
			max-width: calc(100vw / 3);
		}

		/* 左对齐标题：限制宽度为视口 1.5/3，左侧空间更宽 */
		&-left {
			max-width: calc(100vw * 1.5 / 3);
		}
	}
</style>