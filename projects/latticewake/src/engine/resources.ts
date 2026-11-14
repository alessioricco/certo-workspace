export type ResourceFactories<T> = { readonly [K in keyof T]: (signal: AbortSignal) => T[K] | Promise<T[K]> };

export async function loadResources<T>(factories: ResourceFactories<T>, signal: AbortSignal): Promise<T> {
  const result = {} as T;
  signal.throwIfAborted();
  for (const name of Object.keys(factories) as (keyof T)[]) {
    signal.throwIfAborted();
    result[name] = await factories[name](signal);
    signal.throwIfAborted();
  }
  return result;
}
