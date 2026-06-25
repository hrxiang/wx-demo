/**
 * 生产环境配置
 *
 * 连接正式服务器，发布上线时使用，关闭调试日志。
 * 对应 HBuilderX 发行菜单：「微信小程序：生产环境」
 */
import type { GlobEnvConfig } from './env.d';

const prodConfig: GlobEnvConfig = {
	env: 'production',
	baseUrl: 'https://api.your-domain.com',
	appVersion: '1.0.0',
	debug: false,
};

export default prodConfig;
