/**
 * Minimal compile-time contracts for modules supplied by the DSH Web host.
 * They are externalized from the browser bundle and are not npm dependencies.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {}
}

declare module '@deepseek-ai/dsh-attachment' {
  export interface ImageAttachmentRef {
    readonly [key: string]: unknown
  }
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  export interface ClientContext {
    slots: {
      inject(name: string, install: () => unknown): void
      register(options: Record<string, unknown>, component: unknown): unknown
    }
  }
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'

  type AssistantBlock =
    | { kind: 'text'; text: string }
    | { kind: 'reasoning'; text: string }
    | { kind: 'image'; attachment: ImageAttachmentRef }
    | { kind: 'tool-call' }
    | { kind: 'unknown'; block: unknown }

  export interface ChatNodeViewProps<_Kind extends string> {
    node: {
      data: {
        status: string
        blocks: AssistantBlock[]
      }
    }
    loadImage?: import('@deepseek-ai/dsh-client-ui-attachment').ImageLoader
    t(key: string, params?: Record<string, unknown>): string
  }
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactElement } from 'react'

  export function MarkdownText(props: {
    text: string
    streaming: boolean
    codeLabels: { copyLabel: string; copiedLabel: string }
  }): ReactElement

  export function JsonBlock(props: {
    label: string
    payload: unknown
    truncatedLabel(total: number): string
  }): ReactElement
}

declare module '@deepseek-ai/dsh-client-ui-attachment' {
  import type { ReactElement } from 'react'
  import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'

  export type ImageLoader = (...args: unknown[]) => Promise<unknown>

  export interface MessageImageLabels {
    image: string
    open: string
    openNamed(label: string): string
    loading: string
    loadFailed: string
    lightbox: {
      dialog: string
      close: string
    }
  }

  export function ImageGallery(props: {
    images: { attachment: ImageAttachmentRef }[]
    load: ImageLoader
    align: 'start' | 'center' | 'end'
    labels: MessageImageLabels
  }): ReactElement
}

declare module '@deepseek-ai/dsh-client-ui-slots' {}
