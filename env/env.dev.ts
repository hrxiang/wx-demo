/**
 * 开发环境配置
 *
 * 本地开发时使用，连接开发服务器，开启调试日志。
 * 对应 HBuilderX 运行菜单：「微信小程序：开发环境」
 */
import type { GlobEnvConfig } from './env.d';

const devConfig: GlobEnvConfig = {
	env: 'development',
	baseUrl: 'https://api-dev.your-domain.com',
	appVersion: '1.0.0',
	debug: true,
};

export default devConfig;
