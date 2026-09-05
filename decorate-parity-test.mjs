import { decorate as decorateHeadless } from './neko-renderer.js'
import { decorate as decorateWeb } from './client/src/client/decorate.ts'

const cases = [
  '完成。',
  '命令：`echo 好！`。',
  '```js\nconsole.log("好！")\n```',
  '~~~js\nconsole.log("好！")\n~~~\n完成。',
  '结果：\n```js\nconsole.log("好！")',
  'All tests pass!',
  '',
  ' \n',
]

for (const source of cases) {
  const headless = decorateHeadless(source)
  const web = decorateWeb(source)
  const expected = source.trim() === '' ? web : `${web}\n`
  if (headless !== expected) {
    console.error('FAIL: renderer parity', { source, headless, web })
    process.exit(1)
  }
}

console.log(`ok: headless and Web renderers match for ${cases.length} cases`)
