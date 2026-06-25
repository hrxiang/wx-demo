/**
 * 环境配置统一入口
 *
 * 【工作原理】
 * HBuilderX 运行菜单选择不同环境时，package.json 的 define 字段会注入
 * 对应的条件编译常量（ENV-DEV / ENV-TEST / ENV-PROD），
 * uni-app 编译时只保留命中的那个分支代码，未命中分支会被完全裁剪掉。
 *
 * 选择「微信小程序：开发环境」→ 注入 ENV-DEV  → 编译保留 dev 分支
 * 选择「微信小程序：测试环境」→ 注入 ENV-TEST → 编译保留 test 分支
 * 选择「微信小程序：生产环境」→ 注入 ENV-PROD → 编译保留 prod 分支
 * 直接运行「微信小程序」（无自定义菜单）→ 三个 define 都没有 → fallback 到 dev
 *
 * 使用方式（项目代码统一从此处导入）：
 *   import { envConfig } from '@/env'
 *   console.log(envConfig.baseUrl)  // 输出当前环境的接口地址
 */
import type { GlobEnvConfig } from './env.d';
import devConfig from './env.dev';
import testConfig from './env.test';
import prodConfig from './env.prod';

// 根据编译时注入的 define 常量选择对应配置
// 注意：条件编译块内不能有 import，所以在外部 import 全部配置，再在块内赋值
let _config: GlobEnvConfig = devConfig; // 默认开发环境（直接运行时 fallback）

// #ifdef ENV-TEST
_config = testConfig;
// #endif

// #ifdef ENV-PROD
_config = prodConfig;
// #endif

// #ifdef ENV-DEV
_config = devConfig;
// #endif

export const envConfig: GlobEnvConfig = _config;

export type { GlobEnvConfig };
