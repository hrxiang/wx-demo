<template>
	<view style="background-color: yellowgreen;">
		<my-table :columns="columns" :dataSource="dataSource" :stickyHeader="true"></my-table>
	</view>
</template>

<script setup>
	const columns = [{
			key: 'name',
			dataIndex: 'name',
			title: '姓名',
			ellipsis: true
		},
		{
			key: 'age',
			dataIndex: 'age',
			title: '年龄'
		},
		{
			key: 'sex',
			dataIndex: 'sex',
			title: '性别'
		},
	];
	const dataSource = [{
			id: 0,
			name: '张三张三张三张三张三张三张三张三张三张三张三张三张三张三张三',
			age: 19,
			sex: '男'
		},
		{
			id: 1,
			name: '李四',
			age: 22,
			sex: '男'
		},
		{
			id: 2,
			name: '王五',
			age: 20,
			sex: '男'
		},
	];
</script>

<style lang="scss" scoped>

</style>