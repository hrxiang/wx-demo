/**
 * 全局类型声明
 *
 * .d.ts 文件会被 TypeScript 自动识别，无需 import，所有文件均可使用
 */

// 扩展内置的 UniApp.Uni 接口，为 uni.$loading 补充类型
// 注意：这里是接口合并（augmentation），会自动合并到 HBuilderX 内置的 UniApp.Uni 上，
// 不要用 declare const uni 重新声明，否则会覆盖内置类型导致所有 uni.xxx 报错
declare namespace UniApp {
	interface Uni {
		/** 全局 Loading 管理器（由 loading.ts 运行时挂载） */
		$loading : {
			/** 显示 loading，返回清理函数 */
			show : (options ?: { title ?: string; mask ?: boolean }) => () => void;
			/** 隐藏 loading（引用计数 -1） */
			hide : () => void;
			/** 强制关闭 loading，重置计数器 */
			forceClose : () => void;
			/** 获取当前显示状态 */
			getStatus : () => boolean;
			/** 获取当前计数器值 */
			getCount : () => number;
			/** 重置（等价于 forceClose） */
			reset : () => void;
		};
	}
}