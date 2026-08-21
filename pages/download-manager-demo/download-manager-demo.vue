<template>
	<view class="dm-page">
		<!-- 存储空间信息 -->
		<view class="storage-bar">
			<view class="storage-info">
				<text class="storage-label">存储空间</text>
				<text class="storage-text">{{ formatSize(storageInfo.used) }} /
					{{ formatSize(storageInfo.limit) }}</text>
			</view>
			<view class="storage-track">
				<view class="storage-fill" :style="{ width: storagePercent + '%' }"></view>
			</view>
		</view>

		<!-- 文件列表 -->
		<view class="file-list">
			<view class="file-item" v-for="(file, index) in fileList" :key="index">
				<!-- 左侧：文件图标 + 名称 + 大小 -->
				<view class="file-main">
					<view class="file-icon" :style="{ background: iconColors[file.ext] || '#999' }">
						<text class="icon-text">{{ file.ext }}</text>
					</view>
					<view class="file-info">
						<text class="file-name">{{ file.name }}</text>
						<text class="file-meta">{{ file.fileSize ? formatSize(file.fileSize) : '未知大小' }} ·
							{{ file.ext.toUpperCase() }}</text>
					</view>
				</view>

				<!-- 右侧：状态 + 操作 -->
				<view class="file-action">
					<!-- 未下载 -->
					<view v-if="file.status === 'waiting'" class="action-row">
						<button class="btn btn-primary" size="mini" @click="startDownload(file)">下载</button>
					</view>

					<!-- 排队中（并发已满，等待调度） -->
					<view v-else-if="file.status === 'queued'" class="action-row">
						<text class="queued-text">排队中…</text>
						<button class="btn btn-cancel" size="mini" @click="cancelDownload(file)">取消</button>
					</view>

					<!-- 下载中 -->
					<view v-else-if="file.status === 'downloading'" class="action-col">
						<view class="progress-row">
							<view class="progress-track">
								<view class="progress-fill" :style="{ width: file.progress + '%' }"></view>
							</view>
							<text class="progress-text">{{ file.progress }}%</text>
						</view>
						<button class="btn btn-cancel" size="mini" @click="cancelDownload(file)">取消</button>
					</view>

					<!-- 已下载 -->
					<view v-else-if="file.status === 'downloaded'" class="action-row">
						<button class="btn btn-success" size="mini" @click="previewFile(file)">预览</button>
						<button class="btn btn-share" size="mini" @click="shareFile(file)">分享</button>
					</view>

					<!-- 失败 -->
					<view v-else-if="file.status === 'error'" class="action-col">
						<text class="error-text">{{ file.errorMsg || '下载失败' }}</text>
						<button class="btn btn-primary" size="mini" @click="startDownload(file)">重试</button>
					</view>
				</view>
			</view>
		</view>

		<!-- 底部操作栏 -->
		<view class="bottom-bar">
			<button class="btn btn-primary" @click="downloadAll">全部下载</button>
			<button class="btn btn-danger" @click="clearAll">清空全部</button>
		</view>
	</view>
</template>

<script>
	import {
		downloadManager
	} from '@/utils/download-manager'

	// 模拟接口返回的文件列表（实际项目中由 API 提供 url 和 fileSize）
	// fileSize 可选：提供则用于存储空间预估，不提供则以实际下载大小为准
	const FILE_LIST = [{
			name: 'W3C 示例 PDF 文档',
			url: 'https://csde-file.oss-cn-shanghai.aliyuncs.com/test/20240613/2024-06-13%E6%A0%B8%E7%AE%97%E6%8A%A5%E5%91%8A1718259090511.pdf',
		},
		{
			name: 'NASA 高清图片',
			url: 'https://images.nasa.gov/assets/images/original/image-features/PIA23150/PIA23150_orig.jpg',
		},
		{
			name: '示例 DOCX 文档',
			url: 'https://filesamples.com/samples/document/docx/sample2.docx',
		},
	]

	export default {
		data() {
			return {
				fileList: [],
				storageInfo: {
					used: 0,
					limit: 120 * 1024 * 1024,
					available: 0
				},
				iconColors: {
					pdf: '#e53935',
					doc: '#1e88e5',
					docx: '#1e88e5',
					xls: '#43a047',
					xlsx: '#43a047',
					jpg: '#8e24aa',
					jpeg: '#8e24aa',
					png: '#8e24aa',
					mp4: '#fb8c00',
				},
			}
		},

		computed: {
			storagePercent() {
				if (!this.storageInfo.limit) return 0
				return Math.min(100, (this.storageInfo.used / this.storageInfo.limit) * 100).toFixed(1)
			},
		},

		onLoad() {
			// 本页面所有订阅的退订函数（非渲染数据，不放入 data）
			this._subscriptions = []
			this.initFileList()
		},

		onUnload() {
			// 不取消下载，不重置状态 —— 下载任务在小程序生命周期内持续进行，
			// 再次进入时通过 getDownloadState + subscribeProgress 恢复进度显示。
			// 但必须退订本页回调：每次进页面都会重新订阅，旧回调若不清理会
			// 持续累积（每个进度 tick 都给已销毁页面的对象白白赋值），
			// 直到下载完成才随任务一并丢弃。
			this._unsubscribeAll()
		},

		methods: {
			/** 登记一个退订函数，页面销毁（onUnload）时统一调用 */
			_track(unsubscribe) {
				this._subscriptions.push(unsubscribe)
			},

			/** 退订本页面注册的所有监听（onUnload 时调用） */
			_unsubscribeAll() {
				(this._subscriptions || []).forEach((fn) => fn())
				this._subscriptions = []
			},

			/**
			 * 初始化文件列表，同步当前下载状态
			 *
			 * 注意：订阅必须在 this.fileList 赋值之后进行。
			 * Vue 3 响应式基于 Proxy：map 回调里的对象是原始对象，
			 * 赋值给 this.fileList 后模板读写走代理。
			 * 订阅闭包必须捕获代理（通过 this.fileList 迭代获取），
			 * 否则修改原始对象不触发视图更新，进度条不动。
			 */
			initFileList() {
				this.fileList = FILE_LIST.map((f) => {
					const ext = f.url.split('.').pop().split('?')[0].toLowerCase()
					const base = {
						...f,
						ext,
						errorMsg: ''
					}

					// 1. 已下载完成
					const record = downloadManager.getRecord(f.url)
					if (record) {
						return {
							...base,
							fileSize: record.fileSize,
							status: 'downloaded',
							progress: 0
						}
					}

					// 2. 下载中或排队中（单例内存中仍有追踪，页面退出不影响）
					const state = downloadManager.getDownloadState(f.url)
					if (state) {
						return {
							...base,
							fileSize: f.fileSize || 0,
							status: state, // 'queued' 或 'downloading'
							progress: 0
						}
					}

					// 3. 未下载（小程序退出后任务已终止，从头开始）
					return {
						...base,
						fileSize: f.fileSize || 0,
						status: 'waiting',
						progress: 0
					}
				})
				this.storageInfo = downloadManager.getStorageInfo()

				// 赋值后通过 this.fileList 迭代 —— 拿到的是响应式代理对象
				this.fileList.forEach((file) => {
					if (file.status !== 'downloading' && file.status !== 'queued') return

					// 订阅实时进度，立即同步当前进度值
					const current = downloadManager.subscribeProgress(file.url, (progress) => {
						file.progress = progress
					})
					if (current) {
						file.progress = current.progress
						this._track(current.unsubscribe)
					}

					// 订阅状态变化：排队中 → 下载中
					const stateSub = downloadManager.subscribeStateChange(file.url, (state) => {
						file.status = state
					})
					if (stateSub) this._track(stateSub.unsubscribe)

					// download() 复用同一个 Promise，接收最终结果
					downloadManager
						.download({ url: file.url })
						.then((result) => {
							if (result.success) {
								file.status = 'downloaded'
								file.fileSize = result.record.fileSize
							} else if (result.error === '已取消') {
								file.status = 'waiting' // 用户取消，回到未下载状态
							} else {
								file.status = 'error'
								file.errorMsg = result.error
							}
							this.storageInfo = downloadManager.getStorageInfo()
						})
				})
			},

			/** 用户点击“下载”按钮 */
			startDownload(file) {
				file.progress = 0
				file.errorMsg = ''
				this._doDownload(file) // 实际状态（排队/下载中）由 _doDownload 内部查询修正
			},

			/** 执行下载（手动下载和恢复订阅共用） */
			_doDownload(file) {
				// download() 内部已处理去重：如果同一 URL 正在下载，会复用同一个 Promise。
				// 注意不传 onProgress：复用旧 Promise 时它会被忽略，且页面销毁后无法退订，
				// 统一改用 subscribeProgress（返回 unsubscribe，可随页面销毁清理）
				downloadManager
					.download({
						url: file.url,
						fileSize: file.fileSize || 0,
					})
					.then((result) => {
						if (result.success) {
							file.status = 'downloaded'
							file.fileSize = result.record.fileSize
						} else if (result.error === '已取消') {
							file.status = 'waiting' // 用户取消，回到未下载状态
						} else {
							file.status = 'error'
							file.errorMsg = result.error
						}
						this.storageInfo = downloadManager.getStorageInfo()
					})

				// download() 同步完成占位/入队，查询真实状态修正 UI
				// （并发已满时实际是排队中，而非下载中）
				const state = downloadManager.getDownloadState(file.url)
				if (state) file.status = state

				// 订阅实时进度（排队中也能订阅，开始下载后即收到回调）
				const progressSub = downloadManager.subscribeProgress(file.url, (progress) => {
					file.progress = progress
				})
				if (progressSub) this._track(progressSub.unsubscribe)

				// 订阅状态变化：排队中 → 下载中
				const stateSub = downloadManager.subscribeStateChange(file.url, (s) => {
					file.status = s
				})
				if (stateSub) this._track(stateSub.unsubscribe)
			},

			/** 取消下载 */
			cancelDownload(file) {
				downloadManager.cancel(file.url)
				file.status = 'waiting'
				file.progress = 0
			},

			/** 预览文件（工具类只更新使用时间，预览方式由调用方按类型决定） */
			previewFile(file) {
				downloadManager
					.preview(file.url)
					.then((record) => {
						const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
						if (imageExts.includes(file.ext)) {
							// 图片：openDocument 不支持，用图片预览
							uni.previewImage({
								urls: [record.filePath],
							})
						} else {
							// 文档：pdf/doc/xls/ppt 等
							uni.openDocument({
								filePath: record.filePath,
								fileType: record.fileType,
								showMenu: true,
								fail: () => {
									uni.showToast({
										title: '打开失败',
										icon: 'none'
									})
								}
							})
						}
					})
					.catch(() => {
						uni.showToast({
							title: '预览失败',
							icon: 'none'
						})
						console.error('预览失败')
					})
			},

			/** 分享文件 */
			shareFile(file) {
				downloadManager
					.share(file.url)
					.then((record) => {
						uni.showToast({
							title: `分享: ${record.fileName}`,
							icon: 'none'
						})
					})
					.catch(() => {
						uni.showToast({
							title: '分享失败',
							icon: 'none'
						})
					})
			},

			/** 批量下载全部 */
			downloadAll() {
				for (const file of this.fileList) {
					if (file.status === 'waiting' || file.status === 'error') {
						this.startDownload(file)
					}
				}
			},

			/** 清空所有已下载文件 */
			clearAll() {
				uni.showModal({
					title: '确认清空',
					content: '将删除所有已下载的文件并取消正在下载的任务',
					success: (res) => {
						if (!res.confirm) return
						downloadManager.cancelAll()
						downloadManager.clearAll()
						this.initFileList()
					},
				})
			},

			/** 格式化文件大小 */
			formatSize(bytes) {
				if (!bytes || bytes === 0) return '0 B'
				if (bytes < 1024) return bytes + ' B'
				if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
				return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
			},
		},
	}
</script>

<style lang="scss" scoped>
	.dm-page {
		padding: 20rpx;
		padding-bottom: 140rpx;
	}

	/* ==================== 存储空间条 ==================== */

	.storage-bar {
		background: #fff;
		border-radius: 16rpx;
		padding: 24rpx;
		margin-bottom: 20rpx;
	}

	.storage-info {
		display: flex;
		justify-content: space-between;
		margin-bottom: 12rpx;
	}

	.storage-label {
		font-size: 26rpx;
		color: #666;
	}

	.storage-text {
		font-size: 26rpx;
		color: #333;
		font-weight: 500;
	}

	.storage-track {
		height: 12rpx;
		background: #f0f0f0;
		border-radius: 6rpx;
		overflow: hidden;
	}

	.storage-fill {
		height: 100%;
		background: linear-gradient(90deg, #4caf50, #8bc34a);
		border-radius: 6rpx;
		transition: width 0.3s;
	}

	/* ==================== 文件列表 ==================== */

	.file-list {
		background: #fff;
		border-radius: 16rpx;
		overflow: hidden;
	}

	.file-item {
		padding: 24rpx;
		border-bottom: 1rpx solid #f5f5f5;

		&:last-child {
			border-bottom: none;
		}
	}

	.file-main {
		display: flex;
		align-items: center;
		margin-bottom: 16rpx;
	}

	.file-icon {
		width: 72rpx;
		height: 72rpx;
		border-radius: 12rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-right: 20rpx;
	}

	.icon-text {
		color: #fff;
		font-size: 20rpx;
		font-weight: bold;
		text-transform: uppercase;
	}

	.file-info {
		flex: 1;
		min-width: 0;
	}

	.file-name {
		font-size: 28rpx;
		color: #333;
		font-weight: 500;
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-meta {
		font-size: 24rpx;
		color: #999;
		margin-top: 6rpx;
		display: block;
	}

	/* ==================== 操作区域 ==================== */

	.file-action {
		padding-left: 92rpx;
	}

	.action-row {
		display: flex;
		gap: 16rpx;
	}

	.action-col {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.progress-row {
		display: flex;
		align-items: center;
		flex: 1;
		gap: 12rpx;
	}

	.progress-track {
		flex: 1;
		height: 16rpx;
		background: #f0f0f0;
		border-radius: 8rpx;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #1e88e5, #42a5f5);
		border-radius: 8rpx;
		transition: width 0.15s;
	}

	.progress-text {
		font-size: 24rpx;
		color: #1e88e5;
		width: 80rpx;
		text-align: right;
		flex-shrink: 0;
	}

	.error-text {
		font-size: 24rpx;
		color: #e53935;
		flex: 1;
	}

	.queued-text {
		font-size: 24rpx;
		color: #999;
		flex: 1;
	}

	/* ==================== 按钮 ==================== */

	.btn {
		font-size: 24rpx;
		border-radius: 8rpx;
		padding: 0 24rpx;
		height: 56rpx;
		line-height: 56rpx;
		border: none;
	}

	.btn-primary {
		background: #1e88e5;
		color: #fff;
	}

	.btn-success {
		background: #43a047;
		color: #fff;
	}

	.btn-cancel {
		background: #f5f5f5;
		color: #666;
		flex-shrink: 0;
	}

	.btn-share {
		background: #fb8c00;
		color: #fff;
	}

	.btn-danger {
		background: #e53935;
		color: #fff;
	}

	/* ==================== 底部操作栏 ==================== */

	.bottom-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		gap: 20rpx;
		padding: 20rpx;
		background: #fff;
		box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
	}

	.bottom-bar .btn {
		flex: 1;
		height: 80rpx;
		line-height: 80rpx;
		font-size: 28rpx;
		border-radius: 12rpx;
	}
</style>