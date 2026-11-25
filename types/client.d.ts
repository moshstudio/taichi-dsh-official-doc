declare function require(id: string): unknown

declare module 'react' {
  export type ReactNode = unknown
  export interface FunctionComponent<P = {}> {
    (props: P): ReactNode
  }
}

declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown, key?: string): unknown
  export function jsxs(type: unknown, props: unknown, key?: string): unknown
  export const Fragment: unknown
}

declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: Record<string, unknown>
  }
}