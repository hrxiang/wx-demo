/**
 * 测试环境配置
 *
 * 连接测试服务器，供测试人员验收使用，开启调试日志。
 * 对应 HBuilderX 运行菜单：「微信小程序：测试环境」
 */
import type { GlobEnvConfig } from './env.d';

const testConfig: GlobEnvConfig = {
	env: 'test',
	baseUrl: 'https://api-test.your-domain.com',
	appVersion: '1.0.0',
	debug: true,
};

export default testConfig;
