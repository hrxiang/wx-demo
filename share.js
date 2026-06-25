/**
 * share.js — 微信小程序全局分享 Mixin
 *
 * 用途：
 *   以 Vue Options API mixin 的形式提供统一的分享能力。
 *   已在 main.js 通过 app.mixin() 全局注入，无需每个页面单独引入。
 *
 * 全局注入方式（main.js）：
 *   import share from '@/share.js'
 *   app.mixin(share)
 *
 * 支持两种触发来源：
 *   1. 按钮触发（button open-type="share"）：
 *      按钮需在 data-item 中传入 { title, targetLink, imageUrl } 对象，
 *      分享内容将使用 item 中的字段，路径自动拼接为 webview 页面。
 *   2. 右上角菜单触发：
 *      使用 this.share 中配置的默认值。
 *
 * 页面自定义分享内容：
 *   在页面的 data 中重新声明 share 对象即可覆盖全局默认配置，例如：
 *   data() {
 *     return {
 *       share: {
 *         title: '自定义页面标题',
 *         path: '/pages/custom/index',
 *         imageUrl: '/static/custom_cover.png',
 *       }
 *     }
 *   }
 */

/**
 * 构建按钮触发时的分享参数
 * @param {object} item       - 按钮 data-item 中的数据
 * @returns {object} 微信分享参数对象
 */
function buildButtonShareParams(item) {
	return {
		title: item.title,
		// 统一跳转到 webview 容器页，通过 query 传递目标 URL 和标题
		path: '/pages/common/webview/index?title=' + encodeURIComponent(item.title) + '&url=' + encodeURIComponent(item.targetLink),
		imageUrl: item.imageUrl,
	};
}

export default {
	data() {
		return {
			/**
			 * 默认分享配置，页面可在自身 data 中重新声明 share 对象来覆盖。
			 * - title    : 分享卡片标题
			 * - path     : 分享落地页路径（相对于小程序根目录）
			 * - imageUrl : 分享卡片封面图（建议尺寸 5:4，不超过 128KB）
			 */
			share: {
				title: '',
				path: '',
				imageUrl: '',
			},
		};
	},

	methods: {
		/**
		 * 判断分享事件是否由页面内的按钮触发，
		 * 并且按钮已通过 data-item 携带了自定义分享数据。
		 * @param {object} res - onShareAppMessage / onShareTimeline 的入参
		 * @returns {boolean}
		 */
		_isButtonShare(res) {
			return res.from === 'button'
				&& res.target
				&& res.target.dataset
				&& res.target.dataset.item;
		},
	},

	/**
	 * 分享给朋友（转发）
	 * 触发时机：用户点击右上角「转发」或页面内 open-type="share" 按钮
	 *
	 * @param {object} res
	 * @param {string} res.from   - 触发来源：'button' | 'menu'
	 * @param {object} res.target - 当 from === 'button' 时为触发按钮的组件对象
	 * @returns {object} 分享参数：{ title, path, imageUrl }
	 */
	onShareAppMessage(res) {
		if (this._isButtonShare(res)) {
			return buildButtonShareParams(res.target.dataset.item);
		}
		// 默认：使用页面级 share 配置
		return {
			title: this.share.title,
			path: this.share.path,
			imageUrl: this.share.imageUrl,
		};
	},

	/**
	 * 分享到朋友圈
	 * 触发时机：用户点击右上角「分享到朋友圈」或页面内 open-type="share" 按钮
	 * 注意：朋友圈分享不支持 path 带参数跳转，仅展示图文卡片。
	 *
	 * @param {object} res
	 * @param {string} res.from   - 触发来源：'button' | 'menu'
	 * @param {object} res.target - 当 from === 'button' 时为触发按钮的组件对象
	 * @returns {object} 分享参数：{ title, imageUrl }
	 */
	onShareTimeline(res) {
		if (this._isButtonShare(res)) {
			return buildButtonShareParams(res.target.dataset.item);
		}
		// 默认：使用页面级 share 配置
		return {
			title: this.share.title,
			path: this.share.path,
			imageUrl: this.share.imageUrl,
		};
	},
};
