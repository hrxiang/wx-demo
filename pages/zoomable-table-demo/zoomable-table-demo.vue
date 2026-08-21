<!--
	可缩放表格 Demo
	================
	演示 zoom-table 组件的使用方式。
	传入 columns 和 data 即可实现：
	- 手势双指缩放 / 加减号按钮缩放
	- 水平 + 垂直滚动
	- 冻结表头 + 冻结首列
-->
<template>
	<view class="demo-page">
		<zoom-table :columns="columns" :data="dataRows" :cell-style="cellStyle">
			<template #ztTop>
				<view>左右滑动查看更多列.右下角-/+缩放</view>
			</template>
			<template #ztBottom>
				<view style="height: 100rpx; background: yellow;"></view>
			</template>
		</zoom-table>
	</view>
</template>

<script>
	/**
	 * 列定义
	 *
	 * key:   对应 data 中的字段名
	 * title: 表头显示文字
	 * width: 列基础宽度（rpx），实际渲染时随缩放比例调整
	 * align: 可选，列对齐方式 'left' | 'center' | 'right'（默认 center）
	 */
	const COLUMNS = [{
			key: 'id',
			title: '序号',
			width: 120
		},
		{
			key: 'name',
			title: '姓名',
			width: 180
		},
		{
			key: 'dept',
			title: '部门',
			width: 200
		},
		{
			key: 'position',
			title: '职位',
			width: 220
		},
		{
			key: 'age',
			title: '年龄',
			width: 120
		},
		{
			key: 'entryDate',
			title: '入职日期',
			width: 220
		},
		{
			key: 'salary',
			title: '薪资(元)',
			width: 200,
			align: 'right' // 数字列右对齐，个十百千万对齐易读
		},
		{
			key: 'phone',
			title: '联系电话',
			width: 260
		},
		{
			key: 'email',
			title: '邮箱',
			width: 360,
			align: 'left' // 长文本列左对齐
		},
		{
			key: 'address',
			title: '住址',
			width: 400
		},
		{
			key: 'education',
			title: '学历',
			width: 160
		},
		{
			key: 'status',
			title: '状态',
			width: 160
		},
	];

	/**
	 * 生成 40 行示例数据
	 */
	function generateData(n) {
		const surnames = ['张', '李', '王', '赵', '孙', '周', '吴', '郑', '刘', '陈', '杨', '黄'];
		const names = ['三', '四', '五', '六', '明', '华', '强', '伟', '芳', '娜', '敏', '静'];
		const depts = ['技术部', '产品部', '设计部', '市场部', '运营部', '财务部', '人事部'];
		const positions = ['工程师', '经理', '专员', '总监', '主管', '实习生', '架构师'];
		const eds = ['本科', '硕士', '博士', '大专'];
		const sts = ['在职', '试用期', '离职'];
		const pick = (a) => a[Math.floor(Math.random() * a.length)];

		return Array.from({
			length: n
		}, (_, i) => {
			const y = 2015 + Math.floor(Math.random() * 10);
			const m = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
			const d = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
			return {
				id: i + 1,
				name: pick(surnames) + pick(names),
				dept: pick(depts),
				position: pick(positions),
				age: 22 + Math.floor(Math.random() * 20),
				entryDate: `${y}-${m}-${d}`,
				salary: (8000 + Math.floor(Math.random() * 25000)).toLocaleString(),
				phone: `138${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
				email: `user${i + 1}@example.com`,
				address: `某某市某某区某某街道${Math.floor(Math.random() * 200)}号`,
				education: pick(eds),
				status: pick(sts),
			};
		});
	}

	export default {

		data() {
			return {
				columns: COLUMNS,
				dataRows: generateData(40),
			};
		},
		methods: {
			/**
			 * 单元格样式钩子：按入参维度返回，行/列/单元格/表头样式统一入口
			 * row === undefined 时为表头调用
			 */
			cellStyle(row, col, rowIndex, colIndex) {
				console.log('cellStyle', row, col, rowIndex, colIndex);
				// 表头：黄底定制高 + 红色边框
				if (row === undefined) {
					return {
						background: 'yellow',
						height: 100,
						borderBottom: '1rpx solid red',
						borderRight: '1rpx solid red',
					};
				}
				// 行：第 0 行高亮加高
				if (rowIndex === 0) {
					return {
						background: 'red',
						color: '#fff',
						height: 150,
					};
				}
				// 行：状态为离职的行灰底
				if(row.status === '离职'){
					return {
						background: 'gray',
					};
				}
				// 列：薪资列数字标红（按 col.key 判断，不受列顺序调整影响）
				if (col.key === 'salary') {
					return {
						color: '#e53935',
					};
				}
				return null;
			}
		}
	};
</script>

<style lang="scss" scoped>
	.demo-page {
		height: 100vh;
		background: #f0f2f5;
	}
</style>