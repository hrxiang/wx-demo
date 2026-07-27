<!--
	Canvas 文档导出 Demo（图片格式）
	===================================

	背景说明：
	  微信小程序无法纯客户端生成真正的 PDF 文件（PDF 是二进制格式，
	  中文需要嵌入几十 MB 的 CJK 字体，不现实）。

	  最接近的纯客户端替代方案是：在 Canvas 上绘制表格内容，
	  导出为 PNG 长图，用户可以保存到相册或分享到聊天。

	原理：
	  1. 创建离屏 Canvas（type="2d"）
	  2. 逐行绘制表头 + 数据行 + 斑马纹背景
	  3. canvasToTempFilePath 导出为图片文件
	  4. previewImage 预览 / saveImageToPhotosAlbum 保存 / shareFileMessage 分享

	如果需要真正的 PDF：
	  请使用服务端方案 —— 前端把数据 POST 给后端，
	  后端用 pdfmake / puppeteer 生成 PDF，返回下载 URL，
	  前端再用 uni.downloadFile + uni.openDocument 打开。
-->
<template>
	<view class="demo-page">
		<!-- ========== 数据预览 ========== -->
		<view class="section">
			<text class="section-title">数据预览</text>
			<view class="table-wrapper">
				<view class="table-row table-header">
					<text v-for="(h, i) in headers" :key="'h' + i" class="table-cell">{{ h }}</text>
				</view>
				<view v-for="(row, ri) in rows" :key="'r' + ri" class="table-row">
					<text v-for="(cell, ci) in row" :key="'c' + ci" class="table-cell">{{ cell }}</text>
				</view>
			</view>
		</view>

		<!-- ========== 导出按钮 ========== -->
		<view class="section">
			<text class="section-title">导出操作</text>
			<view class="btn-row">
				<text class="btn btn-primary" @click="exportImage">导出为图片（长图）</text>
			</view>
			<view class="btn-row">
				<text class="btn btn-save" @click="saveToAlbum">导出并保存到相册</text>
			</view>
			<view class="btn-row">
				<text class="btn btn-share" @click="shareImage">导出并分享到聊天</text>
			</view>
		</view>

		<!-- ========== 预览区域 ========== -->
		<view v-if="lastImagePath" class="section">
			<text class="section-title">导出结果预览</text>
			<image :src="lastImagePath" mode="widthFix" class="preview-image" @click="previewImage" />
			<text class="file-path">{{ lastImagePath }}</text>
		</view>

		<!-- ========== 离屏 Canvas（不可见，仅用于绘制） ========== -->
		<!--
			canvas-id 必须存在，但通过定位移到屏幕外，
			实际渲染内容在内存中完成。
		-->
		<canvas type="2d" id="exportCanvas" class="offscreen-canvas"></canvas>
	</view>
</template>

<script>
export default {
	data() {
		return {
			headers: ['姓名', '年龄', '部门', '入职日期', '薪资（元）'],
			rows: [
				['张三', '28', '技术部', '2021-03-15', '15000'],
				['李四', '32', '产品部', '2019-08-20', '18000'],
				['王五', '25', '设计部', '2022-01-10', '12000'],
				['赵六', '35', '市场部', '2018-05-01', '20000'],
				['孙七', '29', '技术部', '2020-11-08', '16000'],
			],
			/** 上次导出的图片临时路径 */
			lastImagePath: '',
		};
	},

	methods: {
		// ============================================================
		// 核心绘制逻辑
		// ============================================================

		/**
		 * 在 Canvas 上绘制表格并导出为图片
		 *
		 * 使用微信小程序 Canvas 2D API（type="2d"）。
		 *
		 * 绘制流程：
		 * 1. 计算总高度（表头 + 数据行）
		 * 2. 设置 Canvas 尺寸（使用 dpr 适配高清屏）
		 * 3. 逐行绘制：背景色 → 边框线 → 文字
		 * 4. canvasToTempFilePath 导出 PNG
		 *
		 * @returns Promise<string> 图片临时路径
		 */
		drawTable() {
			return new Promise((resolve, reject) => {
				// ---- 布局参数 ----
				const padding = 20;              // 左右边距（逻辑像素）
				const rowHeight = 44;            // 每行高度
				const headerHeight = 50;         // 表头行高度
				const titleHeight = 60;          // 标题区域高度
				const colCount = this.headers.length;
				const rowCount = this.rows.length;

				// 总高度 = 标题 + 表头 + 数据行 + 底部留白
				const totalHeight = titleHeight + headerHeight + rowCount * rowHeight + padding;

				// 获取 Canvas 2D 实例
				const query = wx.createSelectorQuery();
				query.select('#exportCanvas')
					.fields({ node: true, size: true })
					.exec((res) => {
						if (!res[0] || !res[0].node) {
							reject(new Error('Canvas 节点获取失败'));
							return;
						}

						const canvas = res[0].node;
						const ctx = canvas.getContext('2d');
						const dpr = wx.getWindowInfo().pixelRatio;

						// 设置 Canvas 实际尺寸（物理像素 = 逻辑像素 × dpr）
						const canvasWidth = 375; // 逻辑宽度（iPhone 标准屏宽）
						canvas.width = canvasWidth * dpr;
						canvas.height = totalHeight * dpr;
						ctx.scale(dpr, dpr);

						// ---- 开始绘制 ----

						// 1. 白色背景
						ctx.fillStyle = '#FFFFFF';
						ctx.fillRect(0, 0, canvasWidth, totalHeight);

						// 2. 标题文字
						ctx.fillStyle = '#333333';
						ctx.font = 'bold 18px sans-serif';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillText('员工信息表', canvasWidth / 2, titleHeight / 2);

						// 3. 表格参数
						const tableLeft = padding;
						const tableWidth = canvasWidth - padding * 2;
						const colWidth = tableWidth / colCount;
						let y = titleHeight;

						// 4. 表头行
						ctx.fillStyle = '#4472C4';
						ctx.fillRect(tableLeft, y, tableWidth, headerHeight);

						ctx.strokeStyle = '#3B5998';
						ctx.lineWidth = 0.5;
						ctx.strokeRect(tableLeft, y, tableWidth, headerHeight);

						ctx.fillStyle = '#FFFFFF';
						ctx.font = 'bold 14px sans-serif';
						ctx.textAlign = 'center';
						this.headers.forEach((h, i) => {
							const x = tableLeft + colWidth * i + colWidth / 2;
							ctx.fillText(h, x, y + headerHeight / 2);
						});

						y += headerHeight;

						// 5. 数据行（斑马纹 + 边框）
						this.rows.forEach((row, ri) => {
							// 交替行背景色
							ctx.fillStyle = ri % 2 === 0 ? '#FFFFFF' : '#D9E2F3';
							ctx.fillRect(tableLeft, y, tableWidth, rowHeight);

							// 行边框
							ctx.strokeStyle = '#CCCCCC';
							ctx.lineWidth = 0.5;
							ctx.strokeRect(tableLeft, y, tableWidth, rowHeight);

							// 单元格文字
							ctx.fillStyle = '#333333';
							ctx.font = '14px sans-serif';
							ctx.textAlign = 'center';
							row.forEach((cell, ci) => {
								const x = tableLeft + colWidth * ci + colWidth / 2;
								ctx.fillText(String(cell), x, y + rowHeight / 2);
							});

							y += rowHeight;
						});

						// 6. 底部时间戳
						ctx.fillStyle = '#999999';
						ctx.font = '12px sans-serif';
						ctx.textAlign = 'right';
						ctx.fillText(
							`导出时间：${this.getTimestamp()}`,
							canvasWidth - padding,
							y + padding * 0.8
						);

						// ---- 导出图片 ----
						wx.canvasToTempFilePath({
							canvas: canvas,
							fileType: 'png',
							quality: 1,
							success: (res) => {
								resolve(res.tempFilePath);
							},
							fail: (err) => {
								reject(err);
							},
						});
					});
			});
		},

		// ============================================================
		// 导出操作
		// ============================================================

		/** 导出图片并预览 */
		async exportImage() {
			uni.showLoading({ title: '生成中...' });
			try {
				const path = await this.drawTable();
				this.lastImagePath = path;
				uni.hideLoading();
				uni.showToast({ icon: 'success', title: '导出成功' });
				this.previewImage();
			} catch (e) {
				uni.hideLoading();
				console.error('导出失败:', e);
				uni.showToast({ icon: 'none', title: '导出失败' });
			}
		},

		/** 导出并保存到相册 */
		async saveToAlbum() {
			uni.showLoading({ title: '生成中...' });
			try {
				const tempPath = await this.drawTable();
				this.lastImagePath = tempPath;
				uni.hideLoading();

				uni.saveImageToPhotosAlbum({
					filePath: tempPath,
					success() {
						uni.showToast({ icon: 'success', title: '已保存到相册' });
					},
					fail(err) {
						console.error('保存失败:', err);
						// 用户可能拒绝了相册权限
						if (err.errMsg.includes('auth deny')) {
							uni.showModal({
								content: '请允许相册权限，拒绝将无法保存图片',
								showCancel: false,
							});
						} else {
							uni.showToast({ icon: 'none', title: '保存失败' });
						}
					},
				});
			} catch (e) {
				uni.hideLoading();
				console.error('导出失败:', e);
				uni.showToast({ icon: 'none', title: '导出失败' });
			}
		},

		/** 导出并分享到聊天 */
		async shareImage() {
			uni.showLoading({ title: '生成中...' });
			try {
				const tempPath = await this.drawTable();
				this.lastImagePath = tempPath;
				uni.hideLoading();

				// 分享图片到聊天
				wx.shareImageMessage({
					imagePath: tempPath,
					success() {
						console.log('分享成功');
					},
					fail(err) {
						console.error('分享失败:', err);
						uni.showToast({ icon: 'none', title: '分享功能请在真机上使用' });
					},
				});
			} catch (e) {
				uni.hideLoading();
				console.error('导出失败:', e);
				uni.showToast({ icon: 'none', title: '导出失败' });
			}
		},

		// ============================================================
		// 工具方法
		// ============================================================

		/** 预览图片（全屏查看） */
		previewImage() {
			if (!this.lastImagePath) return;
			uni.previewImage({
				current: this.lastImagePath,
				urls: [this.lastImagePath],
			});
		},

		/** 生成时间戳字符串 */
		getTimestamp() {
			const d = new Date();
			const pad = (n) => String(n).padStart(2, '0');
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
				` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
		},
	},
};
</script>

<style lang="scss" scoped>
.demo-page {
	padding: 24rpx;
	background-color: #f5f5f5;
	min-height: 100vh;
}

.section {
	margin-bottom: 40rpx;
}

.section-title {
	font-size: 28rpx;
	color: #666;
	margin-bottom: 16rpx;
	display: block;
}

/* ========== 数据表格 ========== */
.table-wrapper {
	background-color: #fff;
	border-radius: 12rpx;
	overflow: hidden;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.table-row {
	display: flex;
	border-bottom: 1rpx solid #eee;
}

.table-row:last-child {
	border-bottom: none;
}

.table-header {
	background-color: #4472C4;
}

.table-header .table-cell {
	color: #fff;
	font-weight: bold;
	font-size: 26rpx;
}

.table-cell {
	flex: 1;
	text-align: center;
	padding: 20rpx 12rpx;
	font-size: 26rpx;
	color: #333;
}

/* ========== 按钮 ========== */
.btn-row {
	margin-bottom: 16rpx;
}

.btn {
	display: block;
	text-align: center;
	font-size: 28rpx;
	padding: 24rpx 0;
	border-radius: 12rpx;
}

.btn-primary {
	background-color: #4472C4;
	color: #fff;
}

.btn-save {
	background-color: #FF9800;
	color: #fff;
}

.btn-share {
	background-color: #07C160;
	color: #fff;
}

/* ========== 预览图 ========== */
.preview-image {
	width: 100%;
	border-radius: 12rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.file-path {
	font-size: 22rpx;
	color: #999;
	word-break: break-all;
	margin-top: 12rpx;
	display: block;
}

/* ========== 离屏 Canvas ========== */
/*
 * 移到屏幕外，用户不可见。
 * 不能用 display:none 或 v-if，否则 Canvas 节点不存在，
 * wx.createSelectorQuery 无法获取到节点。
 */
.offscreen-canvas {
	position: fixed;
	left: -9999px;
	top: 0;
	width: 375px;
	height: 600px;
}
</style>
