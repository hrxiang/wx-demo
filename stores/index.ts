/**
 * Pinia Store 统一导出入口
 *
 * 所有 store 在此统一导出，业务代码统一从这里导入：
 *   import { useUserStore } from '@/stores'
 *
 * 新增 store 时：
 *   1. 在 stores/ 目录下创建 xxx.ts（参考 user.ts）
 *   2. 在此处 export * from './xxx'
 */
export * from './user';
