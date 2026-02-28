/**
 * Low-level host function wrapper.
 *
 * Encapsulates Extism Memory API so higher-level modules never deal with
 * Memory.fromString / Memory.find / I64 offsets directly.
 */

// @ts-expect-error — Host.getFunctions() is provided by the Extism JS runtime
const _fns: Record<string, (ptr: I64) => I64> = Host.getFunctions();

/**
 * Call a Cognia host function by name.
 *
 * Serialises `input` into Extism shared memory, invokes the host function,
 * and deserialises the returned memory offset back into a string.
 *
 * @param fnName - One of the 37 `cognia_*` host function names.
 * @param input  - JSON string (or empty string) to pass as input.
 * @returns The JSON string returned by the host function.
 */
export function callHost(fnName: string, input: string): string {
  const fn = _fns[fnName];
  if (!fn) {
    throw new Error(`Host function '${fnName}' is not available`);
  }
  // @ts-expect-error — Memory is a global provided by Extism JS runtime
  const mem = Memory.fromString(input);
  const offset = fn(mem.offset);
  // @ts-expect-error — Memory is a global provided by Extism JS runtime
  return Memory.find(offset).readString();
}

/**
 * Call a host function and parse the JSON result.
 */
export function callHostJson<T>(fnName: string, input: string): T {
  const raw = callHost(fnName, input);
  return JSON.parse(raw) as T;
}
