export type RuntimeFetcher = typeof fetch;

export function bindRuntimeFetch(fetcher: RuntimeFetcher = globalThis.fetch): RuntimeFetcher {
  return (input, init) => Reflect.apply(fetcher, globalThis, [input, init]);
}
