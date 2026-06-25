
## uniapp loading加载动画提示
> **组件名：uaLoading**
> 代码块： `<ua-loading>`

uaLoading基于uniapp vue3自定义loading加载提示组件。支持自定义加载图标、文字水平/垂直排列、包裹内容块、全屏提示等功能。


### 引入方式

本组件符合[easycom](https://uniapp.dcloud.io/collocation/pages?id=easycom)规范，只需将本组件放在components目录，在页面`template`中即可直接使用。


### 基本用法 

**示例**

- 基础用法

```js
<script setup>
	import { ref } from 'vue'
	
	const loaded = ref(true)
	const loading = ref(true)
	const loadingfull = ref(false)
	const loadingstyle = ref(false)
	const loadingstyle2 = ref(false)
	
	const handleOpen = () => {
		console.log('opened!')
	}
	const handleClose = () => {
		console.log('closed!')
	}
</script>
```

```html
<ua-loading v-model="loaded" background="rgba(0,0,0,.75)" spinner="ve-icon-loading" fullscreen="false">
	<template #text><div>加载中...</div></template>
</ua-loading>
<ua-loading v-model="loaded" text="Loading..." background="rgba(0,0,0,.75)" fullscreen="false" />
<ua-loading v-model="loaded" text="加载中" size="16px" mode="horizontal" background="rgba(0,0,0,.5)" fullscreen="false" />
```

- 自定义全屏loading

```html
<ua-loading
	v-model="loadingfull"
	text="加载中"
	time="3"
	size="50px"
	background="rgba(5,50,10,.9)"
	fullscreen="true"
	@open="handleOpen"
	@close="handleClose"
/>
```

- 自定义loading动画样式

```html
<ua-loading v-model="loadingstyle" background="rgba(0,0,0,.75)" shadeClose>
	<template #spinner>
		<span class="custom-loading">
			<em></em><em></em><em></em><em></em><em></em>
		</span>
	</template>
	<template #text><div style="color: greenyellow;">加载中...</div></template>
</ua-loading>
```

```css
.custom-loading {display: inline-flex; align-items: flex-end; gap: 5px; min-height: 45px;}
.custom-loading em {
    background: #ff007f; border-radius: 6px; display: inline-block; height: 100%; width: 5px;
    animation: animHeart 1s linear infinite;
}
@keyframes animHeart {
    0%,100% {height: 15px; background: #ff007f;}
    50% {height: 45px; background: #55ff00;}
}
.custom-loading em:nth-child(2) {animation-delay: .2s;}
.custom-loading em:nth-child(3) {animation-delay: .4s;}
.custom-loading em:nth-child(4) {animation-delay: .6s;}
.custom-loading em:nth-child(5) {animation-delay: .8s;}
```


### API

### uaLoading Props 

|属性名|类型|默认值|说明|
|:-:|:-:|:-:|:-:|
|modelValue|Boolean|false| 是否显示loading |
|text|String|-|加载提示内容|
|spinner  |String|-|自定义加载图标类名|
|background |String|-|遮罩层背景|
|mode |String|vertical|显示模式(vertical / horizontal)|
|size |Number/String|24|加载图标大小|
|loadingStyle |String|-|自定义样式|
|shade |Boolean|true|是否显示加载遮罩层|
|shadeClose |Boolean|false|点击遮罩层关闭loading|
|opacity |Number/String|-|遮罩层透明度|
|fullscreen |Boolean|true|是否全屏loading|
|time |Number|0|loading显示时间|
|zIndex |Number/String|2023|loading层级|

#### 事件

- @open 打开触发
- @close 关闭触发



### 💝最后

开发不易，希望各位小伙伴们多多支持下哈~~ ☕️☕️
