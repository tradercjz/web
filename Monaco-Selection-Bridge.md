# Monaco Editor 与浏览器插件选区协同（DolphinDB Web）

本文档面向浏览器插件开发团队，说明 DolphinDB Web 的交互编程页（Shell）如何向外暴露 Monaco Editor 的选区信息，以便插件在选中代码时弹出“AI 修改”按钮。

## 背景

DolphinDB Web 的代码编辑器使用 Monaco Editor。Monaco 的选区属于“虚拟选区”，不依赖原生 `window.getSelection()`，因此插件如果只监听 `selectionchange` 往往拿不到选中文本和位置。

为了解决该问题，前端在 Shell 的 Monaco `onMount` 中监听选区变化，并主动向 `window` 派发自定义事件。

## 事件：`monaco-selection-changed`

- **事件名**：`monaco-selection-changed`
- **派发对象**：`window`
- **触发时机**：
  - Monaco 选区/光标选区变化（`editor.onDidChangeCursorSelection`）
  - Monaco 编辑器失焦（`editor.onDidBlurEditorWidget`）

### `detail` 结构

当存在有效选区（非空白）时：

```ts
type MonacoSelectionChangedDetail = {
  text: string
  rect?: {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
  }
  x?: number
  y?: number
}
```

当没有选区（或选区为空/仅空白、或编辑器失焦）时：

- `detail` 为 `null`

### 字段含义

- **`text`**
  - 选中的文本内容（来自 `model.getValueInRange(selection)`）
  - 若选区仅包含空白，会被视为“无选区”，事件会发 `detail: null`

- **`x` / `y`**
  - 选区“结束位置”（end position）的屏幕坐标（viewport 坐标系，单位 px）
  - `x`：大致位于选区末端的列位置
  - `y`：大致位于选区末端所在行的**行底部**（更适合将按钮放在选区下方）

- **`rect`**
  - 如果能计算到精确 end position 的可视位置，则 `rect` 是一个高度为行高、宽度为 0 的锚点矩形（类似光标位置）。
  - 如果无法获取可视位置，则 `rect` 回退为整个 editor DOM 的 `getBoundingClientRect()`。

## 坐标计算方式（前端实现摘要）

前端使用以下组合计算锚点：

- `editor.getDomNode().getBoundingClientRect()` 获取 editor 在页面中的位置
- `editor.getScrolledVisiblePosition(selection.getEndPosition())` 获取选区末端在 editor 内部的可视坐标（left/top/height）
- 合成：
  - `x = domRect.left + visiblePos.left`
  - `y = domRect.top + visiblePos.top + visiblePos.height`

> 注：这是“足够稳定用于弹按钮”的定位方式。若 end position 当前滚出可视区，`getScrolledVisiblePosition` 可能返回 `null`，此时使用 editor DOM rect 回退。

## 插件端接入示例

### 监听事件并显示按钮

```js
function showAiButton({ text, rect, x, y }) {
  // 你们的按钮 DOM
  const btn = getOrCreateButton()

  const left = rect?.left ?? x
  const top = rect?.bottom ?? y

  if (left == null || top == null) return

  btn.style.left = `${Math.round(left)}px`
  btn.style.top = `${Math.round(top)}px`
  btn.style.display = 'block'

  // 可把 text 缓存起来，点击按钮时提交给后端/大模型
  btn.dataset.selectionText = text
}

function hideAiButton() {
  const btn = getOrCreateButton()
  btn.style.display = 'none'
  btn.dataset.selectionText = ''
}

window.addEventListener('monaco-selection-changed', (e) => {
  const detail = e.detail
  if (!detail) {
    hideAiButton()
    return
  }
  showAiButton(detail)
})
```

### 建议的交互细节

- **[隐藏逻辑]**
  - 当 `detail === null` 时隐藏按钮
  - 当用户点击编辑器其它区域导致失焦时也会收到 `null`

- **[去抖]**
  - Monaco 选区变化会比较频繁（拖拽选区过程中）。如果按钮渲染昂贵，建议在插件侧做 `requestAnimationFrame` 或 30~50ms 的 debounce。

- **[滚动/缩放]**
  - `x/y/rect` 属于 viewport 坐标。
  - 如果按钮放在 `position: fixed` 容器中，可直接用该坐标。
  - 如果按钮放在 `position: absolute` 且挂在 `document.body` 下，需要注意页面滚动偏移（通常 `getBoundingClientRect` 已经是 viewport 坐标，适配 `fixed` 最省事）。

## 相关说明

- DolphinDB Web 已在 Monaco options 中启用：
  - `accessibilitySupport: 'on'`

这能提升 Monaco 在可访问性层面的行为一致性，但插件应**以自定义事件为准**，不要依赖原生 selection。
