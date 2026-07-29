/**
 * API 服务层统一入口
 *
 * 按业务模块组织所有接口调用，页面/组件统一从此处导入。
 *
 * ──────────────────────────────────────────────────────────────
 * 为什么需要 API 层（而不是在页面里直接调 request.get）？
 * ──────────────────────────────────────────────────────────────
 *
 * 问题（无 API 层）：
 *   页面A: request.get('/api/user/info')
 *   页面B: request.get('/api/user/info')   ← URL 重复，改路径要全局搜索
 *   页面C: request.get('/api/user/' + id)  ← URL 散落，拼接方式不统一
 *
 * 解决（有 API 层）：
 *   api/user.ts:  export const getUserInfo = () => request.get('/api/user/info')
 *   页面A: import { userApi } from '@/api'; userApi.getInfo()
 *   页面B: import { userApi } from '@/api'; userApi.getInfo()   ← 复用
 *   页面C: import { userApi } from '@/api'; userApi.getById(id) ← 统一封装
 *
 * 优势：
 *   1. URL 集中管理，修改接口路径只需改一处
 *   2. 请求/响应类型定义统一，编辑器自动提示
 *   3. 页面代码更简洁，只关心业务逻辑
 *   4. 方便做 mock 测试（替换 api 层即可）
 *
 * 使用方式：
 *   import { userApi } from '@/api'
 *   // @/api = @/api/index.ts，编译器自动补全了 /index，这是 TypeScript 的标准行为，不是特殊配置。
 *   const info = await userApi.getInfo()
 *   const list = await userApi.getList({ page: 1, size: 10 })
 *   await userApi.login({ username: 'admin', password: '123456' })
 *
 * 新增业务模块：
 *   1. 在 api/ 目录下创建 xxx.ts（参考 user.ts）
 *   2. 在此处 export * from './xxx'
 */
export * as userApi from './user';
