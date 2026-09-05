export interface DecorateOptions {
  final?: boolean
  trailingNewline?: boolean
}

export const KAOMOJI_SUFFIX: string
export function decorateMarkdown(text: string): string
export function decorateText(value: unknown, options?: DecorateOptions): string
