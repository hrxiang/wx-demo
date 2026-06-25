<template>
	<view class="my-table">
		<!-- 表头 -->
		<view class="table-header" :class="{ 'sticky-header': stickyHeader }">
			<view v-for="(col, columnIndex) in columns" :key="col.key" class="cell" :style="getCellStyle(col, columnIndex)">
				<slot name="headerCell" :column="col" :text="col.title">
					{{ col.title }}
				</slot>
			</view>
		</view>
		<!-- 表体 -->
		<view class="table-body">
			<view v-for="(row, rowIndex) in dataSource" :key="row.id" class="table-row" @click="handleRowClick(row)">
				<view v-for="(col, columnIndex) in columns" :key="col.key" class="cell" :style="getCellStyle(col, columnIndex)">
					<slot name="bodyCell" :record="row" :column="col" :text="row[col.dataIndex || col.key]">
						{{ row[col.dataIndex || col.key] }}
					</slot>
				</view>
			</view>
			<view v-if="!dataSource.length" class="empty-placeholder">暂无数据</view>
		</view>
	</view>
</template>

<script>
	/**
	 * 通用表格组件
	 *
	 * 功能特性：
	 * - 列定义驱动：通过 columns 配置表头、宽度、对齐、颜色、字号、省略号
	 * - 粘性表头：stickyHeader 开启后表头吸附顶部
	 * - 网格线：columnGrid 控制列间竖线，rowGrid 控制行间横线
	 * - 高亮行：rowClick 事件 + 点击行回调
	 * - 自定义渲染：headerCell / bodyCell 插槽支持自定义单元格内容
	 * - 空数据占位：dataSource 为空时显示「暂无数据」
	 */
	export default {
		name: 'my-table',
		emits: ['rowClick'],
		props: {
			/** 列定义数组，每项含 key, title, dataIndex, width, align, ellipsis, fontSize, color */
			columns: {
				type: Array,
				default: () => []
			},
			/** 表格数据源，每项需含 id 字段作为唯一标识 */
			dataSource: {
				type: Array,
				default: () => []
			},
			/** 网格线颜色，默认 #DCDFE6 */
			gridColor: {
				type: String,
				default: '#DCDFE6'
			},
			/** 是否显示列间竖线 */
			columnGrid: {
				type: Boolean,
				default: true
			},
			/** 是否显示行间横线 */
			rowGrid: {
				type: Boolean,
				default: false
			},
			/** 是否启用粘性表头（position: sticky） */
			stickyHeader: {
				type: Boolean,
				default: false
			},
		},
		methods: {
			/**
			 * 根据列配置计算单元格内联样式
			 * @param {object} column 列定义
			 * @param {number} columnIndex 列索引（最后一列不画竖线）
			 * @returns {object} 样式对象
			 */
			getCellStyle(column, columnIndex) {
				const baseStyle = {
					width: column.width ? (typeof column.width === 'number' ? column.width + 'rpx' : column.width) : 'auto',
					flex: column.width ? '0 0 auto' : '1',
					justifyContent: column.align || 'left',
					fontSize: (column.fontSize || 24) + 'rpx',
					lineHeight: (column.fontSize || 24) + 'rpx',
					color: column.color || '#303133',
					borderRight: (this.columnGrid && (columnIndex !== this.columns.length - 1)) ? `1rpx solid ${this.gridColor}` : 'none',
				};

				// 省略号溢出处理
				if (column.ellipsis) {
					return {
						...baseStyle,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						minWidth: 0, // 确保 flex 子项可以收缩，否则 ellipsis 不生效
					};
				}
				return baseStyle;
			},
			/**
			 * 行点击事件，向上 emit rowClick 事件
			 * @param {object} row 点击行的数据
			 */
			handleRowClick(row) {
				this.$emit('rowClick', row);
			},
		},
	};
</script>

<style lang="scss" scoped>
	.table-scroll-x {
		overflow-x: auto;
		width: 100%;
	}

	.my-table {
		display: flex;
		flex-direction: column;
		// width: max-content;
		// min-width: 100%;
		// width: 100%;
		// overflow-x: auto;
	}

	.table-header {
		display: flex;
		align-items: center;
		background-color: #fff;
		/* 确保粘性头有背景 */
		z-index: 10;
		min-height: 60rpx;
	}

	.table-body {}

	.sticky-header {
		position: sticky;
		top: 0;
	}

	.table-row {
		display: flex;
		align-items: center;
		border-bottom: 1rpx solid v-bind(gridColor);
		min-height: 60rpx;
	}

	.cell {
		// padding: 10rpx;
		word-break: break-word;
	}

	.ellipsis {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.empty-placeholder {
		text-align: center;
		padding: 30rpx;
		color: #909399;
	}
</style>