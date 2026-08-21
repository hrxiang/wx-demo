/**
 * 文件下载管理器
 *
 * 功能：
 *   - 多文件并发下载（默认最大 3 个同时下载）
 *   - 下载进度跟踪（实时回调 0-100%）
 *   - 取消下载（支持取消单个/全部）
 *   - LRU 缓存淘汰（最近最少使用优先删除）
 *   - 存储空间管理（上限 120MB，微信小程序用户目录限制 200MB）
 *   - 文件完整性校验（对比实际大小与接口返回大小）
 *   - 文件元数据持久化（URL、大小、路径、类型、最近使用时间）
 *   - 预览 / 分享操作自动更新最近使用时间
 *
 * 数据流：
 *
 *   ┌──────────┐    download(url)    ┌──────────────┐
 *   │  页面层   │ ──────────────────→ │  下载管理器   │
 *   │ (item组件) │                    │              │
 *   │           │ ←── status/record ── │  并发控制    │
 *   └──────────┘                     │  LRU 淘汰    │
 *                                    │  空间管理     │
 *                                    │  持久化       │
 *                                    └──────────────┘
 *
 * 存储结构（基于 wx.env.USER_DATA_PATH）：
 *
 *   {USER_DATA_PATH}/download_cache/
 *     ├── pdf/
 *     │   ├── abc123_report.pdf
 *     │   └── def456_contract.pdf
 *     ├── doc/
 *     │   └── ghi789_spec.docx
 *     └── other/
 *         └── jkl012_data.xlsx
 *
 * 使用示例：
 *
 *   import { downloadManager } from '@/utils/download-manager'
 *
 *   // 下载单个文件（带进度回调）
 *   const result = await downloadManager.download({
 *     url: 'https://example.com/report.pdf',
 *     fileSize: 1024000,
 *     onProgress: (progress, received) => {
 *       console.log(`下载进度: ${progress}%, 已下载: ${received} 字节`)
 *     },
 *   })
 *
 *   // 查询下载进度
 *   const p = downloadManager.getProgress('https://example.com/report.pdf')
 *   if (p) console.log(`进度: ${p.progress}%`)
 *
 *   // 取消下载
 *   downloadManager.cancel('https://example.com/report.pdf')
 *
 *   // 取消所有下载
 *   downloadManager.cancelAll()
 *
 *   // 批量下载
 *   const results = await downloadManager.downloadAll([
 *     { url: 'https://example.com/a.pdf', fileSize: 500000 },
 *     { url: 'https://example.com/b.docx', fileSize: 300000 },
 *   ])
 *
 *   // 查询下载状态（用于页面 item 显示"已下载"标识）
 *   const record = downloadManager.getRecord('https://example.com/report.pdf')
 *   if (record) { /* 已下载 *\/ }
 *
 *   // 预览文件（更新使用时间，返回记录，预览方式由调用方按 fileType 决定：
 *   // 图片用 uni.previewImage，文档用 uni.openDocument）
 *   const record = await downloadManager.preview('https://example.com/report.pdf')
 *   uni.openDocument({ filePath: record.filePath, fileType: record.fileType })
 *
 *   // 分享文件（自动更新最近使用时间）
 *   await downloadManager.share('https://example.com/report.pdf')
 */

// ==================== 类型定义 ====================

/** 下载参数 */
interface DownloadOptions {
  /** 文件 URL（唯一标识） */
  url: string
  /**
   * 预期文件大小（字节），用于完整性校验和空间预估
   * 可选：不传或传 0 则跳过大小校验，以实际下载大小为准
   */
  fileSize?: number
  /** 文件名（可选，不传则从 URL 提取） */
  fileName?: string
  /** 文件类型（可选，不传则从 URL 扩展名提取） */
  fileType?: string
  /** 进度回调：progress 为 0-100，received 为已下载字节数 */
  onProgress?: (progress: number, received: number) => void
}

/** 文件记录 */
interface FileRecord {
  /** 文件 URL（唯一标识） */
  url: string
  /** 本地存储路径 */
  filePath: string
  /** 文件大小（字节） */
  fileSize: number
  /** 文件类型（扩展名，如 'pdf'、'docx'） */
  fileType: string
  /** 文件名 */
  fileName: string
  /** 下载完成时间戳 */
  downloadTime: number
  /** 最近使用时间戳（预览/分享时更新） */
  lastUsedTime: number
  /** 记录状态：saving=文件保存中（未完成），completed=已完成 */
  status: 'saving' | 'completed'
}

/** 下载结果 */
interface DownloadResult {
  /** 是否成功 */
  success: boolean
  /** 文件记录（成功时） */
  record?: FileRecord
  /** 错误信息（失败时） */
  error?: string
}

/** 活跃下载任务（内部） */
interface ActiveDownload {
  /** 任务状态：queued=排队中（并发已满），downloading=下载中 */
  state: 'queued' | 'downloading'
  /** uni.downloadFile 返回的任务对象，用于取消和监听进度 */
  task: any
  /** 进度回调列表（支持多个页面/组件同时订阅） */
  onProgressCallbacks: Array<(progress: number, received: number) => void>
  /** 状态变化回调列表（queued → downloading 时通知，页面据此更新 UI） */
  onStateChangeCallbacks: Array<(state: 'queued' | 'downloading') => void>
  /** 当前进度 0-100 */
  progress: number
  /** 已下载字节数 */
  received: number
  /** 下载完成 Promise */
  promise: Promise<DownloadResult>
}

// ==================== 常量 ====================

/** 本地存储键：文件记录映射表 */
const STORAGE_KEY_RECORDS = '__download_records__'

/** 缓存子目录名 */
const CACHE_SUBDIR = 'download_cache'

/**
 * 获取文件存储根目录
 *
 * 必须在运行时调用（不能做模块级常量），因为 wx.env.USER_DATA_PATH
 * 在小程序启动后才可用。
 *
 * @returns 如 'http://usr/download_cache'
 */
function getSaveDir(): string {
  return `${wx.env.USER_DATA_PATH}/${CACHE_SUBDIR}`
}

/** 默认最大并发数 */
const DEFAULT_CONCURRENT = 3

/** 最大存储空间（字节）：120MB */
const MAX_STORAGE = 120 * 1024 * 1024

// ==================== 工具函数 ====================

/**
 * 从 URL 中提取文件扩展名
 *
 * @param url 文件 URL
 * @returns 小写扩展名，无法提取返回 'other'
 *
 * @example
 *   extractExt('https://example.com/report.pdf')       // 'pdf'
 *   extractExt('https://example.com/file.docx?v=1')     // 'docx'
 *   extractExt('https://example.com/noext')             // 'other'
 */
function extractExt(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const dot = pathname.lastIndexOf('.')
    if (dot >= 0) {
      return pathname.substring(dot + 1).toLowerCase()
    }
  } catch {
    // URL 解析失败，尝试简单正则
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/)
    if (match) return match[1].toLowerCase()
  }
  return 'other'
}

/**
 * 从 URL 中提取文件名
 *
 * @param url 文件 URL
 * @returns 文件名，无法提取返回 'file_{timestamp}'
 */
function extractFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      return decodeURIComponent(segments[segments.length - 1])
    }
  } catch {
    // ignore
  }
  return `file_${Date.now()}`
}

// ==================== DownloadManager ====================

/**
 * 文件下载管理器
 *
 * 单例模式，通过 `downloadManager` 导出使用。
 *
 * 核心机制：
 *   1. 并发控制 — 维护一个下载队列，最多同时下载 `concurrent` 个文件
 *   2. 空间管理 — 下载前检查已用空间，不足时按 LRU 淘汰旧文件
 *   3. 完整性校验 — 下载后对比实际文件大小与接口返回值
 *   4. 持久化 — 文件元数据通过 uni.setStorageSync 持久化
 */
class DownloadManager {
  /** 最大并发下载数 */
  private concurrent: number

  /** 存储空间上限（字节） */
  private storageLimit: number

  /**
   * 文件记录映射表：url → FileRecord
   *
   * 记录生命周期（对外仅成功下载可见，内部多一个 'saving' 瞬态）：
   *
   *   download() 调用
   *     │
   *     ├─ 排队中 / 下载中 ────────────── records 无记录
   *     │                                  （仅 downloading Map 有 ActiveDownload 占位）
   *     │
   *     ├─ HTTP 非200 / 网络失败 / 取消 ── records 无记录（从未写入）
   *     │
   *     ▼
   *   uni.downloadFile 成功（HTTP 200）
   *     │
   *     │  ★ 记录首次写入，status = 'saving'   ← 中间态！
   *     │    目的：防孤儿文件（小程序此时被杀，_load 能发现并处理）
   *     │
   *     ▼
   *   _saveFile 落盘
   *     ├─ 成功且校验通过 → status = 'completed'   ← 最终记录
   *     ├─ 文件为空       → records.delete → 无记录
   *     └─ 保存异常       → records.delete → 无记录
   *
   * 'saving' 瞬态的两个配套处理：
   *   - _load 启动恢复：发现 'saving' 记录时检查文件是否已落盘且有效，
   *     有效则升级为 completed，无效则删文件删记录
   *   - _evictLRU：跳过 'saving' 记录，防止正在写入的文件被淘汰后，
   *     完成回调把已删文件的记录"复活"
   */
  private records: Map<string, FileRecord>

  /** 当前正在下载的任务：url → ActiveDownload */
  private downloading: Map<string, ActiveDownload>

  /** 等待下载的队列 */
  private queue: Array<{
    options: DownloadOptions
    resolve: (result: DownloadResult) => void
  }>

  /** 当前活跃下载数 */
  private activeCount: number

  /** 已用存储空间（字节），内存缓存 */
  private totalUsed: number

  constructor(concurrent = DEFAULT_CONCURRENT, storageLimit = MAX_STORAGE) {
    this.concurrent = concurrent
    this.storageLimit = storageLimit
    this.records = new Map()
    this.downloading = new Map()
    this.queue = []
    this.activeCount = 0
    this.totalUsed = 0
    this._load()
  }

  // ==================== 公共 API ====================

  /**
   * 下载文件
   *
   * 流程：
   *   1. 已存在 → 直接返回记录
   *   2. 正在下载 → 返回同一个 Promise（避免重复下载）
   *   3. 并发已满 → 加入等待队列
   *   4. 有空位 → LRU 检查 → 开始下载
   *
   * @param options 下载参数
   * @returns 下载结果
   */
  download(options: DownloadOptions): Promise<DownloadResult> {
    const { url } = options

    // 1. 已下载完成，直接返回
    if (this.records.has(url)) {
      return Promise.resolve({ success: true, record: this.records.get(url) })
    }

    // 2. 正在下载中，复用同一个 Promise
    //    本次传入的 onProgress 不会被忽略：补注册到回调列表，
    //    与 subscribeProgress 的回调一样随任务完成时一并清理
    const existing = this.downloading.get(url)
    if (existing) {
      if (options.onProgress) existing.onProgressCallbacks.push(options.onProgress)
      return existing.promise
    }

    // 3. 先注册占位（必须在创建 Promise 之前：
    //    Promise executor 会同步调 _startDownload，
    //    其中需要 downloading.get(url) 取到 active 才能注册 onProgressUpdate，
    //    否则进度回调丢失，进度永远为 0）
    const active: ActiveDownload = {
      state: 'queued',
      task: null,
      onProgressCallbacks: options.onProgress ? [options.onProgress] : [],
      onStateChangeCallbacks: [],
      progress: 0,
      received: 0,
      promise: undefined as unknown as Promise<DownloadResult>,
    }
    this.downloading.set(url, active)

    // 4. 创建下载 Promise（executor 同步启动下载，此时占位已可用）
    const promise = new Promise<DownloadResult>((resolve) => {
      if (this.activeCount >= this.concurrent) {
        // 并发已满，排队等待
        this.queue.push({ options, resolve })
      } else {
        // 有空位，直接开始
        this._startDownload(options, resolve)
      }
    })

    active.promise = promise
    return promise
  }

  /**
   * 批量下载
   *
   * @param list 下载参数列表
   * @returns 每个文件的下载结果
   */
  downloadAll(list: DownloadOptions[]): Promise<DownloadResult[]> {
    return Promise.all(list.map((item) => this.download(item)))
  }

  /**
   * 订阅下载进度
   *
   * 用于页面切换后重新关联正在进行的下载任务。
   * 如果 URL 正在下载，立即返回当前进度，并注册回调接收后续更新。
   * 如果 URL 不在下载，返回 null。
   *
   * 注意：返回的 unsubscribe 必须在页面/组件销毁时调用，
   * 否则旧页面的回调会随页面重进不断累积（下载完成时才会随任务一并丢弃）。
   *
   * @param url 文件 URL
   * @param callback 进度回调
   * @returns 当前进度信息 + 退订函数，不在下载返回 null
   */
  subscribeProgress(
    url: string,
    callback: (progress: number, received: number) => void
  ): { progress: number; received: number; unsubscribe: () => void } | null {
    const active = this.downloading.get(url)
    if (!active) return null

    active.onProgressCallbacks.push(callback)
    return {
      progress: active.progress,
      received: active.received,
      unsubscribe: () => {
        const idx = active.onProgressCallbacks.indexOf(callback)
        if (idx >= 0) active.onProgressCallbacks.splice(idx, 1)
      },
    }
  }

  /**
   * 查询文件是否已下载（仅返回已完成的记录）
   *
   * @param url 文件 URL
   * @returns 已下载且完成返回 FileRecord，否则返回 null
   */
  getRecord(url: string): FileRecord | null {
    const record = this.records.get(url)
    return record && record.status === 'completed' ? record : null
  }

  /**
   * 查询文件是否已下载完成
   *
   * @param url 文件 URL
   */
  isDownloaded(url: string): boolean {
    const record = this.records.get(url)
    return record !== undefined && record.status === 'completed'
  }

  /**
   * 查询文件是否正在下载
   *
   * @param url 文件 URL
   */
  isDownloading(url: string): boolean {
    return this.downloading.has(url)
  }

  /**
   * 获取下载进度
   *
   * @param url 文件 URL
   * @returns 进度对象，未在下载返回 null
   */
  getProgress(url: string): { progress: number; received: number } | null {
    const active = this.downloading.get(url)
    if (!active) return null
    return { progress: active.progress, received: active.received }
  }

  /**
   * 获取任务状态（区分排队/下载中）
   *
   * 与 isDownloading 的区别：isDownloading 对排队和下载中都返回 true，
   * 本方法可区分并发已满时的排队任务。
   *
   * @param url 文件 URL
   * @returns 'queued'=排队中，'downloading'=下载中，null=无任务
   */
  getDownloadState(url: string): 'queued' | 'downloading' | null {
    const active = this.downloading.get(url)
    return active ? active.state : null
  }

  /**
   * 订阅状态变化（排队中 → 下载中）
   *
   * 排队任务被调度开始下载时回调，页面据此把「排队中」UI 切换为进度条。
   *
   * 注意：返回的 unsubscribe 必须在页面/组件销毁时调用（同 subscribeProgress）。
   *
   * @param url 文件 URL
   * @param callback 状态回调
   * @returns 当前状态 + 退订函数，无任务返回 null
   */
  subscribeStateChange(
    url: string,
    callback: (state: 'queued' | 'downloading') => void
  ): { state: 'queued' | 'downloading'; unsubscribe: () => void } | null {
    const active = this.downloading.get(url)
    if (!active) return null

    active.onStateChangeCallbacks.push(callback)
    return {
      state: active.state,
      unsubscribe: () => {
        const idx = active.onStateChangeCallbacks.indexOf(callback)
        if (idx >= 0) active.onStateChangeCallbacks.splice(idx, 1)
      },
    }
  }

  /**
   * 取消下载
   *
   * 取消正在下载或排队中的任务。已下载完成的文件不受影响。
   *
   * @param url 文件 URL
   * @returns 是否成功取消
   */
  cancel(url: string): boolean {
    const active = this.downloading.get(url)

    // 正在下载中 → 调用 abort 取消网络请求
    if (active) {
      if (active.task) {
        try {
          active.task.abort()
        } catch {
          // ignore
        }
      }
      this._downloadComplete(url, () => {}, {
        success: false,
        error: '已取消',
      })
      return true
    }

    // 在等待队列中 → 从队列移除
    const idx = this.queue.findIndex((t) => t.options.url === url)
    if (idx >= 0) {
      const task = this.queue.splice(idx, 1)[0]
      task.resolve({ success: false, error: '已取消' })
      return true
    }

    return false
  }

  /**
   * 取消所有下载
   *
   * 取消所有正在下载和排队中的任务。
   */
  cancelAll() {
    // 取消活跃任务
    for (const [url, active] of this.downloading) {
      if (active.task) {
        try {
          active.task.abort()
        } catch {
          // ignore
        }
      }
      this._downloadComplete(url, () => {}, {
        success: false,
        error: '已取消',
      })
    }

    // 取消排队任务
    for (const task of this.queue) {
      task.resolve({ success: false, error: '已取消' })
    }
    this.queue.length = 0
  }

  /**
   * 重置活跃下载状态（页面切换时调用）
   *
   * 清除内存中的下载追踪信息（downloading Map 和 queue），
   * 不影响已完成的文件记录（records），也不取消实际的网络请求。
   *
   * 使用场景：页面 onUnload 时调用，防止再次进入页面时
   * downloading Map 中残留旧 Promise 导致状态不同步。
   */
  resetActive() {
    this.downloading.clear()
    this.queue.length = 0
    this.activeCount = 0
  }

  /**
   * 获取所有已下载完成的文件记录
   */
  getAllRecords(): FileRecord[] {
    return Array.from(this.records.values()).filter((r) => r.status === 'completed')
  }

  /**
   * 预览文件
   *
   * 更新最近使用时间后返回文件记录，调用方根据记录信息自行预览。
   * 不在此处调用 uni.openDocument：它仅支持文档类（pdf/doc/xls/ppt 等），
   * 图片会直接报错，需改用 uni.previewImage —— 预览方式由调用方按
   * fileType 决定（同 share() 的轻模式）。
   * 最近使用时间用于 LRU 淘汰排序。
   *
   * @param url 文件 URL
   * @returns 文件记录（含 filePath、fileType）
   */
  async preview(url: string): Promise<FileRecord> {
    const record = this.records.get(url)
    if (!record) throw new Error('文件未下载')

    this._touchAccess(url)
    return record
  }

  /**
   * 分享文件
   *
   * 更新最近使用时间后返回文件记录，
   * 调用方根据记录信息执行具体分享逻辑。
   *
   * @param url 文件 URL
   * @returns 文件记录
   */
  async share(url: string): Promise<FileRecord> {
    const record = this.records.get(url)
    if (!record) throw new Error('文件未下载')

    this._touchAccess(url)
    return record
  }

  /**
   * 删除文件
   *
   * 从文件系统和记录中同时移除，释放存储空间。
   *
   * @param url 文件 URL
   * @returns 是否删除成功
   */
  async remove(url: string): Promise<boolean> {
    const record = this.records.get(url)
    if (!record) return false

    try {
      const fs = uni.getFileSystemManager()
      fs.removeSavedFile({
        filePath: record.filePath,
        success: () => {
          this.totalUsed -= record.fileSize
          this.records.delete(url)
          this._save()
        },
        fail: (err) => {
          console.error('[DownloadManager] 删除文件失败:', err)
          // 即使文件删除失败，也清理记录（文件可能已不存在）
          this.totalUsed -= record.fileSize
          this.records.delete(url)
          this._save()
        },
      })
      return true
    } catch (err) {
      console.error('[DownloadManager] 删除文件异常:', err)
      return false
    }
  }

  /**
   * 清空所有已下载文件
   *
   * 删除整个缓存目录和所有记录。
   */
  async clearAll(): Promise<void> {
    const fs = uni.getFileSystemManager()

    // 逐个删除文件
    for (const record of this.records.values()) {
      try {
        fs.removeSavedFile({ filePath: record.filePath })
      } catch {
        // ignore
      }
    }

    this.records.clear()
    this.totalUsed = 0
    this._save()
  }

  /**
   * 获取存储空间信息
   *
   * @returns 已用空间、总上限、剩余空间（字节）
   */
  getStorageInfo() {
    return {
      used: this.totalUsed,
      limit: this.storageLimit,
      available: this.storageLimit - this.totalUsed,
    }
  }

  /**
   * 设置最大并发数
   *
   * @param n 并发数
   */
  setConcurrent(n: number) {
    this.concurrent = Math.max(1, n)
  }

  // ==================== 下载核心 ====================

  /**
   * 启动下载
   *
   * @param options 下载参数
   * @param resolve Promise 的 resolve 回调
   */
  private _startDownload(options: DownloadOptions, resolve: (result: DownloadResult) => void) {
    this.activeCount++
    const { url } = options
    const fileSize = options.fileSize || 0
    const fileType = options.fileType || extractExt(url)
    const fileName = options.fileName || extractFileName(url)

    // 状态：排队中 → 下载中，通知订阅者（页面更新 UI）
    const entry = this.downloading.get(url)
    if (entry) {
      entry.state = 'downloading'
      for (const cb of entry.onStateChangeCallbacks) {
        cb('downloading')
      }
    }

    // 检查：单文件是否超过总容量（先检查，避免无意义的 LRU 淘汰）
    if (fileSize > this.storageLimit) {
      this._downloadComplete(url, resolve, {
        success: false,
        error: `文件大小(${this._formatSize(fileSize)})超过存储上限(${this._formatSize(this.storageLimit)})`,
      })
      return
    }

    // LRU 淘汰：确保有足够空间（totalUsed 已含所有在途任务的预占，
    // 排队任务出队时同样会走这里，基数准确）
    const neededSpace = fileSize - (this.storageLimit - this.totalUsed)
    if (neededSpace > 0) {
      this._evictLRU(neededSpace)
    }

    // 预占空间：下载开始即计入占用，防止并发/排队任务的 LRU 判断
    // 遗漏在途占用导致超卖（多个任务合计超过存储上限，保存时才失败）
    // 对应释放点：HTTP 非200、网络失败/取消 abort、保存失败
    // 对应修正点：下载成功后按实际大小修正差值
    this.totalUsed += fileSize

    // 调用 uni.downloadFile（返回 DownloadTask，可监听进度、取消下载）
    const task = uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) {
          this.totalUsed -= fileSize // 释放预占
          this._downloadComplete(url, resolve, {
            success: false,
            error: `HTTP ${res.statusCode}`,
          })
          return
        }

        // 先写入记录（status: 'saving'），防止小程序退出导致孤儿文件
        const now = Date.now()
        const targetPath = `${getSaveDir()}/${fileType}/${fileName}`
        const record: FileRecord = {
          url,
          filePath: targetPath,
          fileSize,
          fileType,
          fileName,
          downloadTime: now,
          lastUsedTime: now,
          status: 'saving',
        }
        this.records.set(url, record)
        // 注意：totalUsed 不再加 fileSize，预占时已计入
        this._save()

        // 保存到持久化目录
        this._saveFile(res.tempFilePath, fileType, fileName)
          .then(({ filePath, actualSize }) => {
            // 完整性校验（仅在提供了预期大小且实际大小异常时拦截）
            if (fileSize > 0 && actualSize === 0) {
              // 文件为空，下载肯定失败
              this._removeFile(filePath)
              this.totalUsed -= fileSize // 释放预占
              this.records.delete(url)
              this._save()
              this._downloadComplete(url, resolve, {
                success: false,
                error: `下载失败：文件为空`,
              })
              return
            }

            // 预占修正为实际大小（接口预估与真实大小有偏差时）
            const finalSize = actualSize > 0 ? actualSize : fileSize
            this.totalUsed += finalSize - fileSize
            record.fileSize = finalSize
            record.filePath = filePath
            record.status = 'completed'
            this._save()

            // 兕底：未提供预期大小（预占为 0）时实际记账可能超限，
            // 按 LRU 淘汰到限额内（刚下载的文件 lastUsedTime 最新，不会被误删）
            if (this.totalUsed > this.storageLimit) {
              this._evictLRU(this.totalUsed - this.storageLimit)
            }

            this._downloadComplete(url, resolve, { success: true, record })
          })
          .catch((err) => {
            // 保存失败，清理记录并释放预占
            this.totalUsed -= fileSize
            this.records.delete(url)
            this._save()
            this._downloadComplete(url, resolve, {
              success: false,
              error: err.message || '保存失败',
            })
          })
      },
      fail: (err) => {
        this.totalUsed -= fileSize // 释放预占（网络失败/取消 abort 都走这里）
        this._downloadComplete(url, resolve, {
          success: false,
          error: err.errMsg || '下载失败',
        })
      },
    })

    // 保存 DownloadTask 引用（用于取消和进度监听）
    const active = this.downloading.get(url)
    if (active) {
      active.task = task
      task.onProgressUpdate((res: any) => {
        if (active) {
          active.progress = res.progress
          active.received = res.totalBytesWritten
          // 通知所有订阅者（页面切换后新页面通过 subscribeProgress 重新订阅）
          for (const cb of active.onProgressCallbacks) {
            cb(res.progress, res.totalBytesWritten)
          }
        }
      })
    }
  }

  /**
   * 下载完成后的清理工作
   *
   * 1. 从 downloading 中移除
   * 2. 通知调用方（resolve）
   * 3. 处理队列中的下一个任务
   *
   * 幂等保护：取消场景下 cancel() 同步调用一次，abort 触发的
   * fail 回调异步再调一次，只让第一个生效，
   * 防止 activeCount 重复扣减导致并发位泄漏。
   */
  private _downloadComplete(url: string, resolve: (result: DownloadResult) => void, result: DownloadResult) {
    if (!this.downloading.has(url)) return
    this.downloading.delete(url)
    resolve(result)
    this.activeCount--
    this._processQueue()
  }

  /**
   * 处理等待队列
   *
   * 当有下载完成释放并发位时，按 FIFO 顺序启动下一个等待任务。
   */
  private _processQueue() {
    while (this.activeCount < this.concurrent && this.queue.length > 0) {
      const task = this.queue.shift()!
      this._startDownload(task.options, task.resolve)
    }
  }

  // ==================== LRU 淘汰 ====================

  /**
   * LRU 淘汰：删除最近最少使用的文件，直到腾出足够空间
   *
   * 算法：
   *   1. 将所有已下载文件按 lastUsedTime 升序排列
   *   2. 从最久未使用的文件开始删除
   *   3. 直到腾出的空间 >= 需要的空间
   *
   * @param neededSpace 需要腾出的空间（字节）
   */
  private _evictLRU(neededSpace: number) {
    let freed = 0
    const sorted = Array.from(this.records.values()).sort((a, b) => a.lastUsedTime - b.lastUsedTime)

    for (const record of sorted) {
      if (freed >= neededSpace) break

      // 保存中的文件不参与淘汰：文件可能正被写入，
      // 淘汰后其完成回调会把已删文件的记录复活
      if (record.status !== 'completed') continue

      console.log(
        `[DownloadManager] LRU 淘汰: ${record.fileName} (上次使用: ${new Date(record.lastUsedTime).toLocaleString()})`
      )

      this._removeFile(record.filePath)
      this.totalUsed -= record.fileSize
      freed += record.fileSize
      this.records.delete(record.url)
    }

    if (freed > 0) this._save()
  }

  // ==================== 文件操作 ====================

  /**
   * 保存文件到持久化目录
   *
   * 从临时路径移动到自定义目录，按文件类型分子目录存放。
   *
   * @param tempFilePath 临时文件路径
   * @param fileType 文件类型（扩展名）
   * @param fileName 文件名
   * @returns 最终路径和实际文件大小
   */
  private _saveFile(
    tempFilePath: string,
    fileType: string,
    fileName: string
  ): Promise<{ filePath: string; actualSize: number }> {
    return new Promise((resolve, reject) => {
      const fs = uni.getFileSystemManager()

      // 确保目录存在
      try {
        fs.accessSync(`${getSaveDir()}/${fileType}`)
      } catch {
        try {
          fs.mkdirSync(`${getSaveDir()}/${fileType}`, true)
        } catch (err) {
          reject(new Error('创建目录失败'))
          return
        }
      }

      const targetPath = `${getSaveDir()}/${fileType}/${fileName}`

      fs.saveFile({
        tempFilePath,
        filePath: targetPath,
        success: () => {
          // 获取实际文件大小
          let actualSize = 0
          try {
            const stat = fs.statSync(targetPath)
            actualSize = stat.size
          } catch {
            // stat 不可用时，后续完整性校验会失败
          }
          resolve({ filePath: targetPath, actualSize })
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '保存文件失败'))
        },
      })
    })
  }

  /**
   * 删除单个文件（仅文件系统操作，不更新记录）
   */
  private _removeFile(filePath: string) {
    try {
      const fs = uni.getFileSystemManager()
      fs.removeSavedFile({ filePath })
    } catch {
      // ignore
    }
  }

  // ==================== 访问时间 ====================

  /**
   * 更新文件的最近使用时间
   *
   * 预览、分享操作时调用，影响 LRU 淘汰顺序。
   *
   * @param url 文件 URL
   */
  private _touchAccess(url: string) {
    const record = this.records.get(url)
    if (record) {
      record.lastUsedTime = Date.now()
      this._save()
    }
  }

  // ==================== 持久化 ====================

  /**
   * 将文件记录持久化到本地存储
   */
  private _save() {
    try {
      const obj: Record<string, FileRecord> = {}
      for (const [url, record] of this.records) {
        obj[url] = record
      }
      uni.setStorageSync(STORAGE_KEY_RECORDS, JSON.stringify(obj))
    } catch (err) {
      console.error('[DownloadManager] 持久化失败:', err)
    }
  }

  /**
   * 从本地存储加载文件记录
   *
   * 启动时校验所有文件完整性（一条记录从生到死的校验时间线）：
   *
   *   下载会话内：
   *     网络 200 → 写入 saving → 落盘 → 大小校验 → completed → 持久化
   *                                                  ↑
   *                                          （第 1 次：下载时校验）
   *
   *   下次启动 _load()：
   *     ┌─ 读到 saving     → 第 1 步：文件完整？→ 是：转正 completed
   *     │                                     → 否：清理
   *     │                        ↑
   *     │              （第 2 次：恢复校验，宽松 — 无预期大小时非空即收）
   *
   *     └─ 读到 completed  → 第 3 步：文件还在吗（access）？大小还一样吗（stat）？
   *                                        → 是：照常加载
   *                                        → 否：清理
   *                           ↑
   *                   （第 3 次：完好性巡检，严格 — 大小必须完全相等）
   *
   *   分支 A（saving）与分支 B（completed）互斥，同一条记录只走其一。
   *
   *   - 第 1 步宽松：saving 本就不算成品，恢复是"捡漏"，
   *     没预期大小可比时非空就收（stat.size > 0 && (fileSize === 0 || 相等)）
   *   - 第 3 步严格：completed 只代表上次退出时文件是好的，
   *     记录（Storage）与文件（磁盘）是独立存储，
   *     退出后文件可能被损坏/截断/清掉，记录不会自己知道，
   *     所以启动时必须用记录里存的大小做指纹比对
   */
  private _load() {
    try {
      const raw = uni.getStorageSync(STORAGE_KEY_RECORDS)
      if (!raw) return

      const obj = JSON.parse(raw) as Record<string, FileRecord>
      const fs = uni.getFileSystemManager()
      let needSave = false

      for (const url of Object.keys(obj)) {
        const record = obj[url]

        // 1. 上次下载未完成（小程序退出时正在保存）
        if (record.status !== 'completed') {
          // 检查文件是否已保存成功（后台下载完成但未来得及更新状态）
          let fileValid = false
          try {
            fs.accessSync(record.filePath)
            const stat = fs.statSync(record.filePath)
            if (stat.size > 0 && (record.fileSize === 0 || stat.size === record.fileSize)) {
              // 文件存在且大小匹配，标记为完成
              record.status = 'completed'
              record.fileSize = stat.size
              this.records.set(url, record)
              this.totalUsed += record.fileSize
              fileValid = true
              needSave = true
              console.log(`[DownloadManager] 恢复后台完成的下载: ${record.fileName}`)
            }
          } catch {
            // 文件不存在
          }

          if (!fileValid) {
            console.log(`[DownloadManager] 清理未完成记录: ${record.fileName}`)
            this._removeFile(record.filePath)
            delete obj[url]
            needSave = true
          }
          continue
        }

        // 2. 校验文件是否存在
        try {
          fs.accessSync(record.filePath)
        } catch {
          console.log(`[DownloadManager] 文件不存在，清理记录: ${record.fileName}`)
          delete obj[url]
          needSave = true
          continue
        }

        // 3. 校验文件大小是否一致
        try {
          const stat = fs.statSync(record.filePath)
          if (stat.size !== record.fileSize) {
            console.log(
              `[DownloadManager] 文件大小不一致(${stat.size} != ${record.fileSize})，清理: ${record.fileName}`
            )
            this._removeFile(record.filePath)
            delete obj[url]
            needSave = true
            continue
          }
        } catch {
          // stat 失败，保守处理：保留记录
        }

        // 校验通过，加载记录
        this.records.set(url, record)
        this.totalUsed += record.fileSize
      }

      // 如果有清理操作，更新持久化存储
      if (needSave) {
        uni.setStorageSync(STORAGE_KEY_RECORDS, JSON.stringify(obj))
      }
    } catch (err) {
      console.error('[DownloadManager] 加载记录失败:', err)
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 格式化文件大小为可读字符串
   *
   * @param bytes 字节数
   * @returns 如 '1.5 MB'、'200 KB'
   */
  private _formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }
}

// ==================== 导出 ====================

/** 默认实例（单例） */
export const downloadManager = new DownloadManager()

/** 类型导出（供外部使用） */
export type { DownloadOptions, FileRecord, DownloadResult, ActiveDownload }

/** 类导出（供需要自定义配置时使用） */
export { DownloadManager }
