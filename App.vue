<script>
	export default {
		onLaunch: function() {
			console.warn('当前组件仅支持 uni_modules 目录结构 ，请升级 HBuilderX 到 3.1.0 版本以上！')
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
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