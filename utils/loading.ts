import { API } from '@/config';

/**
 * 全局 Loading 管理器
 *
 * 基于 uni.showLoading 封装，支持引用计数，解决多层异步调用时的 loading 闪烁问题
 *
 * 原理：
 *   show() 时计数 +1，首次 show 时调用 uni.showLoading
 *   hide() 时计数 -1，计数归零时延迟 100ms 后调用 uni.hideLoading
 *   延迟是为了避免连续的 show/hide 导致闪烁（如快速连续请求场景）
 *
 * 安全机制：
 *   每次 show() 都会重置一个全局兜底计时器（值取自 config.ts 的 API.timeout），
 *   若开发者漏调 hide，超时后强制关闭并 warn 提示，防止 loading 永久挂起。
 */
class GlobalLoading {
	/** 当前 show 调用计数 */
	private loadingCount : number = 0;
	/** hide 防抖定时器（归零后延迟 100ms 关闭，避免快速 show/hide 闪烁） */
	private hideDebounceTimer : number | null = null;
	/** 兜底超时定时器（每次 show 重置，超时强制关闭） */
	private safetyTimer : number | null = null;
	/** loading 是否正在显示 */
	private isShowing : boolean = false;
	/** 计数器异常阈值，超过此值自动重置（防止泄漏） */
	private readonly MAX_COUNT : number = 10;

	/**
	 * 显示 loading
	 * @param options uni.showLoading 的参数
	 * @param timeout 兜底超时时间（ms）
	 *   - 不传：使用 config.ts 的 API.timeout
	 *   - 传 0：禁用兜底超时（适用于文件下载等长时间操作）
	 * @returns 清理函数，调用即 hide
	 */
	show(options : { title ?: string; mask ?: boolean } = {}, timeout ?: number) : () => void {
		// 保护机制：计数器异常时自动重置，防止 loading 无法关闭
		if (this.loadingCount >= this.MAX_COUNT) {
			console.warn('[GlobalLoading] 计数器异常，自动重置');
			this.forceClose();
		}

		this.loadingCount++;
		// 重置兜底超时计时器：取消前一个，重新开始计时
		this.resetSafetyTimer(timeout);
		// 仅在首次 show 且当前未显示时，才真正调用 uni.showLoading
		if (this.loadingCount === 1 && !this.isShowing) {
			this.isShowing = true;
			uni.showLoading(options);
		}

		return () => this.hide();
	}

	/**
	 * 隐藏 loading（计数 -1，归零时才真正关闭）
	 */
	hide() : void {
		this.loadingCount--;
		// 计数器为负，说明有未配对的 hide 调用
		if (this.loadingCount < 0) {
			console.warn('[GlobalLoading] 发现未配对的 hide 调用，重置计数器');
			this.forceClose();
			return;
		}

		// 清除上一次的延迟关闭定时器（合并快速连续的 hide）
		if (this.hideDebounceTimer !== null) {
			clearTimeout(this.hideDebounceTimer);
		}

		// 延迟 100ms 关闭，避免快速 show→hide→show 导致闪烁
		this.hideDebounceTimer = setTimeout(() => {
			if (this.loadingCount <= 0 && this.isShowing) {
				uni.hideLoading({ noConflict: true });
				this.isShowing = false;
			}
		}, 100) as unknown as number;
	}

	/**
	 * 重置兜底超时计时器
	 *
	 * 每次 show() 调用都会执行：取消上一个计时器，重新开始计时。
	 * 超时后自动 forceClose 并 warn 提示开发者检查是否漏调了 hide。
	 *
	 * @param timeout 超时时间（ms）
	 *   - 不传：使用 config.ts 的 API.timeout
	 *   - 传 0：禁用兜底（适用于文件下载等长时间操作，不应用请求超时）
	 */
	private resetSafetyTimer(timeout ?: number) : void {
		const ms = timeout ?? API.timeout;
		if (this.safetyTimer !== null) {
			clearTimeout(this.safetyTimer);
			this.safetyTimer = null;
		}
		if (ms > 0) {
			this.safetyTimer = setTimeout(() => {
				console.warn(`[GlobalLoading] 兜底超时 ${ms}ms 自动关闭（可能漏调了 hide）`);
				this.safetyTimer = null;
				this.forceClose();
			}, ms) as unknown as number;
		}
	}

	/**
	 * 强制关闭 loading，重置计数器
	 */
	forceClose() : void {
		this.loadingCount = 0;
		this.isShowing = false;
		if (this.hideDebounceTimer !== null) {
			clearTimeout(this.hideDebounceTimer);
			this.hideDebounceTimer = null;
		}
		if (this.safetyTimer !== null) {
			clearTimeout(this.safetyTimer);
			this.safetyTimer = null;
		}
		uni.hideLoading({ noConflict: true });
	}

	/**
	 * 获取当前 loading 显示状态
	 */
	getStatus() : boolean {
		return this.isShowing;
	}

	/**
	 * 获取当前计数器值
	 */
	getCount() : number {
		return this.loadingCount;
	}

	/**
	 * 重置（等价于 forceClose）
	 */
	reset() : void {
		this.forceClose();
	}
}
// 全局单例
const loading = new GlobalLoading();

// 挂载到 uni 全局对象，可通过 uni.$loading 直接访问
if (typeof uni !== 'undefined') {
	uni.$loading = loading;
}

export { loading, GlobalLoading };