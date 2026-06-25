/**
 * 阿里云 OSS 上传工具
 *
 * 采用「服务端签名 + 客户端直传」方案：
 *   1. 前端向自己的业务服务端请求上传凭证（Policy + Signature）
 *   2. 前端拿到凭证后，用 uni.uploadFile 将文件直传到 OSS
 *   3. 业务服务端无需转发文件流，节省带宽，上传速度更快
 *
 * 为什么不在前端持有 AccessKey？
 *   小程序包可被逆向，直接写入 AccessKey 会导致 OSS 存储桶被恶意访问/写入，
 *   必须由服务端签名后再给前端使用。
 *
 * 上传流程：
 *   前端调用 uploadToOss()
 *     → 自动请求业务服务端获取签名凭证（OssCredential）
 *     → 构造 formData（key/policy/OSSAccessKeyId/signature 等）
 *     → uni.uploadFile 直传到 OSS
 *     → 返回文件的完整访问 URL
 *
 * 使用示例：
 *   import { uploadToOss, uploadImagesToOss } from '@/utils/oss'
 *
 *   // 上传单个文件
 *   const url = await uploadToOss('/path/to/local/image.jpg')
 *   console.log(url) // https://your-bucket.oss-cn-xxx.aliyuncs.com/uploads/xxx.jpg
 *
 *   // 上传单个文件，指定存储目录和文件名
 *   const url = await uploadToOss('/path/to/file.mp4', {
 *     dir: 'videos/',
 *     filename: 'my-video.mp4',
 *   })
 *
 *   // 批量上传多个图片文件
 *   const urls = await uploadImagesToOss(['/path/a.jpg', '/path/b.jpg'])
 *   console.log(urls) // ['https://...a.jpg', 'https://...b.jpg']
 *
 * 后端签名接口约定（GET /api/oss/credential）：
 *   返回 JSON：
 *   {
 *     "host":        "https://your-bucket.oss-cn-xxx.aliyuncs.com",
 *     "dir":         "uploads/",          // 服务端约定的上传目录前缀
 *     "policy":      "<base64 policy>",
 *     "signature":   "<hmac-sha1 签名>",
 *     "ossAccessKeyId": "<临时 AccessKeyId>",
 *     "expire":      1700000000           // Unix 时间戳，凭证过期时间
 *   }
 */

import { request } from '@/utils/request';

// ==================== 类型定义 ====================

/**
 * 服务端返回的 OSS 上传凭证
 *
 * 支持两种后端返回格式：
 *
 * 格式一（推荐）：后端直接返回完整 host
 *   { host, dir, policy, signature, ossAccessKeyId, expire }
 *
 * 格式二：后端返回 bucket + region，由前端拼出 host
 *   { bucket, region, dir, policy, signature, ossAccessKeyId, expire }
 *   → host 自动拼为 https://{bucket}.oss-{region}.aliyuncs.com
 *
 * 两种格式可共存，host 优先，没有 host 时自动用 bucket + region 拼接。
 */
export interface OssCredential {
	/**
	 * OSS Bucket 域名（格式一）
	 * 示例：https://your-bucket.oss-cn-hangzhou.aliyuncs.com
	 * 与 bucket + region 二选一，优先使用 host。
	 */
	host?: string;

	/**
	 * Bucket 名称（格式二）
	 * 示例：your-bucket
	 * 有 host 时此字段忽略。
	 */
	bucket?: string;

	/**
	 * OSS 所在地域（格式二）
	 * 示例：cn-hangzhou、cn-shanghai
	 * 有 host 时此字段忽略。
	 */
	region?: string;

	/** 服务端约定的上传目录前缀，如 uploads/ */
	dir: string;
	/** Base64 编码的上传策略 */
	policy: string;
	/** HMAC-SHA1 签名 */
	signature: string;
	/** 临时 AccessKeyId（STS）或 RAM 用户 AccessKeyId */
	ossAccessKeyId: string;
	/** 凭证过期时间（Unix 时间戳，秒） */
	expire: number;
}

/**
 * 上传单个文件的选项
 */
export interface UploadOptions {
	/**
	 * 上传目录前缀，覆盖服务端返回的 dir。
	 * 示例：'avatars/'、'docs/2024/'
	 * 不填则使用服务端返回的 dir。
	 */
	dir?: string;

	/**
	 * 指定上传后的文件名（不含目录），不填则自动生成带时间戳的唯一文件名。
	 * 示例：'profile.jpg'
	 */
	filename?: string;

	/**
	 * 上传进度回调（0 ~ 100）
	 * @param progress 当前进度百分比
	 */
	onProgress?: (progress: number) => void;
}

/**
 * 上传结果
 */
export interface UploadResult {
	/** 文件的完整访问 URL */
	url: string;
	/** 文件在 OSS 中的 key（相对路径），如 uploads/20241101_abc123.jpg */
	key: string;
}

// ==================== 凭证缓存 ====================

/**
 * 缓存的上传凭证（避免每次上传都请求一次服务端）
 *
 * 在凭证过期前复用同一份凭证，过期后自动重新获取。
 * 预留 30 秒余量，避免凭证在上传过程中恰好过期。
 */
let cachedCredential: OssCredential | null = null;
const CREDENTIAL_EXPIRE_BUFFER_SEC = 30;

/**
 * 判断缓存的凭证是否仍然有效
 */
function isCredentialValid(): boolean {
	if (!cachedCredential) return false;
	const nowSec = Date.now() / 1000;
	return cachedCredential.expire > nowSec + CREDENTIAL_EXPIRE_BUFFER_SEC;
}

// ==================== 核心工具函数 ====================

/**
 * 从凭证中解析出 OSS host
 *
 * 优先使用凭证中的 host 字段；
 * 若没有 host，则用 bucket + region 拼接标准域名。
 *
 * @param credential OSS 上传凭证
 * @returns OSS Bucket 域名，如 https://your-bucket.oss-cn-hangzhou.aliyuncs.com
 */
function resolveHost(credential: OssCredential): string {
	if (credential.host) {
		// 格式一：后端直接返回 host，去掉末尾斜杠
		return credential.host.replace(/\/$/, '');
	}
	if (credential.bucket && credential.region) {
		// 格式二：用 bucket + region 拼接标准 OSS 域名
		return `https://${credential.bucket}.oss-${credential.region}.aliyuncs.com`;
	}
	throw new Error('[OSS] 凭证缺少 host 或 bucket/region，无法确定上传地址');
}

/**
 * 从业务服务端获取 OSS 上传凭证
 *
 * 内部已做缓存，凭证有效期内不会重复请求服务端。
 * 缓存的凭证过期（含 30 秒提前量）后自动重新获取。
 *
 * @returns OssCredential 上传凭证
 */
async function getCredential(): Promise<OssCredential> {
	if (isCredentialValid()) {
		return cachedCredential!;
	}
	// 请求业务服务端获取签名凭证，接口路径按实际后端调整
	const credential = await request.get<OssCredential>('/api/oss/credential', {
		custom: { noAuth: false },
	});
	cachedCredential = credential;
	return credential;
}

/**
 * 生成唯一的文件名
 *
 * 格式：{时间戳}_{6位随机字符串}.{扩展名}
 * 示例：20241101153022_a3f9bc.jpg
 *
 * @param originalPath 原始文件路径或文件名，用于提取扩展名
 * @returns 生成的唯一文件名
 */
function generateFilename(originalPath: string): string {
	const ext = originalPath.split('.').pop()?.toLowerCase() || 'bin';
	const now = new Date();
	const timestamp = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, '0'),
		String(now.getDate()).padStart(2, '0'),
		String(now.getHours()).padStart(2, '0'),
		String(now.getMinutes()).padStart(2, '0'),
		String(now.getSeconds()).padStart(2, '0'),
	].join('');
	const random = Math.random().toString(36).slice(2, 8);
	return `${timestamp}_${random}.${ext}`;
}

// ==================== 上传函数 ====================

/**
 * 上传单个文件到 OSS
 *
 * @param filePath  本地文件路径（uni.chooseImage / uni.chooseVideo 返回的 tempFilePath）
 * @param options   上传选项（可选）
 * @returns         文件的完整访问 URL 和 OSS key
 *
 * @example
 *   // 选择图片后上传
 *   uni.chooseImage({
 *     count: 1,
 *     success: async ({ tempFilePaths }) => {
 *       const { url } = await uploadToOss(tempFilePaths[0])
 *       console.log('上传成功:', url)
 *     }
 *   })
 *
 *   // 指定目录和文件名
 *   const { url } = await uploadToOss(filePath, {
 *     dir: 'avatars/',
 *     filename: 'profile.jpg',
 *   })
 *
 *   // 监听上传进度
 *   const { url } = await uploadToOss(filePath, {
 *     onProgress: (p) => console.log(`上传进度: ${p}%`)
 *   })
 */
export async function uploadToOss(
	filePath: string,
	options: UploadOptions = {}
): Promise<UploadResult> {
	const credential = await getCredential();

	// 从凭证解析 OSS host（兼容 host 直传 和 bucket+region 两种格式）
	const host = resolveHost(credential);

	// 确定文件在 OSS 中的完整 key（目录 + 文件名）
	const dir = options.dir ?? credential.dir;
	const filename = options.filename ?? generateFilename(filePath);
	const key = `${dir}${filename}`;

	return new Promise((resolve, reject) => {
		const uploadTask = uni.uploadFile({
			url: host,                    // OSS Bucket 域名
			filePath,                     // 本地文件路径
			name: 'file',                 // OSS 要求的文件字段名固定为 'file'
			formData: {
				// OSS Policy 直传必须的表单字段
				key,                                       // 文件在 OSS 中的存储路径
				policy: credential.policy,                 // Base64 编码的上传策略
				OSSAccessKeyId: credential.ossAccessKeyId, // AccessKeyId
				signature: credential.signature,           // 签名
				success_action_status: '200',              // 上传成功返回 200（默认是 204）
			},
			success: (res) => {
				// OSS 直传成功的 statusCode 是 200（由 success_action_status 控制）
				if (res.statusCode === 200) {
					resolve({
						url: `${host}/${key}`,
						key,
					});
				} else {
					reject(new Error(`OSS 上传失败，状态码：${res.statusCode}`));
				}
			},
			fail: (err) => {
				reject(new Error(`OSS 上传失败：${err.errMsg}`));
			},
		});

		// 监听上传进度（如有回调则绑定）
		if (options.onProgress) {
			uploadTask.onProgressUpdate(({ progress }) => {
				options.onProgress!(progress);
			});
		}
	});
}

/**
 * 批量上传多个文件到 OSS
 *
 * 并发上传所有文件，全部完成后返回 URL 列表，顺序与入参一致。
 * 任意一个文件上传失败会导致整体 reject。
 *
 * @param filePaths 本地文件路径数组
 * @param options   上传选项（所有文件共用，dir 会自动区分文件名避免覆盖）
 * @returns         文件 URL 数组，顺序与 filePaths 一致
 *
 * @example
 *   uni.chooseImage({
 *     count: 9,
 *     success: async ({ tempFilePaths }) => {
 *       const urls = await uploadImagesToOss(tempFilePaths)
 *       console.log('全部上传成功:', urls)
 *     }
 *   })
 */
export async function uploadImagesToOss(
	filePaths: string[],
	options: Omit<UploadOptions, 'filename'> = {}
): Promise<string[]> {
	const results = await Promise.all(
		filePaths.map((filePath) => uploadToOss(filePath, options))
	);
	return results.map((r) => r.url);
}
