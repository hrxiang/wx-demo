/** 微信小程序用户数据目录 */
export const path = wx.env.USER_DATA_PATH;

// ==================== 文件基础操作 ====================

/**
 * 检查文件是否存在
 * @param filePath 文件绝对路径
 * @returns 文件是否存在
 */
export function checkFileExists(filePath : string) : Promise<boolean> {
	return new Promise((resolve) => {
		const fs = wx.getFileSystemManager();
		fs.access({
			path: filePath,
			success: () => resolve(true),
			fail: () => resolve(false),
		});
	});
}

/**
 * 从 URL 中提取文件扩展名
 * @param url 文件 URL 或路径
 * @returns 扩展名（小写，不含点），无扩展名时返回 null
 */
export function getFileExtension(url : string) : string | null {
	const filename = url.split('/').pop();
	if (!filename || !filename.includes('.')) return null;
	// 取最后一个点之后的部分作为扩展名
	const ext = filename.split('.').pop();
	return ext ? ext.toLowerCase() : null;
}

/**
 * 生成带扩展名的文件名
 * @param url 文件 URL（用于提取默认扩展名）
 * @param filename 文件名，默认使用 url
 * @param extension 扩展名，默认从 url 中提取
 * @returns 完整文件名，如 'report.pdf'
 */
export function generateFilename(url : string, filename ?: string, extension ?: string) : string {
	const ext = extension || getFileExtension(url);
	const name = filename || url;
	return ext ? `${name}.${ext}` : name;
}

// ==================== 文件下载 ====================

/**
 * 下载文件到本地（已存在则直接返回路径）
 * @param url 文件 URL
 * @param options 可选配置
 * @param options.filename 文件名，默认使用 url
 * @param options.extension 扩展名，默认从 url 中提取
 * @param options.showLoading 是否显示加载提示，默认 true
 * @returns 本地文件路径
 */
export async function download(url : string, options ?: {
	filename ?: string;
	extension ?: string;
	showLoading ?: boolean;
}) : Promise<string> {
	const { filename, extension, showLoading = true } = options || {};
	const fileName = generateFilename(url, filename, extension);
	const filePath = `${path}/${fileName}`;

	// 检查文件是否已经存在
	const exists = await checkFileExists(filePath);
	if (exists) return filePath;

	// 文件不存在，开始下载
	return new Promise((resolve, reject) => {
		if (showLoading) {
			// 传 0 禁用兜底超时：文件下载时间不确定，不应受 API.timeout 限制
			uni.$loading.show({ title: '下载中...' }, 0);
		}

		uni.downloadFile({
			url: url,
			filePath: filePath,
			success: function (_res : any) {
				if (showLoading) uni.$loading.hide();
				resolve(filePath);
			},
			fail: function (error : any) {
				if (showLoading) uni.$loading.hide();
				console.error('下载文件失败：', error);
				uni.showToast({ icon: 'error', title: '下载失败' });
				reject(error);
			}
		});
	});
}

// ==================== 文件打开 ====================

/**
 * 下载并打开文件
 * @param url 文件 URL
 * @param options 可选配置（同 download 的 options）
 */
export function openUrl(url : string, options ?: {
	filename ?: string;
	extension ?: string;
	showLoading ?: boolean;
}) : void {
	download(url, options).then((filePath) => {
		uni.openDocument({
			filePath: filePath,
			showMenu: true,
			fail: function (error : any) {
				console.error('打开文件失败：', error);
				uni.showToast({ icon: 'error', title: '打开文件失败' });
			}
		});
	});
}

// ==================== 相册保存 ====================

/**
 * 保存网络图片到相册
 * @param url 图片 URL
 * @param options 可选配置
 * @param options.filename 文件名
 * @param options.extension 扩展名，默认 'png'
 * @param options.denyMessage 权限被拒绝时的提示文案
 */
export function saveNetworkImageToPhotosAlbum(url : string, options ?: {
	filename ?: string;
	extension ?: string;
	denyMessage ?: string;
}) : void {
	const { filename, extension = 'png', denyMessage = '请允许相册权限，拒绝将无法正常保存图片' } = options || {};

	download(url, { filename, extension, showLoading: true }).then((filePath) => {
		checkPermission('scope.writePhotosAlbum', denyMessage, () => {
			uni.saveImageToPhotosAlbum({
				filePath: filePath,
				success: function () {
					uni.showToast({ icon: 'success', title: '保存成功' });
				},
				fail: function (err : any) {
					console.error('保存到相册失败：', err);
					uni.showToast({ icon: 'error', title: '保存失败' });
				}
			});
		});
	});
}

/**
 * 保存 Base64 图片到相册
 * @param imageBase64 Base64 编码的图片数据（可含 data:image 前缀）
 * @param options 可选配置
 * @param options.filename 文件名
 * @param options.extension 扩展名，默认 'png'
 * @param options.showLoading 是否显示加载提示，默认 true
 * @param options.denyMessage 权限被拒绝时的提示文案
 */
export function saveBase64ImageToPhotosAlbum(imageBase64 : string, options ?: {
	filename ?: string;
	extension ?: string;
	showLoading ?: boolean;
	denyMessage ?: string;
}) : void {
	const { filename, extension = 'png', showLoading = true, denyMessage = '请允许相册权限，拒绝将无法正常保存图片' } = options || {};
	const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
	const timestamp = Date.now();
	const filePath = filename
		? `${path}/${filename}_${timestamp}.${extension}`
		: `${path}/${timestamp}.${extension}`;

	if (showLoading) {
		// 传 0 禁用兜底超时：Base64 写入时间不确定，不应受 API.timeout 限制
		uni.$loading.show({ title: '保存中', mask: true }, 0);
	}

	uni.getFileSystemManager().writeFile({
		filePath: filePath,
		data: base64,
		encoding: 'base64',
		success: () => {
			checkPermission('scope.writePhotosAlbum', denyMessage, () => {
				uni.saveImageToPhotosAlbum({
					filePath: filePath,
					success: function () {
						if (showLoading) uni.$loading.hide();
						uni.showToast({ icon: 'success', title: '保存成功' });
					},
					fail: function (err : any) {
						if (showLoading) uni.$loading.hide();
						console.error('保存到相册失败：', err);
						uni.showToast({ icon: 'error', title: '保存失败' });
					}
				});
			});
		},
		fail: (err : any) => {
			if (showLoading) uni.$loading.hide();
			console.error('写入文件失败：', err);
			uni.showToast({ icon: 'error', title: '创建文件失败' });
		}
	});
}

// ==================== 权限管理 ====================

/**
 * 检查并请求权限
 *
 * 流程：先检查是否已授权 → 未授权则请求授权 → 被拒绝则弹窗引导去设置页
 * @param permission 权限标识，如 'scope.writePhotosAlbum'
 * @param denyMessage 被拒绝时的提示文案
 * @param onGranted 授权成功后的回调
 */
export function checkPermission(permission : string, denyMessage : string, onGranted : () => void) : void {
	uni.getSetting({
		success(res) {
			if (res.authSetting[permission]) {
				// 已授权，直接执行
				onGranted();
			} else {
				// 未授权，请求授权
				uni.authorize({
					scope: permission,
					success() {
						onGranted();
					},
					fail() {
						// 用户拒绝，引导去设置页
						uni.showModal({
							content: denyMessage,
							showCancel: false,
							success() {
								uni.openSetting({
									success(res) {
										if (res.authSetting[permission]) {
											onGranted();
										} else {
											uni.showToast({ icon: 'error', title: '获取权限失败' });
										}
									}
								});
							}
						});
					}
				});
			}
		},
		fail(error) {
			console.error('获取设置失败：', error);
			uni.showToast({ icon: 'error', title: '获取权限失败' });
		}
	});
}