<template>
	<view class="font-align-grid">
		<view v-for="(row, rowIndex) in data" :key="rowIndex" class="grid-row">
			<view v-for="(cell, colIndex) in row" :key="colIndex"
				class="grid-cell"
				:style="getCellStyle(rowIndex, colIndex)">
				<text class="cell-text">{{ cell.text }}</text>
			</view>
		</view>
	</view>
</template>

<script>
	/** 默认字号（rpx），当 cell 未指定 fontSize 时使用 */
	const DEFAULT_FONT_SIZE = 24;

	export default {
		name: 'font-align-grid',
		props: {
			/**
			 * 表格数据，二维数组
			 * 外层数组表示行，内层数组表示列，每项为 { text: string, fontSize?: number }
			 *
			 * 示例：
			 * [
			 *   [{ text: '名称', fontSize: 28 }, { text: '描述', fontSize: 36 }, { text: '备注', fontSize: 24 }],
			 *   [{ text: '张三', fontSize: 30 }, { text: '工程师', fontSize: 24 }, { text: '在职', fontSize: 20 }],
			 * ]
			 */
			data: {
				type: Array,
				default: () => [],
			},
			/**
			 * 相邻列之间的垂直对齐方式，长度 = 列数 - 1
			 * 可选值：'top'（顶部对齐）、'center'（居中对齐）、'bottom'（底部对齐）
			 *
			 * 对齐逻辑：
			 *   - 每行以字号最大的单元格为基准（行高 = 最大字号）
			 *   - 其他单元格按其与基准列之间的对齐规则计算垂直偏移
			 *   - 例：alignments = ['center', 'bottom'] 表示：
			 *     第 1 列与第 2 列居中对齐，第 2 列与第 3 列底部对齐
			 *
			 * 示例：
			 *   3 列，字号分别为 28 | 36 | 24，alignments = ['center', 'bottom']
			 *   → 基准是第 2 列（36rpx），行高 = 36rpx
			 *   → 第 1 列（28rpx）相对于基准居中，顶部留白 (36-28)/2 = 4rpx
			 *   → 第 3 列（24rpx）相对于基准底部对齐，顶部留白 36-24 = 12rpx
			 */
			alignments: {
				type: Array,
				default: () => [],
			},
			/**
			 * 每列的水平对齐方式，长度 = 列数
			 * 可选值：'left'、'center'、'right'
			 */
			columnAlign: {
				type: Array,
				default: () => [],
			},
		},
		methods: {
			/**
			 * 计算指定单元格的内联样式
			 * @param {number} rowIndex 行索引
			 * @param {number} colIndex 列索引
			 * @returns {object} 样式对象
			 */
			getCellStyle(rowIndex, colIndex) {
				const row = this.data[rowIndex];
				const cell = row[colIndex];
				const fontSize = cell.fontSize || DEFAULT_FONT_SIZE;

				// 计算当前行最大字号
				const maxFontSize = Math.max(...row.map(c => c.fontSize || DEFAULT_FONT_SIZE));

				// 找到字号最大的列（有多个时取第一个）
				const tallestColIndex = row.findIndex(c => (c.fontSize || DEFAULT_FONT_SIZE) === maxFontSize);

				// 确定垂直对齐规则
				let alignment = 'top';
				if (colIndex === tallestColIndex) {
					// 当前列就是基准列，顶对齐（无额外留白）
					alignment = 'top';
				} else if (colIndex < tallestColIndex) {
					// 在当前列右侧的对齐规则
					alignment = this.alignments[colIndex] || 'top';
				} else {
					// 在当前列左侧的对齐规则
					alignment = this.alignments[colIndex - 1] || 'top';
				}

				// 根据对齐方式计算顶部留白
				let paddingTop = 0;
				if (alignment === 'center') {
					paddingTop = (maxFontSize - fontSize) / 2;
				} else if (alignment === 'bottom') {
					paddingTop = maxFontSize - fontSize;
				}
				// 'top' 时 paddingTop = 0（默认）

				return {
					width: ((1 / row.length) * 100) + '%',
					fontSize: fontSize + 'rpx',
					lineHeight: fontSize + 'rpx',
					paddingTop: paddingTop + 'rpx',
					textAlign: this.columnAlign[colIndex] || 'left',
				};
			},
		},
	};
</script>

<style lang="scss" scoped>
	.font-align-grid {
		width: 100%;
	}

	.grid-row {
		display: flex;
		align-items: flex-start;
		border-bottom: 1rpx solid #eee;
		min-height: 60rpx;
	}

	.grid-cell {
		box-sizing: border-box;
		padding: 8rpx 12rpx;
		overflow: hidden;
	}

	.cell-text {
		word-break: break-all;
	}
</style>