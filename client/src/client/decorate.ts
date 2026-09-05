import { decorateText } from '../../../decorate-core.js'

export interface DecorateOptions {
  /** Add the terminal kaomoji. Keep false while a response is streaming. */
  final?: boolean
}

/** Web renderer wrapper around the shared, dependency-free decoration core. */
export function decorate(text: string, options: DecorateOptions = {}): string {
  return decorateText(text, { final: options.final })
}
