/**
 * 像素单位转换工具
 *
 * rpx 是微信小程序的响应式单位，规定屏幕宽度固定为 750rpx。
 * 转换公式：px = screenWidth * rpx / 750
 *
 * 注意：rpx 基准宽度是应用启动时的屏幕宽度，横竖屏切换后 screenWidth 会变化，
 * 但 rpx 的定义不应随之改变，因此本模块在首次加载时缓存屏幕宽度，后续始终使用缓存值。
 */

/** 缓存的屏幕宽度（px），首次调用时初始化，之后不再变化 */
let cachedScreenWidth : number | null = null;

/**
 * 获取屏幕宽度（带缓存）
 *
 * 仅首次调用时通过 uni.getWindowInfo() 获取，后续直接返回缓存值，
 * 避免横竖屏切换后 screenWidth 变化导致 rpx 转换不准。
 */
function getScreenWidth() : number {
	if (cachedScreenWidth === null) {
		cachedScreenWidth = uni.getWindowInfo().screenWidth;
	}
	return cachedScreenWidth;
}

/**
 * rpx 转 px
 *
 * @param rpx rpx 值
 * @returns 对应的 px 值
 *
 * @example
 * rpxToPx(750)   // 屏幕宽度（如 375）
 * rpxToPx(100)   // 屏幕宽度的 1/7.5（如 50）
 * rpxToPx(0)     // 0
 */
export function rpxToPx(rpx : number) : number {
	return (getScreenWidth() * rpx) / 750;
}

/**
 * px 转 rpx
 *
 * @param px px 值
 * @returns 对应的 rpx 值
 *
 * @example
 * pxToRpx(375)   // 750（满屏宽度）
 * pxToRpx(50)    // 100
 */
export function pxToRpx(px : number) : number {
	return (750 * px) / getScreenWidth();
}

/**
 * rpx 转 vmin CSS 値（JS 运行时函数）
 *
 * 为什么不用 rpx？
 *   rpx 规定屏幕宽度固定为 750rpx，宽度越大 1rpx 对应的 px 越大。
 *   例如 font-size: 32rpx 在不同屏幕下的实际大小：
 *     杚屏（screenWidth=375）：32rpx = 16px
 *     横屏（screenWidth=812）：32rpx ≈ 34.7px  ← 字体变大了一倍多！
 *
 * vmin 为什么能解决？
 *   vmin = 视口较短边的 1%。
 *   杚屏时较短边是宽度，横屏时较短边是高度。
 *   对于常见的 375px 宽、812px 高的屏幕：
 *     杚屏：1vmin = 375px * 1% = 3.75px
 *     横屏：1vmin = 375px * 1% = 3.75px  ← 基准不变！
 *   因此，不管横竖屏怎么切换，vmin 的基准始终是「较短边」，视觉大小不变。
 *
 * 何时用 rpx，何时用 vmin？
 *   rpx  —— 不需要支持横屏的页面、宽度自适应布局
 *   vmin —— 横竖屏都需要视觉一致时，如字体、图标、固定大小卡片
 *
 * 公式：1rpx = (1/750) * 100vmin
 *
 * 注意：此函数适用于 JS 动态绑定 :style；若在 .scss 样式中使用，请用 uni.scss 中的 vmin() 函数。
 *
 * @param rpx rpx 値
 * @returns 带 vmin 单位的 CSS 字符串
 *
 * @example
 * toVmin(32)    // '4.2666vmin'  横竖屏字体大小一致
 * toVmin(750)   // '100vmin'    （满屏宽度）
 * toVmin(375)   // '50vmin'
 */
export function toVmin(rpx : number) : string {
	return `${(rpx / 750) * 100}vmin`;
}
