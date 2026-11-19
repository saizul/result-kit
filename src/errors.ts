/** An `Error` with a literal `kind` tag, for discriminated error unions. */
export interface TaggedErrorInstance<K extends string> extends Error {
  readonly kind: K;
}

/** The constructor returned by `TaggedError()`. */
export interface TaggedErrorClass<K extends string> {
  new (message?: string, options?: { cause?: unknown }): TaggedErrorInstance<K>;
  readonly kind: K;
}

/**
 * Creates a base class for an error with a literal `kind`, so a union of
 * your errors can be narrowed with `switch (e.kind)` or `matchKind()`.
 *
 * ```ts
 * class NotFound extends TaggedError('NotFound') {
 *   constructor(readonly id: string) {
 *     super(`No user with id ${id}`);
 *   }
 * }
 * ```
 */
export function TaggedError<K extends string>(kind: K): TaggedErrorClass<K> {
  const Base = class extends Error {
    static readonly kind = kind;
    readonly kind = kind;
    constructor(message?: string, options?: { cause?: unknown }) {
      super(message ?? kind, options);
      this.name = kind;
    }
  };
  return Base;
}

type Kinded = { readonly kind: string };

/** One handler per `kind` of a tagged union. */
export type KindHandlers<E extends Kinded, R> = {
  [K in E['kind']]: (error: Extract<E, { kind: K }>) => R;
};

/** The union of the return types of a handler object. */
export type HandlerReturn<H> = {
  [K in keyof H]: H[K] extends (...args: never[]) => infer R ? R : never;
}[keyof H];

/**
 * Exhaustive `switch` on the `kind` of an error (or any object with a
 * string `kind`). Missing a kind is a compile error.
 *
 * ```ts
 * matchKind(error, {
 *   network: () => 'offline',
 *   http: (e) => `HTTP ${e.status}`,
 *   ...
 * });
 * ```
 */
export function matchKind<E extends Kinded, H extends KindHandlers<E, unknown>>(
  error: E,
  handlers: H,
): HandlerReturn<H> {
  const handler = (handlers as unknown as Record<string, ((e: E) => HandlerReturn<H>) | undefined>)[
    error.kind
  ];
  if (typeof handler !== 'function') {
    throw new TypeError(`matchKind: no handler for kind "${error.kind}"`);
  }
  return handler(error);
}
