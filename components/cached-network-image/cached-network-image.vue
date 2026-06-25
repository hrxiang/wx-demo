<template>
	<image :src="imgSrc" :style="imgStyle" :mode="mode" :lazy-load="lazyLoad" :webp="webp"
		:show-menu-by-longpress="showMenuByLongpress" @load="load" @error="error"></image>
</template>

<script>
	import imageCache from './image-cache';

	export default {
		name: "cached-network-image",
		props: {
			url: {
				type: String,
				default: null,
			},
			imgStyle: { // { width: '500rpx', height: '500rpx' }
				type: Object,
				default: () => ({}),
			},
			mode: { // 图片裁剪、缩放的模式。 https://uniapp.dcloud.net.cn/component/image.html
				type: String,
				default: 'scaleToFill',
			},
			lazyLoad: { // 图片懒加载。只针对page与scroll-view下的image有效
				type: Boolean,
				default: false,
			},
			webp: { // 在系统不支持webp的情况下是否单独启用webp 微信小程序2.9.0
				type: Boolean,
				default: false,
			},
			showMenuByLongpress: { // 开启长按图片显示识别小程序码菜单 微信小程序2.7.0
				type: Boolean,
				default: false,
			}
		},
		emits: ['load', 'error'],
		data() {
			return {
				imgSrc: null,
			};
		},
		mounted() {
			this.getImage();
		},
		methods: {
			async getImage() {
				if (this.url) {
					if (this.url.startsWith('http') || this.url.startsWith("https")) {
						this.imgSrc = await imageCache.getCachedImage(this.url);
					} else {
						this.imgSrc = this.url;
					}
				}
				return null;
			},
			load(event) {
				this.$emit('load', event);
			},
			error(ev) {
				this.$emit('event', event);
			}
		},
		watch: {
			url(newV, oldV) {
				this.getImage();
			}
		}
	}
</script>

<style lang="scss">

</style>