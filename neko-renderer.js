/**
 * neko-renderer — 显示层本地渲染：把模型输出的正常文本喵化。
 *
 * 只装饰 headless 最终打印的文本（替换 internals.stdout），会话日志保持
 * 原文，模型上下文不被污染。Web UI 的渲染由客户端插件负责（未来工作）。
 *
 * 注意：替换必须是同步的（createRequire），因为 headless-runner 在 apply
 * 时捕获 stdout；异步 import 的回调会晚于捕获时机。
 */

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

const require = createRequire(import.meta.url)

export const name = 'neko-renderer'

/**
 * Plugin config.
 * - `headlessLibPath`: @deepseek-ai/dsh-headless 的 lib 入口绝对路径。
 *   默认指向 dsh 安装的 profile node_modules（$DSH_HOME/profiles/node_modules）。
 */
export const Config = z.object({
  headlessLibPath: z.string().default(join(homedir(), '.dsh', 'profiles', 'node_modules', '@deepseek-ai', 'dsh-headless', 'lib', 'index.js')),
})

/**
 * 只转换 Markdown 的普通文本，保留行内代码和围栏代码。
 * 未闭合的代码范围也会保留，避免流式渲染时短暂改写代码。
 */
function decorateMarkdown(text) {
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

/** 本地渲染：句尾加「喵~」，末尾加颜文字；Markdown 代码原样保留。 */
export function decorate(text) {
  const source = String(text)
  if (source.trim() === '') return source

  const trimmed = source.replace(/(?:\r?\n)+$/, '')
  if (trimmed.endsWith(' (｡･ω･｡)')) return `${trimmed}\n`

  const body = decorateMarkdown(trimmed)
  return `${body} (｡･ω･｡)\n`
}

/** 安装 stdout 装饰器，并返回不会覆盖后续替换的精确恢复函数。 */
export function installRenderer(internals) {
  const original = internals?.stdout
  if (!original || typeof original.write !== 'function') {
    throw new TypeError('neko-renderer requires internals.stdout.write()')
  }

  const patched = Object.create(original)
  Object.defineProperty(patched, 'write', {
    configurable: true,
    enumerable: true,
    value(chunk, ...args) {
      return original.write(decorate(String(chunk)), ...args)
    },
  })
  internals.stdout = patched

  return () => {
    if (internals.stdout === patched) internals.stdout = original
  }
}

export function apply(ctx, config) {
  ctx.effect(() => {
    try {
      const { internals } = require(config.headlessLibPath)
      return installRenderer(internals)
    } catch {
      // headless bundle 不存在（如 web profile）时跳过，渲染由 UI 层负责。
      return () => {}
    }
  }, 'neko-renderer.stdout()')
}
