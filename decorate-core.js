/** Shared, dependency-free Markdown decoration used by headless and Web renderers. */

export const KAOMOJI_SUFFIX = ' (｡･ω･｡)'

/**
 * Decorate punctuation in Markdown prose while preserving inline and fenced code.
 * Unclosed code ranges stay protected so partial streaming output is never mutated.
 */
export function decorateMarkdown(text) {
  const output = []
  let plainStart = 0
  let cursor = 0

  const pushPlain = (end) => {
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
      const runLength = runEnd - cursor
      let closingStart = -1
      let searchFrom = runEnd
      while (searchFrom < text.length) {
        const candidate = text.indexOf('`', searchFrom)
        if (candidate === -1) break
        let candidateEnd = candidate
        while (text[candidateEnd] === '`') candidateEnd += 1
        if (candidateEnd - candidate === runLength) {
          closingStart = candidate
          break
        }
        searchFrom = candidateEnd
      }
      const protectedEnd = closingStart === -1 ? text.length : closingStart + runLength
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
 * @param {unknown} value
 * @param {{ final?: boolean, trailingNewline?: boolean }} [options]
 */
export function decorateText(value, options = {}) {
  const source = String(value)
  if (source.trim() === '') return source

  const final = options.final ?? true
  if (!final) return decorateMarkdown(source)

  const trimmed = source.replace(/(?:\r?\n)+$/, '')
  if (trimmed.endsWith(KAOMOJI_SUFFIX)) {
    return options.trailingNewline ? `${trimmed}\n` : trimmed
  }

  const body = decorateMarkdown(trimmed)
  return `${body}${KAOMOJI_SUFFIX}${options.trailingNewline ? '\n' : ''}`
}
