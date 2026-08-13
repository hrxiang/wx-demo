<template>
	<view class="page-container">
		<view class="title">自定义气泡与实时指示线追踪示例</view>

		<!-- 图表主容器 -->
		<view class="chart-box">
			<!-- 1. ECharts 组件 -->
			<l-echart ref="chartRef" @finished="init"></l-echart>

			<!-- 2. 自定义 Vue 原生气泡 -->
			<view v-if="tooltip.visible" class="custom-tooltip"
				:style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
				<view class="tooltip-header">{{ tooltip.date }}</view>
				<view class="tooltip-body">
					<view v-for="(item, index) in tooltip.values" :key="index" class="tooltip-item">
						<text class="dot" :style="{ backgroundColor: item.color || '#1890ff' }"></text>
						<text class="name">{{ item.seriesName }}：</text>
						<text class="val">{{ item.value }}</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	const echarts = require('../../static/echarts.min');

	let chartInstance = null;

	export default {
		data() {
			return {
				tooltip: {
					visible: false,
					x: 0,
					y: 0,
					date: '',
					values: []
				},
				rawSeriesA: [],
				rawSeriesB: [],

				// ECharts 配置
				option: {
					grid: {
						top: '15%',
						left: '10%',
						right: '8%',
						bottom: '18%'
					},
					// ------------------------------------------------------------------
					// 核心修复 1：彻底关闭内部 Tooltip 模块！从源头消除 TooltipView.getSize 报错
					// ------------------------------------------------------------------
					tooltip: {
						show: false
					},
					dataZoom: [{
						type: 'inside',
						start: 0,
						end: 40
					}],
					xAxis: {
						type: 'time',
						boundaryGap: false,
						axisLine: {
							lineStyle: {
								color: '#999'
							}
						},
						// ------------------------------------------------------------------
						// 核心修复 2：将指示线 (axisPointer) 直接挂在 xAxis 上！
						// 这样不需要开启 tooltip，长按拖拽也能自动绘制红色虚线
						// ------------------------------------------------------------------
						axisPointer: {
							show: true,
							type: 'line',
							snap: true, // 自动吸附到最近的数据点
							lineStyle: {
								color: '#FF4D4F',
								width: 1,
								type: 'dashed'
							},
							label: {
								show: false // 隐藏 X 轴底部默认的时间黑框标签
							}
						}
					},
					yAxis: {
						type: 'value',
						axisLine: {
							show: false
						},
						splitLine: {
							lineStyle: {
								color: '#eee'
							}
						}
					},
					series: []
				}
			};
		},
		methods: {
			generateMockData() {
				const seriesA = [];
				const seriesB = [];

				let baseTime = new Date('2026-01-01T00:00:00').getTime();
				const oneDay = 24 * 3600 * 1000;

				let valA = 50;
				let valB = 80;

				for (let i = 0; i < 200; i++) {
					valA += Math.floor(Math.random() * 11) - 5;
					valB += Math.floor(Math.random() * 13) - 6;

					seriesA.push([baseTime, Math.max(10, valA)]);
					seriesB.push([baseTime, Math.max(10, valB)]);

					baseTime += oneDay;
				}

				this.rawSeriesA = seriesA;
				this.rawSeriesB = seriesB;

				return [{
						name: '核心指标 A',
						type: 'line',
						showSymbol: false,
						smooth: true,
						itemStyle: {
							color: '#1890FF'
						},
						data: seriesA
					},
					{
						name: '次要指标 B',
						type: 'line',
						showSymbol: false,
						smooth: true,
						itemStyle: {
							color: '#52C41A'
						},
						data: seriesB
					}
				];
			},

			// 根据指示线位置更新自定义气泡
			updateCustomTooltip(event) {
				if (!event || !chartInstance) return;

				const axisInfo = event.axesInfo && event.axesInfo[0];
				if (!axisInfo || axisInfo.value === undefined) {
					return;
				}

				const targetTimestamp = axisInfo.value;

				// 匹配当前时间戳对应的数据点
				const dataIndex = this.rawSeriesA.findIndex(item => item[0] === targetTimestamp);
				if (dataIndex === -1) return;

				const itemA = this.rawSeriesA[dataIndex];
				const itemB = this.rawSeriesB[dataIndex];

				// 计算在 Canvas 上的物理像素坐标
				const pixelCoord = chartInstance.convertToPixel({
					gridIndex: 0
				}, [targetTimestamp, itemA[1]]);

				if (!pixelCoord) return;

				const [posX] = pixelCoord;

				const date = new Date(targetTimestamp);
				const dateStr =
					`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

				this.tooltip = {
					visible: true,
					x: posX,
					y: 20, // 顶部固定显示
					date: dateStr,
					values: [{
							seriesName: '核心指标 A',
							value: itemA[1],
							color: '#1890FF'
						},
						{
							seriesName: '次要指标 B',
							value: itemB[1],
							color: '#52C41A'
						}
					]
				};
			},

			async init() {
				this.option.series = this.generateMockData();

				chartInstance = await this.$refs.chartRef.init(echarts);
				chartInstance.setOption(this.option);

				// 监听指示线移动事件更新 Vue 气泡
				chartInstance.on('updateAxisPointer', (event) => {
					this.updateCustomTooltip(event);
				});

				// 手势划出/离开时隐匿气泡
				chartInstance.getZr().on('globalout', () => {
					this.tooltip.visible = false;
				});
			}
		}
	};
</script>

<style scoped>
	.page-container {
		padding: 16px;
		background-color: #f8f9fa;
		min-height: 100vh;
	}

	.title {
		font-size: 15px;
		font-weight: bold;
		color: #333;
		margin-bottom: 12px;
	}

	.chart-box {
		position: relative;
		width: 100%;
		height: 380px;
		background-color: #ffffff;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		overflow: hidden;
	}

	/* 自定义 View 气泡样式 */
	.custom-tooltip {
		position: absolute;
		z-index: 99;
		padding: 8px 12px;
		background: rgba(30, 30, 30, 0.88);
		backdrop-filter: blur(4px);
		color: #ffffff;
		border-radius: 6px;
		font-size: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

		/* 穿透触摸手势 */
		pointer-events: none;

		/* 居中挂载 */
		transform: translateX(-50%);

		white-space: nowrap;
		transition: left 0.02s linear;
	}

	.tooltip-header {
		font-size: 11px;
		color: #ccc;
		margin-bottom: 4px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		padding-bottom: 3px;
	}

	.tooltip-body {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.tooltip-item {
		display: flex;
		align-items: center;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		margin-right: 6px;
	}

	.name {
		color: #ddd;
	}

	.val {
		font-weight: bold;
		color: #fff;
	}
</style>