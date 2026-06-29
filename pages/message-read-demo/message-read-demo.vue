<!--
	消息已读检测 Demo
	==================
	核心原理：使用 uni.createIntersectionObserver（微信小程序的交叉观察器 API）
	监听每个消息项在屏幕可视区域中的可见比例。

	判定规则：
	1. 消息项可见面积 >= 50% 时，启动一个 800ms 的倒计时
	2. 如果消息在倒计时结束前一直保持在屏幕内 → 标记为「已读」
	3. 如果用户在倒计时期间滚走，消息离开屏幕 → 取消倒计时，保持「未读」

	视觉反馈：
	- 左上角：已读/总数 统计
	- 每条消息右侧：已读/未读 标签
	- 消息底部：可见比例进度条（仅未读时显示）
	- 左侧边框颜色：红色=未读，绿色=已读
-->
<template>
	<view class="container">
		<!-- ========== 顶部统计栏 ========== -->
		<view class="stats-bar">
			<!-- 显示 已读数量 / 总消息数 -->
			<text class="stats-text">已读: {{ readCount }} / {{ messages.length }}</text>
			<!-- 点击后将所有消息重置为未读状态，方便反复测试 -->
			<text class="stats-btn" @click="resetAll">全部重置为未读</text>
		</view>

		<!-- ========== 消息列表（使用 scroll-view 实现纵向滚动） ========== -->
		<!--
			scroll-view 是 uni-app 的滚动容器组件：
			- scroll-y: 允许纵向滚动
			- height: 动态计算为屏幕高度减去顶部统计栏高度，确保列表独立滚动
			- @scroll: 滚动事件（此处不需要手动处理，IntersectionObserver 会自动追踪可见性）
		-->
		<scroll-view
			class="message-list"
			scroll-y
			:style="{ height: scrollHeight + 'px' }"
			@scroll="onScroll"
		>
			<!-- 模拟下拉刷新按钮（测试增量 Diff 功能） -->
			<view class="refresh-bar" @click="simulateRefresh">
				<text class="refresh-text">↓ 模拟下拉刷新（测试增量 Diff）</text>
			</view>
			<!-- 遍历所有消息，每条消息都有唯一 id 用于 Observer 定位 -->
			<view
				v-for="item in messages"
				:key="item.id"
				:id="'msg-' + item.id"
				class="message-item"
				:class="{ 'is-read': item.isRead }"
			>
				<!-- 消息头部：头像 + 发送者信息 + 已读/未读标签 -->
				<view class="msg-header">
					<!-- 头像：取发送者名字的首字，背景色随机分配 -->
					<view class="avatar" :style="{ backgroundColor: item.color }">
						{{ item.sender.charAt(0) }}
					</view>
					<!-- 发送者姓名 + 时间 -->
					<view class="msg-info">
						<text class="sender">{{ item.sender }}</text>
						<text class="time">{{ item.time }}</text>
					</view>
					<!-- 已读/未读标签：根据 isRead 状态切换样式和文字 -->
					<view class="read-badge" :class="item.isRead ? 'badge-read' : 'badge-unread'">
						{{ item.isRead ? '已读' : '未读' }}
					</view>
				</view>

				<!-- 消息正文 -->
				<text class="msg-content">{{ item.content }}</text>

				<!--
					可见进度条（仅未读消息显示）：
					- visibleProgress 范围 0~100，表示消息在屏幕中的可见面积百分比
					- 由 IntersectionObserver 的 intersectionRatio 实时驱动
					- 当 visibleProgress 达到 50% 并停留 800ms 后，消息变为已读，进度条隐藏
				-->
				<view v-if="item.visibleProgress > 0 && !item.isRead" class="progress-bar">
					<view class="progress-fill" :style="{ width: item.visibleProgress + '%' }"></view>
				</view>
			</view>

			<!-- 列表底部提示 -->
			<view class="list-footer">
				<text class="footer-text">— 没有更多消息了 —</text>
			</view>
		</scroll-view>
	</view>
</template>

<script>
/**
 * 消息已读检测 Demo
 *
 * 核心 API：uni.createIntersectionObserver
 * 文档：https://uniapp.dcloud.net.cn/api/ui/intersection-observer.html
 *
 * 整体流程：
 * ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌──────────┐
 * │ 页面加载     │────>│ 创建 Observer     │────>│ 可见比例变化  │────>│ 计时判定  │
 * │ initMessages │     │ setupObservers   │     │ handleVis..  │     │ markRead │
 * └─────────────┘     └──────────────────┘     └─────────────┘     └──────────┘
 */
export default {
	data() {
		return {
			// scroll-view 的滚动区域高度（px），在 onLoad 中根据设备屏幕动态计算
			scrollHeight: 600,

			// 消息列表数据，每条消息包含：id, sender, color, content, time, isRead, visibleProgress
			messages: [],

			/**
			 * 可见性追踪表（visibilityMap）
			 * key: 消息 id
			 * value: { timer: setTimeout的返回值, startTime: 进入可见区域的时间戳 }
			 *
			 * 作用：记录当前正在「倒计时中」的消息。
			 * - 当消息可见面积 >= 50% 时，往这里添加一条记录并启动定时器
			 * - 当消息可见面积 < 50% 时，从这里取出 timer 并 clearTimeout
			 * - 当定时器触发（消息已读）后，从这里删除记录
			 */
			visibilityMap: {},

			/**
			 * 已读判定阈值（毫秒）
			 * 消息需要在屏幕可视区域内停留超过这个时间才会被标记为已读。
			 */
			readThreshold: 800,

			// 模拟刷新计数器，用于生成不同的新数据
			_refreshCount: 0
		};
	},

	computed: {
		/** 已读消息数量，用于顶部统计显示 */
		readCount() {
			return this.messages.filter(m => m.isRead).length;
		}
	},

	/**
	 * 页面加载时：
	 * 1. 初始化 20 条模拟消息数据
	 * 2. 获取设备屏幕高度，计算 scroll-view 的可用高度
	 */
	onLoad() {
		this.initMessages();
		// 获取设备信息，windowHeight 是可用窗口高度（不含状态栏和导航栏）
		const sysInfo = uni.getSystemInfoSync();
		// 减去顶部统计栏的高度（约50px），让 scroll-view 填满剩余空间
		this.scrollHeight = sysInfo.windowHeight - 50;
	},

	/**
	 * 页面渲染完成后：
	 * 使用 $nextTick 确保 DOM 已经挂载，然后再创建 IntersectionObserver
	 * （Observer 需要目标元素已经存在于 DOM 中才能正常工作）
	 */
	onReady() {
		this.$nextTick(() => {
			// 初始化 Observer Map（key: 消息id，value: Observer 实例）
			this._observerMap = new Map();
			// 为所有消息创建 Observer
			this.messages.forEach(msg => {
				this.createObserverForMessage(msg);
			});
		});
	},

	/**
	 * 页面卸载时：
	 * 销毁所有 Observer 并清除定时器，防止内存泄漏
	 */
	onUnload() {
		this.destroyObservers();
	},

	methods: {
		/**
		 * 初始化模拟消息数据
		 * 生成 20 条消息，每条消息包含：
		 * - id: 唯一标识（从1开始）
		 * - sender: 发送者姓名（循环使用）
		 * - color: 头像背景色（循环使用）
		 * - content: 消息正文
		 * - time: 随机生成的时间（08:00 ~ 19:59）
		 * - isRead: 初始为 false（未读）
		 * - visibleProgress: 初始为 0（不可见）
		 */
		initMessages() {
			const senders = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑一', '冯二'];
			const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
			const contents = [
				'你好，明天的会议改到下午3点了，请注意查看。',
				'项目周报已经提交，请查阅附件中的详细内容。',
				'今天下午有个技术分享会，有兴趣可以来参加。',
				'上次的Bug已经修复了，麻烦验证一下是否正常。',
				'新版本已经发布到测试环境，请帮忙测试一下。',
				'这个需求文档你看一下，有没有什么需要补充的？',
				'周五团建活动定在羽毛球馆，记得带运动服。',
				'数据库迁移脚本已经写好，安排在凌晨执行。',
				'客户反馈了一个新问题，优先级比较高，请看一下。',
				'代码评审的意见已经整理好了，请逐条处理。',
				'接口文档更新了，新增了三个接口的说明。',
				'今天的外卖谁帮忙点一下？我这边忙不过来了。',
				'服务器监控报警了，CPU使用率超过90%。',
				'产品经理说需求又要改了，大家准备一下。',
				'前端构建速度优化方案已经写好了，请review。',
				'这个月的KPI考核表已经发下来了，请确认签字。',
				'测试环境的证书快过期了，需要尽快续签。',
				'新的设计规范出来了，大家后续按新规范来。',
				'线上出现了一个偶现的问题，正在排查中。',
				'明天上午10点有个需求评审会，请准时参加。'
			];

			this.messages = contents.map((content, index) => ({
				id: index + 1,
				sender: senders[index % senders.length],
				color: colors[index % colors.length],
				content,
				time: this.randomTime(),
				isRead: false,
				visibleProgress: 0
			}));
		},

		/**
		 * 生成随机时间字符串，格式 HH:MM
		 * 小时范围：08~19（模拟工作时间）
		 * 分钟范围：00~59
		 */
		randomTime() {
			const h = Math.floor(Math.random() * 12) + 8;
			const m = Math.floor(Math.random() * 60);
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		},

		/**
		 * 为单条消息创建 IntersectionObserver 并存入 Map
		 *
		 * @param {Object} msg - 消息对象，必须包含 id 属性
		 *
		 * 设计为独立方法的原因：
		 * 增量 Diff 更新时，只需为新增的消息单独创建 Observer，
		 * 而不需要销毁和重建所有已有的 Observer。
		 *
		 * thresholds 说明：
		 * - [0, 0.25, 0.5, 0.75, 1.0] 表示当元素可见面积比例
		 *   跨过 0%、25%、50%、75%、100% 这些阈值时都会触发回调
		 */
		createObserverForMessage(msg) {
			// 优化：已读消息不需要 Observer，直接跳过
			// 接口返回的数据可能包含已读消息，无需浪费原生监听资源
			if (msg.isRead) return;

			// 如果已存在，先销毁旧的（防止重复创建导致内存泄漏）
			if (this._observerMap.has(msg.id)) {
				this.destroyObserverForMessage(msg.id);
			}

			const observer = uni.createIntersectionObserver(this, {
				thresholds: [0, 0.25, 0.5, 0.75, 1.0]
			});

			observer
				.relativeToViewport({ top: 0, bottom: 0 })
				.observe(`#msg-${msg.id}`, (res) => {
					this.handleVisibility(msg.id, res);
				});

			this._observerMap.set(msg.id, observer);
		},

		/**
		 * 销毁单条消息的 Observer 并清理相关定时器
		 *
		 * @param {number} id - 消息 id
		 *
		 * 清理内容：
		 * 1. disconnect Observer（停止监听）
		 * 2. 从 Map 中移除引用
		 * 3. 清除 visibilityMap 中的倒计时（如果有）
		 * 4. 重置该消息的进度条
		 */
		destroyObserverForMessage(id) {
			// 1. 断开 Observer
			const observer = this._observerMap.get(id);
			if (observer) {
				observer.disconnect();
				this._observerMap.delete(id);
			}

			// 2. 清除该消息的已读倒计时（如果有）
			if (this.visibilityMap[id]) {
				clearTimeout(this.visibilityMap[id].timer);
				delete this.visibilityMap[id];
			}

			// 3. 重置进度条（消息可能已被标记为未读但进度条还残留着）
			const msg = this.messages.find(m => m.id === id);
			if (msg && !msg.isRead) {
				msg.visibleProgress = 0;
			}
		},

		/**
		 * 处理单个消息的可见性变化（Observer 回调）
		 *
		 * @param {number} id - 消息的唯一 id
		 * @param {Object} res - IntersectionObserver 回调结果
		 * @param {number} res.intersectionRatio - 元素可见面积占比（0~1）
		 *
		 * 判定逻辑：
		 * ┌────────────────────────────────────────────────────────────┐
		 * │  intersectionRatio >= 0.5（可见面积 >= 50%）               │
		 * │    ├─ 已在 visibilityMap 中？ → 不做操作（继续倒计时）      │
		 * │    └─ 不在 visibilityMap 中？ → 添加记录，启动 800ms 定时器 │
		 * │                                                            │
		 * │  intersectionRatio < 0.5（可见面积 < 50%）                 │
		 * │    ├─ 在 visibilityMap 中？ → 清除定时器，删除记录          │
		 * │    └─ 不在 visibilityMap 中？ → 不做操作                   │
		 * └────────────────────────────────────────────────────────────┘
		 */
		handleVisibility(id, res) {
			// intersectionRatio: 0 = 完全不可见，1 = 完全可见
			const ratio = res.intersectionRatio;

			// 根据 id 找到对应消息在数组中的索引
			const msgIndex = this.messages.findIndex(m => m.id === id);
			if (msgIndex === -1) return;

			// —— 第一步：更新可见进度（驱动进度条 UI）——
			// 将 0~1 的比例转换为 0~100 的百分比
			const progress = Math.min(Math.round(ratio * 100), 100);
			this.messages[msgIndex].visibleProgress = progress;

			// —— 第二步：根据可见比例决定是否启动/取消已读倒计时 ——
			if (ratio >= 0.5) {
				// 消息可见面积 >= 50%，满足「停留判定」的最低条件
				if (!this.visibilityMap[id]) {
					// 如果该消息还没有在倒计时中，则启动一个新的定时器
					// 如果消息在 readThreshold（800ms）内一直保持在屏幕中，定时器触发后标记为已读
					this.visibilityMap[id] = {
						timer: setTimeout(() => {
							this.markAsRead(id);
						}, this.readThreshold),
						startTime: Date.now() // 记录进入时间，便于调试
					};
				}
				// 如果已经在 visibilityMap 中（已有定时器在跑），不做任何操作，让倒计时继续
			} else {
				// 消息可见面积 < 50%，不满足停留条件
				if (this.visibilityMap[id]) {
					// 如果之前有定时器在跑，说明消息曾经进入过屏幕但又滚出去了
					// 此时取消定时器，该消息不会被标记为已读
					clearTimeout(this.visibilityMap[id].timer);
					delete this.visibilityMap[id];
				}
			}
		},

		/**
		 * 将指定消息标记为已读
		 *
		 * @param {number} id - 消息的唯一 id
		 *
		 * 此方法由 handleVisibility 中的 setTimeout 触发调用。
		 * 只有当消息在屏幕中停留超过 readThreshold 毫秒后才会执行到这里。
		 */
		markAsRead(id) {
			const msgIndex = this.messages.findIndex(m => m.id === id);
			if (msgIndex === -1) return;
			// 防止重复标记（已读的消息不需要再次处理）
			if (this.messages[msgIndex].isRead) return;

			// 标记为已读
			this.messages[msgIndex].isRead = true;
			// 进度条设为 100%（已读后进度条会被 v-if 隐藏，这里主要是语义完整）
			this.messages[msgIndex].visibleProgress = 100;
			// 从追踪表中移除（已读消息不再需要追踪可见性）
			delete this.visibilityMap[id];
		},

		/**
		 * 重置所有消息为未读状态
		 * 点击顶部「全部重置为未读」按钮时调用。
		 * 同时清除所有正在运行的定时器，防止残留定时器误触发。
		 */
		resetAll() {
			// 重置每条消息的已读状态和进度
			this.messages.forEach(msg => {
				msg.isRead = false;
				msg.visibleProgress = 0;
			});
			// 清除所有正在运行的定时器
			Object.keys(this.visibilityMap).forEach(id => {
				clearTimeout(this.visibilityMap[id].timer);
			});
			// 清空追踪表
			this.visibilityMap = {};
		},

		// ==================== 增量 Diff 更新 ====================

		/**
		 * 增量 Diff 更新消息列表和 Observer
		 *
		 * 【核心方法】下拉刷新 / 数据更新时调用。
		 *
		 * 策略（五种情况）：
		 * ┌───────────────────────────────────────────────────────────┐
		 * │ 情况 1: ID 完全相同且已读状态也没变                         │
		 * │   → 不做任何操作，保留所有 Observer 和倒计时                │
		 * │                                                            │
		 * │ 情况 2: 有新增 ID                                          │
		 * │   → 只为未读的新增消息创建 Observer                         │
		 * │                                                            │
		 * │ 情况 3: 有删除 ID                                          │
		 * │   → 销毁被删除消息的 Observer + 清除倒计时                  │
		 * │                                                            │
		 * │ 情况 4: ID 没变，但消息从「未读」变成了「已读」（多端同步）  │
		 * │   → 销毁该消息的 Observer + 清除倒计时                      │
		 * │                                                            │
		 * │ 情况 5: ID 没变，但消息从「已读」变成了「未读」（罕见）      │
		 * │   → 为该消息创建 Observer                                   │
		 * └───────────────────────────────────────────────────────────┘
		 *
		 * @param {Array} newMessages - 新的消息列表数据（全量）
		 */
		diffAndUpdateObservers(newMessages) {
			// 构建旧消息的 id → msg 映射（方便快速查找）
			const oldMap = new Map();
			this.messages.forEach(m => oldMap.set(m.id, m));

			// 构建新 ID 集合
			const newIds = new Set(newMessages.map(m => m.id));

			// 计算差异
			const addedMsgs = [];       // 新增的消息对象
			const removedIds = [];      // 被删除的消息 id
			const readChangedIds = [];  // 从「未读→已读」的消息 id（需要移除 Observer）
			const unreadChangedIds = []; // 从「已读→未读」的消息 id（需要创建 Observer）

			// 遍历新消息列表，与旧消息对比
			newMessages.forEach(newMsg => {
				const oldMsg = oldMap.get(newMsg.id);
				if (!oldMsg) {
					// 新消息：旧列表中没有这个 id
					addedMsgs.push(newMsg);
				} else {
					// 两边都有的消息：检查已读状态是否变化
					if (!oldMsg.isRead && newMsg.isRead) {
						// 情况 4：未读 → 已读（多端同步，其他设备已读）
						readChangedIds.push(newMsg.id);
					} else if (oldMsg.isRead && !newMsg.isRead) {
						// 情况 5：已读 → 未读（罕见，比如管理员撤回已读状态）
						unreadChangedIds.push(newMsg.id);
					}
				}
			});

			// 找出被删除的消息：旧列表中有但新列表中没有
			oldMap.forEach((msg, id) => {
				if (!newIds.has(id)) removedIds.push(id);
			});

			// 计算是否有实质性变化
			const hasChanges = addedMsgs.length > 0 || removedIds.length > 0
				|| readChangedIds.length > 0 || unreadChangedIds.length > 0;

			if (!hasChanges) {
				// ===== 情况 1: 数据完全没变 =====
				console.log('[Diff] 数据无变化，保留所有 Observer');
				uni.showToast({ title: '数据无变化', icon: 'none' });
				return;
			}

			console.log(`[Diff] 新增 ${addedMsgs.length}, 删除 ${removedIds.length}, 已读变更 ${readChangedIds.length}, 未读变更 ${unreadChangedIds.length}`);
			uni.showToast({
				title: `+${addedMsgs.length} -${removedIds.length} 已读${readChangedIds.length} 未读${unreadChangedIds.length}`,
				icon: 'none'
			});

			// ===== 执行增量更新 =====

			// 第一步：销毁被删除消息的 Observer
			removedIds.forEach(id => {
				this.destroyObserverForMessage(id);
			});

			// 第二步：销毁从「未读→已读」消息的 Observer（多端同步场景）
			readChangedIds.forEach(id => {
				this.destroyObserverForMessage(id);
			});

			// 第三步：更新消息数据（触发 v-for 重新渲染）
			this.messages = newMessages;

			// 第四步：等待 DOM 渲染完成后，为需要监听的消息创建 Observer
			this.$nextTick(() => {
				// 为新增消息创建 Observer（createObserverForMessage 内部会跳过已读消息）
				addedMsgs.forEach(msg => {
					this.createObserverForMessage(msg);
				});
				// 为从「已读→未读」的消息创建 Observer
				unreadChangedIds.forEach(id => {
					const msg = newMessages.find(m => m.id === id);
					if (msg) this.createObserverForMessage(msg);
				});
			});
		},

		// ==================== 模拟下拉刷新 ====================

		/**
		 * 模拟下拉刷新：随机生成新数据，测试增量 Diff 功能
		 *
		 * 每次点击会循环产生四种情况之一：
		 * 1. 顶部插入 2 条新消息（模拟收到新消息）
		 * 2. 删除 1 条随机消息（模拟消息被撤回/删除）
		 * 3. 将前 3 条未读消息标记为已读（模拟多端同步）
		 * 4. 数据不变（模拟下拉后数据无变化）
		 */
		simulateRefresh() {
			this._refreshCount++;
			const scenario = this._refreshCount % 4;

			if (scenario === 0) {
				// 场景 A：顶部插入 2 条新消息
				const maxId = Math.max(...this.messages.map(m => m.id), 0);
				const newOnes = [
					{
						id: maxId + 1,
						sender: '新消息A',
						color: '#E74C3C',
						content: `这是顶部插入的新消息 #${maxId + 1}，应该会被自动监听到。`,
						time: this.randomTime(),
						isRead: false,
						visibleProgress: 0
					},
					{
						id: maxId + 2,
						sender: '新消息B',
						color: '#8E44AD',
						content: `这是顶部插入的新消息 #${maxId + 2}，应该会被自动监听到。`,
						time: this.randomTime(),
						isRead: false,
						visibleProgress: 0
					}
				];
				console.log('[Refresh] 场景 A: 顶部插入 2 条新消息');
				this.diffAndUpdateObservers([...newOnes, ...this.messages]);

			} else if (scenario === 1) {
				// 场景 B：删除 1 条随机消息
				if (this.messages.length > 5) {
					const removeIdx = Math.floor(Math.random() * this.messages.length);
					const newMsgs = this.messages.filter((_, i) => i !== removeIdx);
					console.log(`[Refresh] 场景 B: 删除消息 id=${this.messages[removeIdx].id}`);
					this.diffAndUpdateObservers(newMsgs);
				} else {
					console.log('[Refresh] 消息太少，跳过删除');
					uni.showToast({ title: '消息太少，跳过删除', icon: 'none' });
				}

			} else if (scenario === 2) {
				// 场景 C：模拟多端同步 —— 将前 3 条未读消息标记为已读
				const newMsgs = this.messages.map(msg => {
					return { ...msg };
				});
				let markCount = 0;
				for (let i = 0; i < newMsgs.length && markCount < 3; i++) {
					if (!newMsgs[i].isRead) {
						newMsgs[i].isRead = true;
						markCount++;
					}
				}
				if (markCount > 0) {
					console.log(`[Refresh] 场景 C: 多端同步，将 ${markCount} 条未读消息标记为已读`);
					this.diffAndUpdateObservers(newMsgs);
				} else {
					console.log('[Refresh] 所有消息都已读，跳过');
					uni.showToast({ title: '所有消息都已读', icon: 'none' });
				}

			} else {
				// 场景 D：数据不变
				console.log('[Refresh] 场景 D: 数据无变化');
				this.diffAndUpdateObservers([...this.messages]);
			}
		},

		/**
		 * scroll-view 的滚动事件回调
		 * 此处不需要手动处理任何逻辑。
		 * 因为 IntersectionObserver 会在元素进出可视区域时自动触发回调，
		 * 不需要依赖 scroll 事件来做可见性判断。
		 * 保留此方法仅作为扩展点。
		 */
		onScroll() {
			// 无需额外处理
		},

		/**
		 * 销毁所有 Observer 和定时器
		 * 在页面卸载（onUnload）时调用，防止内存泄漏。
		 */
		destroyObservers() {
			if (this._observerMap) {
				this._observerMap.forEach((observer, id) => {
					observer.disconnect();
				});
				this._observerMap.clear();
			}
			// 清除所有未触发的定时器
			Object.keys(this.visibilityMap).forEach(id => {
				clearTimeout(this.visibilityMap[id].timer);
			});
			this.visibilityMap = {};
		}
	}
};
</script>

<style lang="scss">
/* 页面容器：纵向布局，撑满整个屏幕 */
.container {
	display: flex;
	flex-direction: column;
	height: 100vh;
	background-color: #f5f5f5;
}

/* 顶部统计栏：固定在列表上方，不随列表滚动 */
.stats-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 16rpx 24rpx;
	background-color: #fff;
	border-bottom: 1rpx solid #eee;

	.stats-text {
		font-size: 26rpx;
		color: #666;
	}

	/* 重置按钮：圆角描边风格 */
	.stats-btn {
		font-size: 24rpx;
		color: #4ECDC4;
		padding: 8rpx 20rpx;
		border: 1rpx solid #4ECDC4;
		border-radius: 24rpx;
	}
}

/* 模拟刷新栏：下拉提示样式 */
.refresh-bar {
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 16rpx;
	background-color: #F0F8FF;
	border-radius: 12rpx;
	margin-bottom: 16rpx;

	.refresh-text {
		font-size: 24rpx;
		color: #45B7D1;
	}
}

/* 消息列表滚动区域 */
.message-list {
	flex: 1;
	padding: 16rpx;
}

/*
	单条消息卡片
	- 左边框颜色区分已读/未读状态：
	  红色(#FF6B6B) = 未读，绿色(#4ECDC4) = 已读
	- transition 让状态变化时有平滑过渡动画
*/
.message-item {
	background-color: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 16rpx;
	transition: all 0.3s ease;
	border-left: 6rpx solid #FF6B6B;

	/* 已读状态：左边框变绿，整体降低透明度以区分 */
	&.is-read {
		border-left-color: #4ECDC4;
		opacity: 0.8;
	}
}

/* 消息头部：头像 + 信息 + 标签，横向排列 */
.msg-header {
	display: flex;
	align-items: center;
	margin-bottom: 16rpx;
}

/* 圆形头像：显示发送者名字首字 */
.avatar {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	font-size: 28rpx;
	font-weight: bold;
	margin-right: 16rpx;
	flex-shrink: 0;
}

/* 发送者信息区域（姓名+时间） */
.msg-info {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.sender {
	font-size: 28rpx;
	font-weight: 600;
	color: #333;
}

.time {
	font-size: 22rpx;
	color: #999;
	margin-top: 4rpx;
}

/* 已读/未读标签基础样式 */
.read-badge {
	font-size: 22rpx;
	padding: 4rpx 16rpx;
	border-radius: 20rpx;
	flex-shrink: 0;
}

/* 未读标签：红色系 */
.badge-unread {
	background-color: #FFE0E0;
	color: #FF6B6B;
}

/* 已读标签：绿色系 */
.badge-read {
	background-color: #E0F8F5;
	color: #4ECDC4;
}

/* 消息正文 */
.msg-content {
	font-size: 26rpx;
	color: #555;
	line-height: 1.6;
}

/*
	可见进度条容器：
	- 仅在未读消息且 visibleProgress > 0 时显示
	- 4rpx 的细条，位于消息卡片底部
*/
.progress-bar {
	height: 4rpx;
	background-color: #f0f0f0;
	border-radius: 2rpx;
	margin-top: 16rpx;
	overflow: hidden;
}

/* 进度条填充部分：渐变绿色，宽度由 visibleProgress 百分比驱动 */
.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, #4ECDC4, #45B7D1);
	border-radius: 2rpx;
	transition: width 0.3s ease;
}

/* 列表底部提示 */
.list-footer {
	padding: 32rpx 0;
	text-align: center;
}

.footer-text {
	font-size: 24rpx;
	color: #ccc;
}
</style>
