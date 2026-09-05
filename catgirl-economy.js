/**
 * catgirl-economy — Token Optimizer：工具 schema 裁剪 + 渐进式披露。
 *
 * 在 agent 创建时（agent/created，早于首次 prompt assembly）把模型可见的
 * 工具裁剪到最小编码集。被隐藏的工具 schema 不再进入每个请求，直接省下
 * 数百到数千 token/请求。
 *
 * 渐进式披露（escalate）：注册一个极小的 `enable_tool` 工具（~50 token），
 * 模型需要被裁的工具（subagent、web_search 等）时调用它，插件在 agent
 * 作用域内解除对应工具的隐藏。这是 docs 推荐的 ToolSearch / progressive
 * disclosure 模式：registry 保持 presentation、lookup、execution 一致。
 */

import z from '@deepseek-ai/schemastery'

export const name = 'catgirl-economy'

/** 最小编码工具集：bash + 文件读写编辑 + 搜索 + todo。 */
const DEFAULT_ALLOW = [
  'bash',
  'read',
  'write',
  'edit',
  'glob',
  'grep',
  'str_replace_editor',
  'todo_write',
]

/** 可被 enable_tool 解锁的隐藏工具。 */
const DEFAULT_ESCALATABLE = [
  'subagent',
  'send_message',
  'list_agents',
  'interrupt_agent',
  'report',
  'web_fetch',
  'web_search',
  'skill',
  'workflow',
  'ralph',
  'ask_user_question',
  'read_image',
  'get_goal',
  'create_goal',
  'update_goal',
  'job_output',
  'job_list',
  'job_kill',
]

/** Explicit presets keep behavior auditable; `allow` overrides the selected preset. */
export const TOOL_PROFILES = Object.freeze({
  coding: Object.freeze([...DEFAULT_ALLOW]),
  normal: Object.freeze(['read', 'glob', 'grep', 'web_fetch', 'web_search']),
  chat: Object.freeze([]),
})

/**
 * Plugin config.
 * - `profile`: coding / normal / chat 显式工具档位。
 * - `allow`: 设置后覆盖 profile 的初始工具列表（可为空）。
 * - `escalatable`: 可由 `enable_tool` 解锁的工具列表。
 * - `escalate`: 注册 `enable_tool` 工具，允许模型按需解锁隐藏工具。
 */
export const Config = z.object({
  profile: z.union(['coding', 'normal', 'chat']).default('coding'),
  allow: z.union([z.array(z.string()), null]).default(null),
  escalatable: z.array(z.string()).default(DEFAULT_ESCALATABLE),
  escalate: z.boolean().default(true),
})

export function resolveInitialAllow(config) {
  const selected = config.allow ?? TOOL_PROFILES[config.profile]
  return [...new Set(selected)]
}

export function apply(ctx, config) {
  ctx.on('agent/created', ({ agent }) => {
    const requestedAllow = resolveInitialAllow(config)
    let schemas = null
    try {
      if (typeof agent.ctx.tools.schemas === 'function') schemas = agent.ctx.tools.schemas()
    } catch {
      // Older runtimes may not expose schemas during agent creation; restrict()
      // remains the compatibility fallback and still provides transactional rollback.
    }
    const available = Array.isArray(schemas)
      ? new Set(schemas.map(tool => tool.name))
      : null
    const unavailable = available
      ? requestedAllow.filter(tool => !available.has(tool))
      : []
    const initialAllow = available
      ? requestedAllow.filter(tool => available.has(tool))
      : requestedAllow
    const state = {
      allow: initialAllow,
      escalatable: [...new Set(config.escalatable)],
      disposer: null,
    }

    const logger = typeof agent.ctx.logger === 'function'
      ? agent.ctx.logger('catgirl-economy')
      : null
    logger?.debug?.(`tool profile=${config.profile} allow=${state.allow.join(',') || '(none)'}`)
    if (unavailable.length) {
      logger?.warn?.(`ignored unavailable profile tools: ${unavailable.join(', ')}`)
    }

    const replaceRestriction = (nextAllow) => {
      const normalizedAllow = [...new Set(nextAllow)]
      const previousAllow = state.allow
      const hadRestriction = state.disposer !== null
      state.disposer?.()
      state.disposer = null

      try {
        const nextDisposer = agent.ctx.tools.restrict({ allow: normalizedAllow })
        state.allow = normalizedAllow
        state.disposer = nextDisposer
      } catch (error) {
        // Switching an allow-list requires lifting the old restriction first,
        // because restrictions intersect. Restore it if the new tool is not
        // installed in this profile so one failed unlock cannot poison state.
        if (hadRestriction) {
          state.disposer = agent.ctx.tools.restrict({ allow: previousAllow })
        }
        throw error
      }
    }
    replaceRestriction(state.allow)

    if (config.escalate) {
      agent.ctx.effect(() => agent.ctx.tools.register({
        name: 'enable_tool',
        description: `Add a hidden tool to this session when needed. Available names: ${state.escalatable.join(', ')}.`,
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The exact tool name to enable',
            },
          },
          required: ['name'],
        },
        output: {
          schema: { type: 'string' },
          render: (_args, value) => [{ type: 'text', text: value }],
        },
        async execute(args) {
          if (state.allow.includes(args.name)) return `Tool ${args.name} is already enabled.`
          if (!state.escalatable.includes(args.name)) {
            return `Unknown tool ${args.name}. Escalatable tools: ${state.escalatable.join(', ')}.`
          }
          try {
            replaceRestriction([...state.allow, args.name])
            return `Tool ${args.name} is now enabled for this session.`
          } catch {
            return `Tool ${args.name} is supported but unavailable in this profile.`
          }
        },
      }), 'catgirl-economy.enable_tool()')
    }
  })
}
