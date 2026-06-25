/**
 * 定时器管理器
 *
 * 按组件实例分组管理 setTimeout / setInterval，组件销毁时一键清除，防止内存泄漏。
 *
 * 使用示例：
 * ```ts
 * // 组件中
 * import { timerManager } from '@/utils/timer';
 *
 * // 添加定时器
 * timerManager.setInterval(this, () => { ... }, 5000);
 * timerManager.setTimeout(this, () => { ... }, 3000);
 *
 * // 组件销毁时清除该组件的所有定时器
 * onUnmounted(() => timerManager.clearByInstance(this));
 * ```
 */

/** 组件实例类型，对应 Vue/小程序中 this 或组件引用 */
type ComponentInstance = object;

class TimerManager {
	/**
	 * 定时器注册表
	 * key: 组件实例
	 * value: 该实例下的所有定时器 ID 集合
	 */
	private timers : Map<ComponentInstance, Set<number>>;

	constructor() {
		this.timers = new Map();
	}

	/**
	 * 获取或创建指定实例的定时器集合（内部辅助方法）
	 */
	private getOrCreateTimerSet(instance : ComponentInstance) : Set<number> {
		let timerSet = this.timers.get(instance);
		if (!timerSet) {
			timerSet = new Set();
			this.timers.set(instance, timerSet);
		}
		return timerSet;
	}

	/**
	 * 添加一个间隔定时器（setInterval）
	 * @param instance 组件实例（通常传 this）
	 * @param callback 每次触发的回调
	 * @param interval 间隔毫秒数，默认 60 秒
	 * @returns 定时器 ID，可用于 clearInterval
	 */
	setInterval(instance : ComponentInstance, callback : () => void, interval : number = 60 * 1000) : number {
		const timerId = setInterval(callback, interval) as unknown as number;
		this.getOrCreateTimerSet(instance).add(timerId);
		return timerId;
	}

	/**
	 * 添加一个延时定时器（setTimeout）
	 * @param instance 组件实例（通常传 this）
	 * @param callback 延时结束后触发的回调
	 * @param delay 延时毫秒数，默认 60 秒
	 * @returns 定时器 ID，可用于 clearTimeout
	 */
	setTimeout(instance : ComponentInstance, callback : () => void, delay : number = 60 * 1000) : number {
		const timerId = setTimeout(callback, delay) as unknown as number;
		this.getOrCreateTimerSet(instance).add(timerId);
		return timerId;
	}

	/**
	 * 清除指定实例的单个定时器
	 * @param instance 组件实例
	 * @param timerId 要清除的定时器 ID
	 */
	clearTimer(instance : ComponentInstance, timerId : number) : void {
		clearInterval(timerId);
		clearTimeout(timerId);
		const timerSet = this.timers.get(instance);
		if (timerSet) {
			timerSet.delete(timerId);
			// 该实例下已无定时器时，移除整个条目
			if (timerSet.size === 0) {
				this.timers.delete(instance);
			}
		}
	}

	/**
	 * 清除指定实例的所有定时器
	 * @param instance 组件实例
	 */
	clearByInstance(instance : ComponentInstance) : void {
		const timerSet = this.timers.get(instance);
		if (!timerSet) return;

		timerSet.forEach(timerId => {
			clearInterval(timerId);
			clearTimeout(timerId);
		});
		this.timers.delete(instance);
	}

	/**
	 * 清除所有实例的所有定时器
	 */
	clearAll() : void {
		this.timers.forEach((timerSet) => {
			timerSet.forEach(timerId => {
				clearInterval(timerId);
				clearTimeout(timerId);
			});
		});
		this.timers.clear();
	}

	/**
	 * 获取指定实例的定时器数量
	 */
	getCount(instance : ComponentInstance) : number {
		return this.timers.get(instance)?.size ?? 0;
	}
}

/** 全局单例 */
export const timerManager : TimerManager = new TimerManager();
