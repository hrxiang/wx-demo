/**
 * 微信小程序 SSE（Server-Sent Events）客户端
 *
 * 基于 wx.request 的 enableChunked 实现流式数据接收，模拟浏览器 EventSource 行为。
 * 支持数据包完整性校验、心跳包过滤、断线自动重连。
 *
 * 使用示例：
 * ```ts
 * const es = createEventSource({
 *   url: 'https://example.com/sse',
 *   onmessage: (data) => {
 *     console.log('收到消息:', data);
 *   },
 * });
 *
 * // 手动关闭
 * es.close();
 *
 * // 手动重新打开
 * es.open();
 * ```
 */

/**
 * SSE 连接配置
 */
interface EventSourceOptions {
	/** SSE 服务端地址 */
	url : string;
	/** 请求方法，默认 'GET' */
	method ?: 'GET' | 'OPTIONS' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT';
	/** 请求头 */
	header ?: Record<string, string>;
	/** 请求参数 */
	data ?: Record<string, any>;
	/** 是否验证 SSL 证书，默认 false */
	sslVerify ?: boolean;
	/** 是否验证数据包完整性（处理分包），默认 true */
	packetIntegrityVerify ?: boolean;
	/** 请求超时时间（ms），默认 30 分钟 */
	timeout ?: number;
	/** 是否自动重连，默认 true */
	reconnection ?: boolean;
	/** 重连间隔（ms），0 表示立即重连，默认 0 */
	reconnectionInterval ?: number;
	/** 心跳包关键字，收到包含此关键字的消息时跳过，默认 'heartbeat' */
	heartbeatKeywords ?: string;
	/** 收到消息时的回调 */
	onmessage ?: (data : string) => void;
}

/** SSE 连接实例 */
interface EventSourceInstance {
	/** 关闭连接 */
	close : () => void;
	/** 重新打开连接 */
	open : () => void;
}

/**
 * 创建 SSE 连接实例
 *
 * @param options 连接配置
 * @returns SSE 实例，包含 open / close 方法；url 为空时返回 null
 */
export function createEventSource(options : EventSourceOptions) : EventSourceInstance | null {
	const {
		url = '',
		method = 'GET',
		header = {},
		data = {},
		sslVerify = false,
		packetIntegrityVerify = true,
		timeout = 30 * 60 * 1000,
		reconnection = true,
		reconnectionInterval = 0,
		heartbeatKeywords = 'heartbeat',
		onmessage = (_data : string) => {},
	} = options;

	if (!url) {
		console.error('[EventSource] URL 不能为空');
		return null;
	}

	// #ifdef MP-WEIXIN

	let requestTask : any = null;
	let reconnectionTimer : number | null = null;
	let buffer = '';

	/**
	 * 打开 SSE 连接
	 *
	 * 使用 wx.request 的 enableChunked 模式接收流式数据，
	 * 通过 onChunkReceived 监听每个数据块。
	 */
	function open() : void {
		buffer = '';
		requestTask = wx.request({
			url,
			method,
			data,
			header,
			timeout,
			enableChunked: true,
			sslVerify,
			complete: (res : any) => {
				if (reconnection && shouldReconnect(res)) {
					scheduleReconnect();
				}
			},
		});

		requestTask.onChunkReceived((res : any) => {
			const text = decodeChunk(res.data);

			// 过滤心跳包
			if (heartbeatKeywords && text.includes(heartbeatKeywords)) {
				return;
			}

			if (packetIntegrityVerify) {
				handleChunkWithVerification(text);
			} else {
				onmessage(text);
			}
		});
	}

	/**
	 * 解码二进制数据块为 UTF-8 字符串
	 */
	function decodeChunk(arrayBuffer : ArrayBuffer) : string {
		const uint8Array = new Uint8Array(arrayBuffer);
		// 优先使用 TextDecoder（正确处理多字节 UTF-8）
		if (typeof TextDecoder !== 'undefined') {
			return new TextDecoder('utf-8').decode(uint8Array);
		}
		// 降级方案：逐字节解码（仅适用于纯 ASCII）
		let text = String.fromCharCode.apply(null, uint8Array as unknown as number[]);
		try {
			text = decodeURIComponent(escape(text));
		} catch (_e) {
			// escape/unescape 方案对某些字符可能失败，直接返回原文
		}
		return text;
	}

	/**
	 * 带完整性校验的数据块处理
	 *
	 * SSE 协议中一条完整消息以 "data:" 开头、"\n\n" 结尾。
	 * 但微信的 onChunkReceived 可能将一条消息拆成多个 chunk 返回，
	 * 因此需要用 buffer 拼接不完整的包：
	 *
	 *   ┌─────────────┬──────────────┬──────────────────────┐
	 *   │ 以 data: 开头 │ 以 \n\n 结尾 │ 含义                  │
	 *   ├─────────────┼──────────────┼──────────────────────┤
	 *   │     ✅      │     ✅       │ 完整包，直接回调       │
	 *   │     ✅      │     ❌       │ 只有头部，存入 buffer  │
	 *   │     ❌      │     ✅       │ 只有尾部，拼接后回调   │
	 *   │     ❌      │     ❌       │ 中间片段，拼入 buffer  │
	 *   └─────────────┴──────────────┴──────────────────────┘
	 */
	function handleChunkWithVerification(text : string) : void {
		const hasHead = text.startsWith('data:');
		const hasTail = text.endsWith('\n\n');

		if (hasHead && hasTail) {
			// 完整包
			buffer = text;
			onmessage(buffer);
			buffer = '';
		} else if (hasHead && !hasTail) {
			// 只有头部，存入 buffer 等待后续 chunk
			buffer = text;
		} else if (!hasHead && hasTail) {
			// 只有尾部，拼接后回调
			buffer += text;
			onmessage(buffer);
			buffer = '';
		} else {
			// 中间片段，拼入 buffer
			buffer += text;
		}
	}

	/**
	 * 判断是否应该重连
	 *
	 * 以下情况视为"非正常断开"，应触发重连：
	 * - 504 网关超时
	 * - 请求超时（errMsg 包含 "timeout"）
	 * - 连接中断（errMsg 包含 "interrupted"，如小程序切后台）
	 * - 网络错误（errMsg 为 "request:fail"）
	 *
	 * 注意：statusCode === 200 是正常响应完成，不算断开，不应重连。
	 */
	function shouldReconnect(res : any) : boolean {
		if (res.statusCode === 504) return true;
		if (!res.errMsg) return false;
		const msg = res.errMsg;
		if (msg.includes('timeout')) return true;
		if (msg.includes('interrupted')) return true;
		if (msg.trim() === 'request:fail') return true;
		return false;
	}

	/**
	 * 按配置的间隔调度重连
	 */
	function scheduleReconnect() : void {
		close();
		if (reconnectionInterval > 0) {
			if (!reconnectionTimer) {
				reconnectionTimer = setTimeout(() => {
					reconnectionTimer = null;
					open();
				}, reconnectionInterval) as unknown as number;
			}
		} else {
			open();
		}
	}

	/**
	 * 关闭连接，清理资源
	 */
	function close() : void {
		if (reconnectionTimer !== null) {
			clearTimeout(reconnectionTimer);
			reconnectionTimer = null;
		}
		if (requestTask) {
			requestTask.offChunkReceived();
			requestTask.abort();
			requestTask = null;
		}
		buffer = '';
	}

	// #endif

	return {
		close,
		open,
	};
}
