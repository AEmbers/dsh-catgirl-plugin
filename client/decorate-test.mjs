// decorate 单元测试：验证喵化逻辑（与 server 侧 neko-renderer 一致）。
import { decorate } from './src/client/decorate.ts'

let failed = 0
function check(label, cond) {
  if (!cond) { failed++; console.error(`FAIL: ${label}`) }
  else console.log(`ok: ${label}`)
}

check('sentence end gets 喵~', decorate('验证通过。') === '验证通过。喵~ (｡･ω･｡)')
check('multiple sentences', decorate('完成。正确。') === '完成。喵~正确。喵~ (｡･ω･｡)')
check('code block untouched', decorate('结果：\n```python\nprint("ok。")\n```\n完成。') === '结果：\n```python\nprint("ok。")\n```\n完成。喵~ (｡･ω･｡)')
check('tilde code fence untouched', decorate('~~~js\nconsole.log("好！")\n~~~\n完成。') === '~~~js\nconsole.log("好！")\n~~~\n完成。喵~ (｡･ω･｡)')
check('unclosed streaming fence untouched', decorate('结果：\n```js\nconsole.log("好！")') === '结果：\n```js\nconsole.log("好！") (｡･ω･｡)')
check('inline code untouched', decorate('命令：`echo 好！`。') === '命令：`echo 好！`。喵~ (｡･ω･｡)')
check('multi-backtick inline code untouched', decorate('值：``a ` b！``。') === '值：``a ` b！``。喵~ (｡･ω･｡)')
check('CRLF code fence untouched', decorate('```js\r\nconsole.log("好！")\r\n```\r\n') === '```js\r\nconsole.log("好！")\r\n``` (｡･ω･｡)')
check('streaming output has no moving suffix', decorate('完成。', { final: false }) === '完成。喵~')
check('streaming whitespace is preserved', decorate('完成。\n', { final: false }) === '完成。喵~\n')
check('no punctuation still gets kaomoji', decorate('Done') === 'Done (｡･ω･｡)')
check('trailing newline trimmed', decorate('完成。\n') === '完成。喵~ (｡･ω･｡)')
check('english punctuation', decorate('All tests pass!') === 'All tests pass!喵~ (｡･ω･｡)')
check('empty output stays empty', decorate('') === '')
check('whitespace-only output stays untouched', decorate(' \n') === ' \n')
check('decoration is idempotent', decorate(decorate('完成。')) === '完成。喵~ (｡･ω･｡)')
check('existing nya suffix is not duplicated', decorate('完成。喵~') === '完成。喵~ (｡･ω･｡)')

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nall decorate checks passed')
