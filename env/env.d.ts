/**
 * 多环境配置类型声明
 *
 * 每套环境配置文件（env.dev.ts / env.test.ts / env.prod.ts）
 * 都必须实现此接口，保证字段统一、切换时不遗漏。
 */
export interface GlobEnvConfig {
	/**
	 * 当前环境标识
	 * - 'development' 开发环境
	 * - 'test'        测试环境
	 * - 'production'  生产环境
	 */
	env: 'development' | 'test' | 'production';

	/**
	 * 接口请求基础地址
	 * 示例：https://api-dev.your-domain.com
	 */
	baseUrl: string;

	/**
	 * 应用版本号，用于接口请求头 / 更新提示
	 * 示例：1.0.0
	 */
	appVersion: string;

	/**
	 * 是否开启调试日志（请求日志、路由日志等）
	 * 生产环境应设为 false
	 */
	debug: boolean;
}
