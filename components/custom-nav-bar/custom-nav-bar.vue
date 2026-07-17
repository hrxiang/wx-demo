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
		/**
		 * created — 组件创建时计算导航栏尺寸与字体大小
		 *
		 * 目标：让自定义导航栏的高度和标题字号在所有环境下
		 * 与当前平台系统原生导航栏保持一致。
		 *
		 * 适配环境：
		 * - 微信开发者工具模拟器（iOS / Android，刘海屏 / 非刘海屏）
		 * - iOS 真机（刘海屏 / 非刘海屏）
		 * - Android 真机（各品牌）
		 * - Mac / Windows 桌面端
		 *
		 * ─────────────────────────────────────────────────────────────────
		 * 关键概念：platform vs osName
		 * ─────────────────────────────────────────────────────────────────
		 *
		 * uni.getDeviceInfo() 返回两个字段，含义不同：
		 *
		 * platform（运行环境）：
		 *   'devtools' — 微信开发者工具（无论模拟哪种设备）
		 *   'ios'      — iOS 真机
		 *   'android'  — Android 真机
		 *   'windows'  — Windows 桌面端
		 *   'mac'      — Mac 桌面端
		 *
		 * osName（模拟的设备系统）：
		 *   'ios'      — 当前模拟的是 iOS 设备（如 iPhone 14 Pro）
		 *   'android'  — 当前模拟的是 Android 设备（如 Pixel 7）
		 *   'windows'  — Windows 桌面
		 *   'macos'    — macOS 桌面
		 *
		 * 关键区别：在开发者工具中 platform 恒为 'devtools'，
		 * 但 osName 会随模拟器选择的设备型号而变化。
		 *
		 * 因此：高度修正用 platform + osName 联合判断，字号用 platform 判断。
		 *
		 * ─────────────────────────────────────────────────────────────────
		 * 导航栏高度计算原理
		 * ─────────────────────────────────────────────────────────────────
		 *
		 * 微信小程序的胶囊按钮（≡ ☰）由系统渲染，其位置与系统导航栏严格对齐。
		 * 通过胶囊按钮的尺寸和位置，可以反推出系统导航栏的高度。
		 *
		 * 计算公式：
		 *   navbarHeight = capsuleHeight + (capsuleTop - statusBarHeight) × 2
		 *
		 * 原理图（上下对称留白法）：
		 *
		 *   ┌──────────────────────────────────────────┐
		 *   │             状态栏 (statusBar)            │ ← statusBarHeight
		 *   ├──────────────────────────────────────────┤
		 *   │                                          │
		 *   │  ↑ 留白 = capsuleTop - statusBar         │
		 *   │  ┌───────────┐                           │
		 *   │  │ 胶囊按钮   │  ← capsuleHeight         │
		 *   │  └───────────┘                           │
		 *   │  ↓ 留白 = capsuleTop - statusBar         │
		 *   ├──────────────────────────────────────────┤
		 *   │              页面内容区域                  │
		 *   └──────────────────────────────────────────┘
		 *
		 *   navbarHeight（内容区）= 留白 + capsuleHeight + 留白
		 *                       = (capsuleTop - statusBar) × 2 + capsuleHeight
		 *
		 * ─────────────────────────────────────────────────────────────────
		 * 模拟器高度修正
		 * ─────────────────────────────────────────────────────────────────
		 *
		 * 问题：在微信开发者工具模拟 iOS 刘海屏（如 iPhone 14 Pro）时，
		 * getMenuButtonBoundingClientRect() 返回的胶囊高度偏小，
		 * 导致计算出的 navbarHeight 小于系统原生导航栏高度。
		 *
		 * 解决方案：在 devtools 环境下取计算值与平台标准值的较大者：
		 * - iOS 标准导航栏内容区高度 = 44px
		 * - Android Material Design 标准高度 = 48px
		 *
		 * 对比：
		 * ┌──────────────────────────────────────────────────┐
		 * │ devtools + iOS:  navbarHeight = max(计算值, 44)  │
		 * │ devtools + 安卓:  navbarHeight = max(计算值, 48) │
		 * │ 其他环境:        navbarHeight = 计算值（真机精确）│
		 * └──────────────────────────────────────────────────┘
		 *
		 * ─────────────────────────────────────────────────────────────────
		 * 字体大小适配
		 * ─────────────────────────────────────────────────────────────────
		 *
		 * 各平台系统原生导航栏的标题字号不同，使用 platform 判断：
		 * - iOS 真机:     17px（iOS Human Interface Guidelines 标准标题字号）
		 * - Android 真机: 16px（Material Design 标准标题字号）
		 * - 其他（PC/模拟器）: 14px（桌面端缩放适配）
		 */
		created() {
			// ---- 1. 获取系统信息 ----
			const windowInfo = uni.getWindowInfo();
			const deviceInfo = uni.getDeviceInfo();
			const platform = deviceInfo.platform;
			const osName = deviceInfo.osName;
			const statusBarHeight = windowInfo.statusBarHeight;

			// ---- 2. 获取胶囊按钮位置，计算导航栏核心尺寸 ----

			// 微信胶囊按钮的矩形信息（px）
			// { width, height, top, right, left, bottom }
			const custom = uni.getMenuButtonBoundingClientRect();

			// right slot 的右偏移量：胶囊左边缘到屏幕右边的距离
			// 这样 right slot 的内容不会被胶囊按钮遮挡
			//   屏幕右边缘                    胶囊左边缘
			//     │←────────── capsuleRight ──────────→│
			//     │                                │ ┌────┐
			//     │                                │ │ ≡☰ │
			//     │                                │ └────┘
			const capsuleRight = windowInfo.screenWidth - custom.left;

			// 导航栏内容区高度（上下对称留白法）
			const calcNavbarHeight = custom.height + (custom.top - statusBarHeight) * 2;

			// ---- 3. 赋值给组件状态 ----
			this.statusbarHeight = statusBarHeight;
			this.rightMargin = capsuleRight;

			// ---- 4. 模拟器高度修正 ----
			// devtools 模拟刘海屏时胶囊数据可能偏小，取平台标准值兜底
			if (platform === 'devtools' && osName === 'ios') {
				// iOS 系统导航栏内容区标准高度 = 44px
				this.navbarHeight = Math.max(calcNavbarHeight, 44);
			} else if (platform === 'devtools' && osName === 'android') {
				// Android Material Design 标准高度 = 48px
				this.navbarHeight = Math.max(calcNavbarHeight, 48);
			} else {
				// 真机 / PC：直接使用胶囊按钮计算值（精确）
				this.navbarHeight = calcNavbarHeight;
			}

			// ---- 5. 字体大小适配 ----
			if (platform === 'ios') {
				this.defaultStyle.fontSize = '17px';
			} else if (platform === 'android') {
				this.defaultStyle.fontSize = '16px';
			} else {
				// devtools / windows / mac
				this.defaultStyle.fontSize = '14px';
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