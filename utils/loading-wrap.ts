/**
 * Loading 包装器
 *
 * 将异步操作包裹在 loading 状态中，自动在开始时 show、结束时 hide。
 * 基于 Promise.allSettled，所有 Promise 无论成功失败都会等完再关闭 loading。
 *
 * 使用示例：
 * ```ts
 * // 基本用法：自动 show/hide
 * await loadingWrap([api1(), api2()]);
 *
 * // 不自动 show（手动控制显示时机）
 * await loadingWrap([api1()], { show: false });
 *
 * // 不自动 hide（需要后续再处理）
 * await loadingWrap([api1()], { hide: false });
 *
 * // 自定义 loading 标题
 * await loadingWrap([api1()], { title: '提交中' });
 *
 * // 返回值：Promise.allSettled 的结果数组
 * const results = await loadingWrap([api1(), api2()]);
 * results.forEach(r => {
 *   if (r.status === 'fulfilled') console.log(r.value);
 *   else console.error(r.reason);
 * });
 * ```
 */

/**
 * 将多个异步操作包裹在 loading 中
 *
 * @param values Promise 数组（Iterable）
 * @param options 配置项
 * @param options.show 是否在开始时显示 loading，默认 true
 * @param options.hide 是否在结束时隐藏 loading，默认 true
 * @param options.title loading 标题文字
 * @param options.mask 是否显示透明蒙层（防止触摸穿透），默认 true
 * @returns Promise.allSettled 的结果数组
 */
export async function loadingWrap<T>(
	values : Iterable<T | PromiseLike<T>>,
	options ?: {
		show ?: boolean;
		hide ?: boolean;
		title ?: string;
		mask ?: boolean;
	}
) : Promise<PromiseSettledResult<Awaited<T>>[]> {
	const { show = true, hide = true, title, mask = true } = options || {};

	if (show) {
		uni.$loading.show({ title, mask });
	}

	return Promise.allSettled(values).finally(() => {
		if (hide) {
			uni.$loading.hide();
		}
	});
}
