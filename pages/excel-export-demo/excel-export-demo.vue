<!--
	Excel 导出 Demo
	==================
	演示在微信小程序中纯客户端导出 Excel 文件，无需任何第三方库。

	原理：Excel 能直接打开 HTML 表格格式的 .xls 文件。
	将数据拼接为 HTML <table> 字符串 → 写入 .xls 文件 → 打开/分享。

	使用的微信 API（项目中已有使用先例）：
	- wx.env.USER_DATA_PATH          获取用户数据目录
	- wx.getFileSystemManager()      获取文件管理器
	- FileSystemManager.writeFile()  写入文件
	- uni.openDocument()             用系统查看器打开文件
	- wx.shareFileMessage()          分享文件到聊天

	注意：openDocument 仅在真机上有效，开发者工具中可能不支持。
-->
<template>
	<view class="demo-page">
		<!-- ========== 数据预览 ========== -->
		<view class="section">
			<text class="section-title">数据预览</text>
			<view class="table-wrapper">
				<!-- 表头 -->
				<view class="table-row table-header">
					<text v-for="(h, i) in headers" :key="'h' + i" class="table-cell">{{ h }}</text>
				</view>
				<!-- 数据行 -->
				<view v-for="(row, ri) in rows" :key="'r' + ri" class="table-row">
					<text v-for="(cell, ci) in row" :key="'c' + ci" class="table-cell">{{ cell }}</text>
				</view>
			</view>
		</view>

		<!-- ========== 导出按钮 ========== -->
		<view class="section">
			<text class="section-title">导出操作</text>
			<view class="btn-row">
				<text class="btn btn-primary" @click="exportExcel">导出 Excel (.xls)</text>
			</view>
			<view class="btn-row">
				<text class="btn btn-secondary" @click="exportCSV">导出 CSV</text>
			</view>
			<view class="btn-row">
				<text class="btn btn-share" @click="shareExcel">分享 Excel 到聊天</text>
			</view>
		</view>

		<!-- ========== 结果提示 ========== -->
		<view v-if="lastFilePath" class="section">
			<text class="section-title">上次导出</text>
			<text class="file-path">{{ lastFilePath }}</text>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			/** 表头 */
			headers: ['姓名', '年龄', '部门', '入职日期', '薪资（元）'],
			/** 数据行 */
			rows: [
				['张三', '28', '技术部', '2021-03-15', '15000'],
				['李四', '32', '产品部', '2019-08-20', '18000'],
				['王五', '25', '设计部', '2022-01-10', '12000'],
				['赵六', '35', '市场部', '2018-05-01', '20000'],
				['孙七', '29', '技术部', '2020-11-08', '16000'],
			],
			/** 上次导出的文件路径 */
			lastFilePath: '',
		};
	},

	methods: {
		// ============================================================
		// HTML 表格构建
		// ============================================================

		/**
		 * 将 headers + rows 拼接为 Excel 兼容的 HTML 表格字符串
		 *
		 * Excel 能识别 HTML <table> 结构，并支持内联 CSS 样式。
		 * 将此 HTML 字符串保存为 .xls 后缀，Excel 可直接打开。
		 *
		 * 关键技巧：
		 * - mso-number-format: 数字格式化（Excel 专用 CSS 属性）
		 * - style="vnd.ms-excel.numberformat": 日期格式化
		 *
		 * @returns 完整的 HTML 文档字符串
		 */
		buildHtmlTable() {
			// 表头行（蓝色背景，白色粗体文字）
			let html = '';
			html += '<html xmlns:o="urn:schemas-microsoft-com:office:office"';
			html += ' xmlns:x="urn:schemas-microsoft-com:office:excel"';
			html += ' xmlns="http://www.w3.org/TR/REC-html40">';
			html += '<head><meta charset="UTF-8"></head><body>';
			html += '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;">';

			// 表头
			html += '<tr style="background-color:#4472C4;color:#FFFFFF;font-weight:bold;text-align:center;">';
			this.headers.forEach(h => {
				html += `<td>${h}</td>`;
			});
			html += '</tr>';

			// 数据行
			this.rows.forEach((row, ri) => {
				// 交替行背景色（斑马纹）
				const bg = ri % 2 === 0 ? '#FFFFFF' : '#D9E2F3';
				html += `<tr style="background-color:${bg};text-align:center;">`;
				row.forEach((cell, ci) => {
					// 薪资列（最后一列）：Excel 数字格式，保留两位小数
					if (ci === row.length - 1) {
						html += `<td style="mso-number-format:'0.00';">${cell}</td>`;
					} else {
						html += `<td>${cell}</td>`;
					}
				});
				html += '</tr>';
			});

			html += '</table></body></html>';
			return html;
		},

		/**
		 * 将 headers + rows 拼接为 CSV 字符串
		 *
		 * CSV 格式规则：
		 * - 字段间用逗号分隔
		 * - 含逗号或引号的字段用双引号包裹
		 * - 字段内的双引号需转义为两个双引号
		 * - 需添加 BOM（\uFEFF）确保 Excel 正确识别 UTF-8 编码
		 *
		 * @returns CSV 字符串（含 BOM 头）
		 */
		buildCSV() {
			const escape = (val) => {
				const str = String(val);
				if (str.includes(',') || str.includes('"') || str.includes('\n')) {
					return `"${str.replace(/"/g, '""')}"`;
				}
				return str;
			};

			let csv = '\uFEFF'; // UTF-8 BOM，防止中文乱码
			csv += this.headers.map(escape).join(',') + '\n';
			this.rows.forEach(row => {
				csv += row.map(escape).join(',') + '\n';
			});
			return csv;
		},

		// ============================================================
		// 文件写入（Promise 封装）
		// ============================================================

		/**
		 * 将字符串内容写入文件
		 *
		 * 封装 FileSystemManager.writeFile() 为 Promise。
		 * 使用 wx.env.USER_DATA_PATH 作为文件存储目录。
		 *
		 * @param fileName 文件名（含扩展名），如 'export.xls'
		 * @param content  文件内容字符串
		 * @returns 文件绝对路径
		 */
		writeFile(fileName, content) {
			return new Promise((resolve, reject) => {
				const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
				const fs = wx.getFileSystemManager();

				fs.writeFile({
					filePath: filePath,
					data: content,
					encoding: 'utf-8',
					success: () => {
						resolve(filePath);
					},
					fail: (err) => {
						reject(err);
					},
				});
			});
		},

		// ============================================================
		// 导出操作
		// ============================================================

		/** 导出为 Excel（HTML 表格格式的 .xls 文件） */
		async exportExcel() {
			uni.showLoading({ title: '生成中...' });

			try {
				const html = this.buildHtmlTable();
				const fileName = `员工信息_${this.getTimestamp()}.xls`;
				const filePath = await this.writeFile(fileName, html);

				this.lastFilePath = filePath;
				uni.hideLoading();
				uni.showToast({ icon: 'success', title: '导出成功' });

				// 尝试用系统查看器打开（仅真机有效）
				this.openDocument(filePath);
			} catch (e) {
				uni.hideLoading();
				console.error('Excel 导出失败:', e);
				uni.showToast({ icon: 'none', title: '导出失败' });
			}
		},

		/** 导出为 CSV 文件 */
		async exportCSV() {
			uni.showLoading({ title: '生成中...' });

			try {
				const csv = this.buildCSV();
				const fileName = `员工信息_${this.getTimestamp()}.csv`;
				const filePath = await this.writeFile(fileName, csv);

				this.lastFilePath = filePath;
				uni.hideLoading();
				uni.showToast({ icon: 'success', title: '导出成功' });

				this.openDocument(filePath);
			} catch (e) {
				uni.hideLoading();
				console.error('CSV 导出失败:', e);
				uni.showToast({ icon: 'none', title: '导出失败' });
			}
		},

		/** 导出 Excel 并通过微信聊天分享 */
		async shareExcel() {
			uni.showLoading({ title: '生成中...' });

			try {
				const html = this.buildHtmlTable();
				const fileName = `员工信息_${this.getTimestamp()}.xls`;
				const filePath = await this.writeFile(fileName, html);

				this.lastFilePath = filePath;
				uni.hideLoading();

				// 调起微信分享面板（仅真机有效）
				wx.shareFileMessage({
					filePath: filePath,
					fileName: fileName,
					success() {
						console.log('分享成功');
					},
					fail(err) {
						console.error('分享失败:', err);
						// 开发者工具中不支持，提示用户
						uni.showToast({ icon: 'none', title: '分享功能请在真机上使用' });
					},
				});
			} catch (e) {
				uni.hideLoading();
				console.error('生成文件失败:', e);
				uni.showToast({ icon: 'none', title: '生成失败' });
			}
		},

		// ============================================================
		// 工具方法
		// ============================================================

		/**
		 * 用系统查看器打开文件
		 *
		 * fileType 取值：doc, docx, xls, xlsx, ppt, pptx, pdf
		 *
		 * 注意：openDocument 仅在真机上有效。
		 * 开发者工具中调用会走 fail 回调，此处静默处理。
		 */
		openDocument(filePath) {
			uni.openDocument({
				filePath: filePath,
				showMenu: true,
				fileType: 'xls',
				success() {
					console.log('文件已打开');
				},
				fail(err) {
					console.warn('打开文件失败（开发者工具不支持，请在真机上测试）:', err);
				},
			});
		},

		/** 生成时间戳字符串，用于文件名，如 20260715_143025 */
		getTimestamp() {
			const d = new Date();
			const pad = (n) => String(n).padStart(2, '0');
			return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
				`_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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

.btn-secondary {
	background-color: #fff;
	color: #4472C4;
	border: 1rpx solid #4472C4;
}

.btn-share {
	background-color: #07C160;
	color: #fff;
}

/* ========== 文件路径显示 ========== */
.file-path {
	font-size: 22rpx;
	color: #999;
	word-break: break-all;
	background-color: #fff;
	padding: 16rpx;
	border-radius: 8rpx;
}
</style>
