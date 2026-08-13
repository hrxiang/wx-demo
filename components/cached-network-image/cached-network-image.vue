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
			},
			placeholder: {
				type: String,
				default: null,
			},
			errorPlaceholder: {
				type: String,
				default: null,
			},
			enabledCustomCache: {
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
				if (this.enabledCustomCache && this.isValidUrl) {
					this.imgSrc = await imageCache.getCachedImage(this.url);
				} else {
					this.imgSrc = this.url || this.placeholder;
				}
			},
			load(event) {
				this.$emit('load', event);
			},
			error(event) {
				const placeholder = this.errorPlaceholder || this.placeholder;
				if (placeholder && this.imgSrc !== placeholder) {
					this.imgSrc = placeholder;
				}
				this.$emit('error', event);
			}
		},
		computed: {
			isValidUrl() {
				return this.url && (this.url.startsWith('http') || this.url.startsWith("https"));
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