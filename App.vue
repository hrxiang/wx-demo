<script>
	/**
	 * App.vue — 小程序入口组件
	 *
	 * onLaunch 中执行全局初始化：
	 *   1. 版本更新检测 — 小程序热更新后提示用户重启
	 *   2. 网络状态监听 — 断网时全局提示，恢复时静默
	 *   3. 全局错误捕获 — 记录运行时异常，防止白屏
	 */
	export default {
		onLaunch: function() {
			// ---- 1. 版本更新检测 ----
			// 微信小程序发布新版本后，旧版本用户不会自动更新。
			// UpdateManager 检测到新版本时下载，下次冷启动生效。
			// 如果在本次运行期间下载完成，提示用户重启应用新版本。
			if (wx.canIUse('getUpdateManager')) {
				const updateManager = wx.getUpdateManager();

				// 检测到新版本，开始下载
				updateManager.onCheckForUpdate(function(res) {
					if (res.hasUpdate) {
						console.log('[App] 检测到新版本，开始下载...');
					}
				});

				// 新版本下载完成，提示用户重启
				updateManager.onUpdateReady(function() {
					wx.showModal({
						title: '更新提示',
						content: '新版本已就绪，是否重启应用？',
						success: function(res) {
							if (res.confirm) {
								// applyUpdate：立即应用新版本，小程序会重启
								updateManager.applyUpdate();
							}
						}
					});
				});

				// 新版本下载失败
				updateManager.onUpdateFailed(function() {
					wx.showModal({
						title: '更新提示',
						content: '新版本下载失败，请删除小程序后重新搜索打开',
						showCancel: false
					});
				});
			}

			// ---- 2. 网络状态监听 ----
			// 断网时提示用户，避免用户以为应用卡死。
			// 恢复网络时不做提示（避免打扰）。
			uni.onNetworkStatusChange(function(res) {
				if (!res.isConnected) {
					uni.showToast({
						icon: 'none',
						title: '网络已断开，请检查网络连接',
						duration: 3000
					});
				}
			});

			// ---- 3. 全局错误捕获 ----
			// 捕获未处理的同步异常，记录日志，防止小程序直接白屏。
			// 实际项目中可以将错误上报到日志服务器。
			uni.onError(function(err) {
				console.error('[App onError]', err);
				// TODO: 生产环境可将错误上报到日志服务
				// uploadErrorLog(err);
			});

			// 捕获未处理的 Promise 拒绝
			uni.onUnhandledRejection(function(res) {
				console.error('[App UnhandledRejection]', res.reason);
				// TODO: 生产环境可将错误上报到日志服务
			});

			console.log('[App] onLaunch 初始化完成');
		},

		onShow: function() {
			console.log('[App] onShow');
		},

		onHide: function() {
			console.log('[App] onHide');
		}
	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import '@/uni_modules/uni-scss/index.scss';
	/* #ifndef APP-NVUE */

	/**
	 * 全局自定义字体注册
	 *
	 * 为什么在 App.vue 注册而不是单独的 css 文件？
	 *   App.vue 的 <style> 是整个小程序唯一的全局 CSS 入口（编译为 app.wxss），
	 *   在这里声明的 @font-face 对所有页面都生效，无需在每个页面重复引入。
	 *
	 * 微信小程序 @font-face 的限制：
	 *   - 字体文件必须使用网络地址（https://）或 base64，不能用本地相对路径
	 *   - ttf 文件超过 40KB 不建议内联，应上传到 CDN 或使用 wx.loadFontFace() 动态加载
	 *
	 * 动态加载方式（推荐用于大字体文件）：
	 *   wx.loadFontFace({
	 *     family: 'MyFont',
	 *     source: 'url(https://cdn.example.com/my-font.ttf)',
	 *     success: () => console.log('字体加载成功'),
	 *   })
	 *
	 * 下面以「阿里 iconfont 图标字体」为例，替换 src 为你实际的 CDN 地址或 base64：
	 */
	@font-face {
		font-family: 'iconfont';
		/**
		 * 微信小程序只能使用网络地址或 base64，不能用本地路径。
		 * 请替换为你自己的 CDN 地址，例如阿里 iconfont 项目的在线链接：
		 * src: url('https://at.alicdn.com/t/c/font_xxxxxxx_xxxx.woff2') format('woff2'),
		 *      url('https://at.alicdn.com/t/c/font_xxxxxxx_xxxx.ttf') format('truetype');
		 */
		src: url('https://at.alicdn.com/t/c/font_placeholder.ttf') format('truetype');
		font-weight: normal;
		font-style: normal;
	}

	// 设置整个项目的背景色
	page {
		background-color: #f5f5f5;
	}

	/* #endif */
	.example-info {
		font-size: 14px;
		color: #333;
		padding: 10px;
	}
</style>