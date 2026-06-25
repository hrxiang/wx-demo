<template>
	<view class="demo-page">
		<view>
			<view style="display: flex; align-items: flex-start;">
				<view style="font-size: 28rpx; line-height: 28rpx; padding-top: 10rpx;">电泵1</view>
				<view style="font-size: 48rpx; line-height: 48rpx;">9999.99</view>
				<view style="font-size: 24rpx; line-height: 24rpx; padding-top: 24rpx;">kWh</view>
			</view>
		</view>
		<!-- Demo 1: 基础示例 —— 3 列，center + bottom 对齐 -->
		<view class="demo-section">
			<view class="demo-title">Demo 1：center + bottom 对齐</view>
			<view class="demo-desc">
				28rpx ↔ 36rpx 居中，36rpx ↔ 24rpx 底部对齐，行高 = 36rpx
			</view>
			<font-align-grid :data="demo1Data" :alignments="['center', 'bottom']"
				:column-align="['left', 'center', 'right']" />
		</view>

		<!-- Demo 2: 不同字号对比 -->
		<view class="demo-section">
			<view class="demo-title">Demo 2：多行不同字号对比</view>
			<view class="demo-desc">
				每行最大字号不同，对齐规则相同
			</view>
			<font-align-grid :data="demo2Data" :alignments="['center', 'bottom']"
				:column-align="['left', 'center', 'right']" />
		</view>

		<!-- Demo 3: 全部居中对齐 -->
		<view class="demo-section">
			<view class="demo-title">Demo 3：全部 center 对齐</view>
			<view class="demo-desc">
				相邻列之间全部居中对齐
			</view>
			<font-align-grid :data="demo3Data" :alignments="['center', 'center']"
				:column-align="['left', 'center', 'right']" />
		</view>

		<!-- Demo 4: 全部顶部对齐 -->
		<view class="demo-section">
			<view class="demo-title">Demo 4：全部 top 对齐</view>
			<view class="demo-desc">
				相邻列之间全部顶部对齐
			</view>
			<font-align-grid :data="demo4Data" :alignments="['top', 'top']"
				:column-align="['left', 'center', 'right']" />
		</view>

		<!-- Demo 5: 全部底部对齐 -->
		<view class="demo-section">
			<view class="demo-title">Demo 5：全部 bottom 对齐</view>
			<view class="demo-desc">
				相邻列之间全部底部对齐
			</view>
			<font-align-grid :data="demo5Data" :alignments="['bottom', 'bottom']"
				:column-align="['left', 'center', 'right']" />
		</view>

		<!-- Demo 6: 4 列混合对齐 -->
		<view class="demo-section">
			<view class="demo-title">Demo 6：4 列混合对齐</view>
			<view class="demo-desc">
				center → bottom → top，3 条对齐规则
			</view>
			<font-align-grid :data="demo6Data" :alignments="['center', 'bottom', 'top']"
				:column-align="['left', 'left', 'center', 'right']" />
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				/** Demo 1: 28/36/24 字号，center + bottom 对齐 */
				demo1Data: [
					[{
							text: '项目名称',
							fontSize: 28
						},
						{
							text: '详细描',
							fontSize: 36
						},
						{
							text: '备注',
							fontSize: 24
						},
					],
					[{
							text: '工程A',
							fontSize: 28
						},
						{
							text: '主体结',
							fontSize: 36
						},
						{
							text: '进行中',
							fontSize: 24
						},
					],
					[{
							text: '工程B',
							fontSize: 28
						},
						{
							text: '验收交付',
							fontSize: 36
						},
						{
							text: '已完成',
							fontSize: 24
						},
					],
				],
				/** Demo 2: 每行字号不同，测试对齐规则在不同行号下的表现 */
				demo2Data: [
					[{
							text: '第一列A',
							fontSize: 20
						},
						{
							text: '最大',
							fontSize: 40
						},
						{
							text: '第三列C',
							fontSize: 16
						},
					],
					[{
							text: '最大',
							fontSize: 44
						},
						{
							text: '第二列B',
							fontSize: 32
						},
						{
							text: '第三列C',
							fontSize: 20
						},
					],
					[{
							text: '第一列A',
							fontSize: 24
						},
						{
							text: '第二列B',
							fontSize: 28
						},
						{
							text: '最大',
							fontSize: 48
						},
					],
				],
				/** Demo 3: 全部 center */
				demo3Data: [
					[{
							text: '姓名',
							fontSize: 24
						},
						{
							text: '岗位名称',
							fontSize: 32
						},
						{
							text: '部门',
							fontSize: 20
						},
					],
					[{
							text: '张三',
							fontSize: 24
						},
						{
							text: '高级前端工程师',
							fontSize: 32
						},
						{
							text: '技术部',
							fontSize: 20
						},
					],
				],
				/** Demo 4: 全部 top */
				demo4Data: [
					[{
							text: '编号',
							fontSize: 20
						},
						{
							text: '产品名称描述',
							fontSize: 36
						},
						{
							text: '数量',
							fontSize: 24
						},
					],
					[{
							text: '001',
							fontSize: 20
						},
						{
							text: '高性能混凝土外加剂',
							fontSize: 36
						},
						{
							text: '500吨',
							fontSize: 24
						},
					],
				],
				/** Demo 5: 全部 bottom */
				demo5Data: [
					[{
							text: '日期',
							fontSize: 20
						},
						{
							text: '会议议题',
							fontSize: 34
						},
						{
							text: '状态',
							fontSize: 22
						},
					],
					[{
							text: '2024-06-15',
							fontSize: 20
						},
						{
							text: '年度安全生产总结',
							fontSize: 34
						},
						{
							text: '待审批',
							fontSize: 22
						},
					],
				],
				/** Demo 6: 4 列混合 */
				demo6Data: [
					[{
							text: '序号',
							fontSize: 20
						},
						{
							text: '材料名称',
							fontSize: 32
						},
						{
							text: '规格型号',
							fontSize: 28
						},
						{
							text: '单价(元)',
							fontSize: 24
						},
					],
					[{
							text: '1',
							fontSize: 20
						},
						{
							text: '螺纹钢HRB400',
							fontSize: 32
						},
						{
							text: 'Φ25×12m',
							fontSize: 28
						},
						{
							text: '3850',
							fontSize: 24
						},
					],
					[{
							text: '2',
							fontSize: 20
						},
						{
							text: '商品混凝土C30',
							fontSize: 32
						},
						{
							text: '泵送',
							fontSize: 28
						},
						{
							text: '420',
							fontSize: 24
						},
					],
				],
			};
		},
	};
</script>

<style lang="scss" scoped>
	.demo-page {
		padding: 20rpx;
		background-color: #f5f5f5;
		min-height: 100vh;
	}

	.demo-section {
		background: #fff;
		border-radius: 12rpx;
		margin-bottom: 30rpx;
		padding: 20rpx;
		overflow: hidden;
	}

	.demo-title {
		font-size: 30rpx;
		font-weight: bold;
		color: #303133;
		margin-bottom: 8rpx;
	}

	.demo-desc {
		font-size: 24rpx;
		color: #909399;
		margin-bottom: 16rpx;
	}
</style>