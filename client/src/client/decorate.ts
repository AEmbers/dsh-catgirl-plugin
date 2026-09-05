/** 只转换 Markdown 普通文本，保留已闭合或流式输出中未闭合的代码。 */
function decorateMarkdown(text: string): string {
  const output: string[] = []
  let plainStart = 0
  let cursor = 0

  const pushPlain = (end: number): void => {
    output.push(text.slice(plainStart, end).replace(
      /([。！？!?])(?!喵~)(?=\s|$|[^。！？!?])/g,
      '$1喵~',
    ))
  }

  while (cursor < text.length) {
    const atLineStart = cursor === 0 || text[cursor - 1] === '\n'
    if (atLineStart) {
      let markerStart = cursor
      while (markerStart < cursor + 3 && text[markerStart] === ' ') markerStart += 1
      const marker = text[markerStart]
      if (marker === '`' || marker === '~') {
        let markerEnd = markerStart
        while (text[markerEnd] === marker) markerEnd += 1
        const markerLength = markerEnd - markerStart
        const openingLineEnd = text.indexOf('\n', markerEnd)
        const openingRestEnd = openingLineEnd === -1 ? text.length : openingLineEnd
        const validOpening = marker === '~'
          || !text.slice(markerEnd, openingRestEnd).includes('`')
        if (markerLength >= 3 && validOpening) {
          let protectedEnd = text.length
          if (openingLineEnd !== -1) {
            let lineStart = openingLineEnd + 1
            while (lineStart < text.length) {
              let closingStart = lineStart
              while (closingStart < lineStart + 3 && text[closingStart] === ' ') closingStart += 1
              let closingEnd = closingStart
              while (text[closingEnd] === marker) closingEnd += 1
              const lineEnd = text.indexOf('\n', closingEnd)
              const restEnd = lineEnd === -1 ? text.length : lineEnd
              const isClosing = closingEnd - closingStart >= markerLength
                && /^[\t \r]*$/.test(text.slice(closingEnd, restEnd))
              if (isClosing) {
                protectedEnd = lineEnd === -1 ? text.length : lineEnd + 1
                break
              }
              if (lineEnd === -1) break
              lineStart = lineEnd + 1
            }
          }
          pushPlain(cursor)
          output.push(text.slice(cursor, protectedEnd))
          cursor = protectedEnd
          plainStart = cursor
          continue
        }
      }
    }

    if (text[cursor] === '`') {
      let runEnd = cursor
      while (text[runEnd] === '`') runEnd += 1
      const run = text.slice(cursor, runEnd)
      let closingStart = -1
      let searchFrom = runEnd
      while (searchFrom < text.length) {
        const candidate = text.indexOf('`', searchFrom)
        if (candidate === -1) break
        let candidateEnd = candidate
        while (text[candidateEnd] === '`') candidateEnd += 1
        if (candidateEnd - candidate === run.length) {
          closingStart = candidate
          break
        }
        searchFrom = candidateEnd
      }
      const protectedEnd = closingStart === -1 ? text.length : closingStart + run.length
      pushPlain(cursor)
      output.push(text.slice(cursor, protectedEnd))
      cursor = protectedEnd
      plainStart = cursor
      continue
    }

    cursor += 1
  }

  pushPlain(text.length)
  return output.join('')
}

/**
 * 本地渲染：句尾加「喵~」，末尾加颜文字。
 * 与 server 侧 neko-renderer.js 的 decorate 保持同一逻辑。
 */
export function decorate(text: string): string {
  if (text.trim() === '') return text

  const trimmed = text.replace(/(?:\r?\n)+$/, '')
  if (trimmed.endsWith(' (｡･ω･｡)')) return trimmed

  const body = decorateMarkdown(trimmed)
  return `${body} (｡･ω･｡)`
}
