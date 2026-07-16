<!--
	走马灯组件 Demo
	==================
	演示 marquee-ticker 组件的四种方向模式、自定义样式和手动控制。
-->
<template>
	<view class="demo-page">
		<!-- ========== 示例 1：垂直向上（默认） ========== -->
		<view class="section">
			<text class="section-title">1. 垂直向上（默认） · 3 秒切换</text>
			<view class="demo-box">
				<marquee-ticker :list="verticalList" />
			</view>
		</view>

		<!-- ========== 示例 2：垂直向下 ========== -->
		<view class="section">
			<text class="section-title">2. 垂直向下 · 4 秒切换</text>
			<view class="demo-box">
				<marquee-ticker :list="verticalList" direction="vertical-reverse" :interval="4000" />
			</view>
		</view>

		<!-- ========== 示例 3：水平向左 ========== -->
		<view class="section">
			<text class="section-title">3. 水平向左 · 2.5 秒切换</text>
			<view class="demo-box">
				<marquee-ticker :list="horizontalList" direction="horizontal" :interval="2500" />
			</view>
		</view>

		<!-- ========== 示例 4：水平向右 ========== -->
		<view class="section">
			<text class="section-title">4. 水平向右 · 3 秒切换</text>
			<view class="demo-box">
				<marquee-ticker :list="horizontalList" direction="horizontal-reverse" />
			</view>
		</view>

		<!-- ========== 示例 5：自定义 item 样式 ========== -->
		<view class="section">
			<text class="section-title">5. 自定义样式（使用 item slot）</text>
			<view class="demo-box demo-box-custom">
				<marquee-ticker :list="customList" :interval="3000" :height="100" :duration="600">
					<template v-slot:item="{ item }">
						<view class="custom-item">
							<view class="custom-icon" :style="{ backgroundColor: item.iconColor }">
								<text class="icon-text">{{ item.icon }}</text>
							</view>
							<view class="custom-info">
								<text class="custom-title">{{ item.title }}</text>
								<text class="custom-desc">{{ item.desc }}</text>
							</view>
						</view>
					</template>
				</marquee-ticker>
			</view>
		</view>

		<!-- ========== 示例 6：手动控制 ========== -->
		<view class="section">
			<text class="section-title">6. 手动控制（暂停 / 继续）</text>
			<view class="demo-box">
				<marquee-ticker ref="manualTicker" :list="manualList" :autoPlay="false" />
			</view>
			<view class="btn-row">
				<text class="ctrl-btn" @click="startManual">▶ 开始</text>
				<text class="ctrl-btn ctrl-btn-stop" @click="stopManual">⏸ 暂停</text>
			</view>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			// --- 垂直示例：5 条通知循环显示 ---
			verticalList: [
				'【系统通知】明天下午 3 点全员会议，请准时参加。',
				'【公告】本周五团建活动，地点：羽毛球馆。',
				'【提醒】项目周报请于今天 18:00 前提交。',
				'【通知】新版本已发布到测试环境，请帮忙验证。',
				'【紧急】服务器 CPU 使用率超过 90%，请及时处理。'
			],

			// --- 水平示例：广告/公告轮播 ---
			horizontalList: [
				'🔥 新品上架：春季限定套餐 9.9 元起',
				'🎉 满 100 减 30，限时优惠进行中！',
				'📦 全场包邮，下单即发，次日到达',
				'💡 邀请好友注册，双方各得 10 元红包'
			],

			// --- 自定义样式示例（对象数组） ---
			customList: [
				{ icon: '急', iconColor: '#FF6B6B', title: '紧急任务', desc: '服务器 CPU 报警，请尽快处理' },
				{ icon: '会', iconColor: '#45B7D1', title: '会议通知', desc: '下午 3 点需求评审，准时参加' },
				{ icon: '新', iconColor: '#4ECDC4', title: '版本发布', desc: 'v2.3.0 已上线，请查看更新日志' },
				{ icon: '评', iconColor: '#F7DC6F', title: '代码评审', desc: '张三提交了 PR，等待你的 Review' }
			],

			// --- 手动控制示例 ---
			manualList: [
				'点击「开始」按钮启动轮播 →',
				'当前为手动模式，不会自动切换。',
				'点击「暂停」按钮可随时停止。'
			]
		};
	},

	methods: {
		startManual() {
			if (this.$refs.manualTicker) {
				this.$refs.manualTicker.start();
			}
		},
		stopManual() {
			if (this.$refs.manualTicker) {
				this.$refs.manualTicker.stop();
			}
		}
	}
};
</script>

<style lang="scss" scoped>
.demo-page {
	padding: 24rpx;
	background-color: #f5f5f5;
	min-height: 100vh;
}

/* 每个示例区块 */
.section {
	margin-bottom: 40rpx;
}

.section-title {
	font-size: 28rpx;
	color: #666;
	margin-bottom: 16rpx;
	display: block;
}

/* 走马灯容器（白色背景卡片） */
.demo-box {
	background-color: #fff;
	border-radius: 16rpx;
	padding: 0 24rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.demo-box-custom {
	padding: 0;
}

/* ========== 自定义 item 样式 ========== */
.custom-item {
	display: flex;
	align-items: center;
	width: 100%;
	height: 100%;
	padding: 12rpx 24rpx;
}

.custom-icon {
	width: 64rpx;
	height: 64rpx;
	border-radius: 12rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 16rpx;
	flex-shrink: 0;
}

.icon-text {
	font-size: 24rpx;
	color: #fff;
	font-weight: bold;
}

.custom-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.custom-title {
	font-size: 26rpx;
	color: #333;
	font-weight: 600;
}

.custom-desc {
	font-size: 22rpx;
	color: #999;
	margin-top: 4rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* ========== 手动控制按钮 ========== */
.btn-row {
	display: flex;
	justify-content: center;
	gap: 24rpx;
	margin-top: 16rpx;
}

.ctrl-btn {
	font-size: 26rpx;
	color: #4ECDC4;
	padding: 12rpx 32rpx;
	border: 1rpx solid #4ECDC4;
	border-radius: 24rpx;
}

.ctrl-btn-stop {
	color: #FF6B6B;
	border-color: #FF6B6B;
}
</style>
