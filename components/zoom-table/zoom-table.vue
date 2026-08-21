<!--
  zoom-table — 基于 position: sticky 的可缩放表格组件
  =====================================================

  ▸ 功能
    - 水平 + 垂直滚动（单 scroll-view 双向滚动）
    - 冻结表头（顶部固定，sticky）
    - 冻结首列（左侧固定，sticky）
    - 冻结左上角交叉单元格（top + left 双重 sticky）
    - 手势双指缩放 / 外部按钮缩放
    - 上下插槽（ztTop / ztBottom）
    - 奇偶行交替色

  ▸ 架构示意（单层 scroll-view，所有行列在同一滚动容器内）

    ┌─────────────────────────────────────────────────────────┐
    │  ztTop 插槽（工具栏、说明文字等，不参与滚动）              │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │  scroll-view（scroll-x + scroll-y）                     │
    │  ┌──────────────┬──────────────────────────────────┐    │
    │  │ zt-corner-   │  zt-header（sticky: top:0）      │    │
    │  │ cell         │  position: sticky; top: 0;       │    │
    │  │ sticky:      │  z-index: 10;                    │    │
    │  │  top+left    │  表头行，水平滚动时跟随          │    │
    │  │  z-index: 30 │                                  │    │
    │  ├──────────────┼──────────────────────────────────┤    │
    │  │ zt-fc-cell   │  zt-d-cell（普通数据单元格）      │    │
    │  │ sticky:      │  随 scroll-view 自由滚动        │    │
    │  │  left: 0     │                                 │    │
    │  │ 首列，垂直   │                                 │    │
    │  │ 滚动时跟随   │                                 │    │
    │  ├──────────────┼──────────────────────────────────┤    │
    │  │ zt-fc-cell   │  zt-d-cell                      │    │
    │  │ (sticky left)│  （普通数据行）                  │    │
    │  └──────────────┴──────────────────────────────────┘    │
    │                                                         │
    ├─────────────────────────────────────────────────────────┤
    │  ztBottom 插槽                                          │
    └─────────────────────────────────────────────────────────┘

  ▸ sticky 工作原理

    在同一个 scroll-view 内，position: sticky 的元素在滚动到
    指定阈值（top/left）时会"粘住"，不再跟随滚动：

    垂直滚动时：                       水平滚动时：
    ┌────────┬────────────┐           ┌─────────────────┐
    │ 首列   │ 数据 ← sticky left:0  │←←← 数据滚动 ←←←│
    │ 固定   │ 数据       │           │  sticky left:0   │
    │        │ 数据       │           │  首列保持可见     │
    └────────┴────────────┘           └─────────────────┘

    双向滚动时（角标单元格）：
    ┌────────┬────────────┐
    │ 角标   │ 表头       │  ← sticky top:0（表头粘住顶部）
    │ sticky │ sticky     │
    │ top+   │ left:0     │
    │ left:0 │            │
    ├────────┼────────────┤
    │ 首列   │ 数据       │  ← 自由滚动区域
    │ sticky │            │
    │ left:0 │            │
    └────────┴────────────┘

  ▸ 使用方式

    <zoom-table :columns="columns" :data="data">
      <template #ztTop>
        <view>自定义工具栏</view>
      </template>
      <template #ztBottom>
        <view>底部内容</view>
      </template>
    </zoom-table>

    columns: [{ key: 'name', title: '姓名', width: 200, align: 'left' }, ...]
              // width 单位 rpx；align 可选 'left'|'center'|'right'（默认 center）
    data:    [{ name: '张三', age: 18, ... }, ...]
-->

<template>
  <view class="zoom-table">
    <!-- ====== 顶部插槽：可放置工具栏、缩放按钮、说明文字等 ====== -->
    <slot name="ztTop" />

    <!--
      ====== 表格主体：唯一的 scroll-view ======

      核心思路：
      所有表头行和数据行都放在同一个 scroll-view 内，
      通过 CSS position: sticky 实现表头/首列冻结，
      无需多个 scroll-view 之间的滚动同步。

      属性说明：
        scroll-x / scroll-y  — 启用双向滚动
        enhanced             — 启用增强模式（iOS 上更流畅）
        using-sticky         — 告知 scroll-view 内部使用 sticky 布局
        show-scrollbar       — 显示滚动条，提示用户可滚动
    -->
    <scroll-view
      class="zt-scroll"
      :scroll-x="true"
      :scroll-y="true"
      :enhanced="true"
      :using-sticky="true"
      :show-scrollbar="true"
      @scroll="onScroll"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!--
        内部容器（zt-inner）
        ─────────────────
        宽度 = 所有列宽之和 × scale（rpx）
        高度 = 由行内容自动撑开

        必须显式设置 width，否则 flex 子元素不会横向溢出，
        scroll-x 将无内容可滚动。
      -->
      <view class="zt-inner" :style="innerStyle">
        <!--
          ┌─────────────────────────────────────────────────────┐
          │ 表头行（zt-header）                                  │
          │                                                     │
          │ position: sticky; top: 0; z-index: 10              │
          │                                                     │
          │ 垂直滚动时粘在顶部，水平滚动时跟随内容一起滚动。      │
          │ 第一个单元格（i===0）同时是角标，见 zt-corner-cell。  │
          └─────────────────────────────────────────────────────┘
        -->
        <view class="zt-row zt-header">
          <view
            v-for="(col, i) in columns"
            :key="`head_${i}`"
            class="zt-cell zt-h-cell"
            :class="{ 'zt-corner-cell': i === 0 }"
            :style="cellStyle(col.width, true, undefined, col.align)"
          >
            <slot name="ztHeadCell" :col="col" :colIndex="i">
              {{ col.title }}
            </slot>
          </view>
        </view>

        <!--
          ┌─────────────────────────────────────────────────────┐
          │ 数据行                                               │
          │                                                     │
          │ 每行是一个 flex 容器，单元格从左到右排列。            │
          │ 第一个单元格（colIndex===0）class=zt-fc-cell，       │
          │ 使用 sticky left:0 冻结在左侧。                     │
          │                                                     │
          │ 奇偶行通过 zt-even 类名切换交替色。                   │
          └─────────────────────────────────────────────────────┘
        -->
        <view
          v-for="(row, rowIndex) in data"
          :key="`row_${rowIndex}`"
          class="zt-row"
          :class="{ 'zt-even': rowIndex % 2 === 1 }"
        >
          <view
            v-for="(col, colIndex) in columns"
            :key="`cell_${rowIndex}_${colIndex}`"
            class="zt-cell zt-d-cell"
            :class="{ 'zt-fc-cell': colIndex === 0 }"
            :style="[cellStyle(col.width, false, resolveRowHeight(row, rowIndex), col.align), getRowStyle(row, rowIndex)]"
          >
            <slot name="ztBodyCell" :row="row" :col="col" :rowIndex="rowIndex" :colIndex="colIndex">
              {{ row[col.key] }}
            </slot>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- ====== 底部插槽 ====== -->
    <slot name="ztBottom" />
  </view>
</template>

<script>
  /**
   * zoom-table — 基于 position: sticky 的可缩放表格组件
   *
   * 核心架构：
   *   单个 scroll-view 包含全部表头 + 数据行，
   *   通过 CSS sticky 冻结表头（top:0）和首列（left:0），
   *   无需多 scroll-view 之间的滚动同步。
   *
   * Props:
   *   columns   - 列定义 [{ key, title, width }]  width 单位 rpx
   *   data      - 行数据 [{ [key]: value, ... }]
   *   minScale  - 最小缩放比例（默认 0.5）
   *   maxScale  - 最大缩放比例（默认 2.0）
   *   scaleStep   - 按钮缩放步进（默认 0.1）
   *   rowHeight   - 数据行高（rpx 或函数，默认 80）
   *   headerHeight - 表头行高（rpx，默认 88）
   *   fontSize    - 基础字号（rpx，默认 24）
   *   cellPadding - 单元格水平内边距（rpx，默认 16）
   *   rowStyle    - 行样式（对象或函数，默认 null）
   *
   * 对外暴露方法（供父组件 ref 调用）：
   *   zoomIn()     - 放大
   *   zoomOut()    - 缩小
   *   resetScale() - 重置缩放
   */

  export default {
    name: 'zoom-table',

    props: {
      /**
       * 列定义：[{ key: 'name', title: '姓名', width: 200, align: 'left' }, ...]
       * align 可选 'left' | 'center' | 'right'，默认 center，表头与数据单元格共用
       */
      columns: {
        type: Array,
        required: true,
      },

      /** 行数据：[{ name: '张三', age: 18, ... }, ...] */
      data: {
        type: Array,
        default: () => [],
      },

      /** 最小缩放比例 */
      minScale: {
        type: Number,
        default: 0.5,
      },

      /** 最大缩放比例 */
      maxScale: {
        type: Number,
        default: 2.0,
      },

      /** 按钮缩放步进 */
      scaleStep: {
        type: Number,
        default: 0.1,
      },

      /**
       * 数据行高（rpx）
       * 支持数字（所有行统一高度）或函数 (row, rowIndex) => number（按行定制高度）
       */
      rowHeight: {
        type: [Number, Function],
        default: 80,
      },

      /** 表头行高（rpx） */
      headerHeight: {
        type: Number,
        default: 88,
      },

      /** 基础字号（rpx） */
      fontSize: {
        type: Number,
        default: 24,
      },

      /** 单元格水平内边距（rpx） */
      cellPadding: {
        type: Number,
        default: 16,
      },

      /**
       * 行样式
       * 支持对象（所有行统一样式）或函数 (row, rowIndex) => styleObject（按行定制）
       *
       * 示例：
       *   对象：:row-style="{ background: '#f5f5f5' }"
       *   函数：:row-style="(row, i) => row.status === '离职' ? { background: '#ffe0e0' } : {}"
       */
      rowStyle: {
        type: [Object, Function],
        default: null,
      },
    },

    data() {
      return {
        scale: 1, // 当前缩放比例
        _pinch: false, // 是否正在进行双指缩放
        _tsDist: 0, // touchstart 时两指距离
        _tScale: 1, // touchstart 时的 scale 值（缩放基准）
      }
    },

    computed: {
      /**
       * 所有列总宽度（rpx）
       *
       * 计算方式：各列 width 之和 × scale
       * 这个值赋给 zt-inner 的 width，使内容宽度随缩放动态变化
       */
      totalWidth() {
        return this.columns.reduce((sum, col) => sum + col.width, 0) * this.scale
      },

      /**
       * 内部容器样式
       *
       * width 必须显式设置（rpx），确保：
       *   1. 内容宽度 > scroll-view 视口宽度 → 触发水平滚动
       *   2. 缩放时宽度同步变化
       *
       * height 不设，由行内容自动撑开 → 触发垂直滚动
       */
      innerStyle() {
        return {
          width: this.totalWidth + 'rpx',
        }
      },
    },

    methods: {
      // ==================== 单元格样式 ====================

      /**
       * 计算单元格内联样式
       *
       * @param {number} baseWidth  - 列基础宽度（rpx，来自 columns[].width）
       * @param {boolean} isHeadCell - 是否为表头单元格
       * @param {number} rowH - 数据行高（表头单元格传 undefined）
       * @param {string} align - 列对齐方式（来自 columns[].align，可选）
       * @returns {object} 样式对象
       *
       * 所有尺寸都乘以 scale，实现等比缩放：
       *   - 宽度、高度、字号、内边距同步缩放
       *   - 使用 toFixed(0) 取整，避免小数像素
       */
      cellStyle(baseWidth, isHeadCell, rowH, align) {
        const w = (baseWidth * this.scale).toFixed(0)
        const h = ((isHeadCell ? this.headerHeight : rowH) * this.scale).toFixed(0)
        const fs = (this.fontSize * this.scale).toFixed(0)
        const pad = (this.cellPadding * this.scale).toFixed(0)
        // 水平对齐：单元格是 flex 布局，对齐方式映射到主轴 justify-content
        const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' }
        return {
          width: w + 'rpx',
          // minWidth: w + 'rpx',
          height: h + 'rpx',
          fontSize: fs + 'rpx',
          padding: `0 ${pad}rpx`,
          justifyContent: justifyMap[align] || 'center',
        }
      },

      /**
       * 获取行自定义样式
       *
       * 如果传入了 rowStyle 函数，则调用它获取行样式；
       * 否则返回空对象，不影响默认样式。
       *
       * @param {object} row - 行数据
       * @param {number} rowIndex - 行索引
       * @returns {object} 样式对象
       */
      getRowStyle(row, rowIndex) {
        if (!this.rowStyle) return {}
        return typeof this.rowStyle === 'function' ? this.rowStyle(row, rowIndex) : this.rowStyle
      },

      /**
       * 解析行高
       *
       * rowHeight 支持两种类型：
       *   - Number：所有行统一高度
       *   - Function：(row, rowIndex) => number，按行定制高度
       *
       * 返回值为基础高度（未乘 scale），cellStyle 中统一乘以 scale。
       *
       * @param {object} row - 行数据
       * @param {number} rowIndex - 行索引
       * @returns {number} 行高（rpx）
       */
      resolveRowHeight(row, rowIndex) {
        return typeof this.rowHeight === 'function' ? this.rowHeight(row, rowIndex) : this.rowHeight
      },

      // ==================== 缩放控制（供外部 ref 调用） ====================

      /** 放大一档 */
      zoomIn() {
        this.scale = Math.min(this.maxScale, +(this.scale + this.scaleStep).toFixed(2))
      },

      /** 缩小一档 */
      zoomOut() {
        this.scale = Math.max(this.minScale, +(this.scale - this.scaleStep).toFixed(2))
      },

      /** 重置为原始大小 */
      resetScale() {
        this.scale = 1
      },

      // ==================== 手势缩放（双指 pinch） ====================

      /**
       * 计算两个触摸点之间的距离
       *
       *   dist = √((x1-x2)² + (y1-y2)²)
       *
       * @param {Touch[]} touches - 触摸事件.touches 数组
       * @returns {number} 两点间欧氏距离
       */
      _dist(touches) {
        const dx = touches[0].clientX - touches[1].clientX
        const dy = touches[0].clientY - touches[1].clientY
        return Math.sqrt(dx * dx + dy * dy)
      },

      /**
       * touchstart：记录初始双指距离和当前 scale
       *
       * 仅当检测到 2 个触摸点时激活缩放模式。
       * 单指触摸不处理（留给 scroll-view 原生滚动）。
       */
      onTouchStart(e) {
        if (e.touches.length === 2) {
          this._tsDist = this._dist(e.touches)
          this._tScale = this.scale
          this._pinch = true
        }
      },

      /**
       * touchmove：根据双指距离变化比例计算新 scale
       *
       * 缩放公式：
       *   newScale = startScale × (currentDist / startDist)
       *
       * 结果限制在 [minScale, maxScale] 范围内。
       * 注意：不要在此调用 e.preventDefault()，
       * 否则会阻止 scroll-view 的原生滚动。
       */
      onTouchMove(e) {
        if (e.touches.length === 2 && this._pinch) {
          const ratio = this._dist(e.touches) / this._tsDist
          this.scale = Math.max(this.minScale, Math.min(this.maxScale, +(this._tScale * ratio).toFixed(2)))
        }
      },

      /** touchend：结束缩放模式 */
      onTouchEnd() {
        this._pinch = false
      },

      // ==================== 滚动事件 ====================

      /**
       * scroll-view 的 @scroll 回调
       *
       * 当前为空实现（仅日志预留）。
       * 与多 scroll-view 方案不同，这里不需要做任何同步：
       *   - 表头冻结由 CSS sticky 自动处理
       *   - 首列冻结由 CSS sticky 自动处理
       *
       * 可扩展用途：
       *   - 滚动到底部时加载更多数据
       *   - 记录滚动位置用于状态恢复
       *
       * @param {Event} e - e.detail 包含 scrollLeft, scrollTop, scrollWidth 等
       */
      onScroll(e) {
        // 可在此处理滚动事件，比如加载更多等
        // console.log(e.detail);
      },
    },
  }
</script>

<style lang="scss" scoped>
  /* ============================================================
   *  根容器
   * ============================================================ */
  .zoom-table {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  /* ============================================================
   *  scroll-view 主体
   *
   *  flex: 1 + height: 0 是经典的 "flex 子元素填满剩余空间" 技巧：
   *    - flex: 1  → 占据父容器除 ztTop/ztBottom 之外的全部空间
   *    - height: 0 → 防止内容撑开导致超出（实际高度由 flex 控制）
   *
   *  如果父容器没有固定高度，可改为：
   *    height: calc(100vh - 工具栏高度 - 导航栏高度)
   * ============================================================ */
  .zt-scroll {
    flex: 1;
    height: 0;
    width: 100%;
  }

  /* ============================================================
   *  内部容器
   *
   *  width 由 JS 动态绑定（totalWidth rpx），height 由内容撑开。
   *  display: flex + flex-direction: column 使行从上到下排列。
   * ============================================================ */
  .zt-inner {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* ============================================================
   *  行容器
   *
   *  每行是一个横向 flex 容器，单元格从左到右排列。
   *  white-space: nowrap 防止内容换行导致行高异常。
   * ============================================================ */
  .zt-row {
    display: flex;
    flex-direction: row;
    white-space: nowrap;
  }

  /* ============================================================
   *  表头行 — 冻结在顶部
   *
   *  position: sticky; top: 0;
   *  ─────────────────────────────
   *  当 scroll-view 垂直滚动时，表头行到达顶部后"粘住"，
   *  不再跟随向上滚出，始终可见。
   *
   *  z-index: 10 确保数据行从表头下方滚过时被遮挡。
   *
   *  ⚠️ 注意：background 必须不透明，否则下方内容会穿透显示。
   * ============================================================ */
  .zt-header {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  /* ============================================================
   *  单元格基础样式
   *
   *  所有单元格（表头、首列、数据）共享的基础样式：
   *    - flex 居中布局
   *    - 右边框 + 下边框（形成网格线）
   *    - flex-shrink: 0 防止被压缩
   *    - overflow: hidden 防止内容溢出
   *    - background-color: #fff 不透明背景（防止 sticky 穿透）
   * ============================================================ */
  .zt-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-right: 1rpx solid #e8e8e8;
    border-bottom: 1rpx solid #e8e8e8;
    flex-shrink: 0;
    overflow: hidden;
    background-color: #fff;
  }

  /* ============================================================
   *  表头单元格样式
   *
   *  蓝色背景 + 白色文字（在模板中直接渲染）。
   *  更深的底边框区分表头和数据区。
   * ============================================================ */
  .zt-h-cell {
    background: #4472c4;
    border-right: 1rpx solid #3b5998;
    border-bottom: 2rpx solid #3b5998;
  }

  /* ============================================================
   *  首列单元格（数据行） — 冻结在左侧
   *
   *  position: sticky; left: 0;
   *  ─────────────────────────────
   *  当 scroll-view 水平滚动时，首列到达左边缘后"粘住"，
   *  不再跟随向左滚出，始终可见。
   *
   *  浅蓝背景 + 加粗右边框区分首列和数据区。
   *
   *  ⚠️ background 必须不透明，否则水平滚动时
   *     右侧数据会从首列下方穿透显示。
   * ============================================================ */
  .zt-fc-cell {
    background: #f0f4ff;
    border-right: 2rpx solid #c0c8e0;
    position: sticky;
    left: 0;
  }

  /* ============================================================
   *  左上角交叉单元格 — 同时冻结在顶部和左侧
   *
   *  position: sticky; top: 0; left: 0;
   *  ────────────────────────────────────
   *  同时受两个方向的 sticky 约束：
   *    - 垂直滚动时粘在顶部（和表头一起）
   *    - 水平滚动时粘在左侧（和首列一起）
   *
   *  z-index: 30 确保它同时覆盖表头行（z-index: 10）
   *  和首列（无 z-index 或更低）。
   *
   *  层级关系：
   *    角标(30) > 表头行(10) > 首列(默认) > 数据(默认)
   *
   *  视觉示意（滚动到右下方时）：
   *    ┌──────────┬─────────────────┐
   *    │ 角标(30) │ 表头(10) ← 粘顶部│
   *    ├──────────┼─────────────────┤
   *    │ 首列     │ 数据            │
   *    │ ← 粘左侧 │ 自由滚动        │
   *    └──────────┴─────────────────┘
   * ============================================================ */
  .zt-corner-cell {
    position: sticky;
    top: 0;
    left: 0;
    z-index: 30;
  }

  /* ============================================================
   *  奇偶行交替色
   *
   *  数据行和首列同时切换背景色，形成斑马纹效果。
   *  提高多行数据的可读性。
   * ============================================================ */
  .zt-even .zt-d-cell {
    background: #fafafa;
  }

  .zt-even .zt-fc-cell {
    background: #eef1fa;
  }
</style>
