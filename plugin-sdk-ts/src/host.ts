/**
 * Low-level host function wrapper.
 *
 * Encapsulates Extism Memory API so higher-level modules never deal with
 * Memory.fromString / Memory.find / I64 offsets directly.
 */

type ExtismHostFunctions = Record<string, (ptr: I64) => I64>;

type ExtismHostGlobal = {
  Host?: {
    getFunctions?: () => ExtismHostFunctions;
  };
};

let cachedFns: ExtismHostFunctions | null = null;

function getHostFunctions(): ExtismHostFunctions {
  if (cachedFns) {
    return cachedFns;
  }

  const hostRef = (globalThis as unknown as ExtismHostGlobal).Host;
  if (!hostRef?.getFunctions) {
    throw new Error(
      'Extism Host runtime is not available. Import authoring helpers from the SDK without calling host-backed modules outside plugin execution.',
    );
  }

  cachedFns = hostRef.getFunctions();
  return cachedFns;
}

/**
 * Call a Cognia host function by name.
 *
 * Serialises `input` into Extism shared memory, invokes the host function,
 * and deserialises the returned memory offset back into a string.
 *
 * @param fnName - One of the registered `cognia_*` host function names.
 * @param input  - JSON string (or empty string) to pass as input.
 * @returns The JSON string returned by the host function.
 */
export function callHost(fnName: string, input: string): string {
  const fn = getHostFunctions()[fnName];
  if (!fn) {
    throw new Error(`Host function '${fnName}' is not available`);
  }
  // @ts-ignore — Memory is a global provided by Extism JS runtime
  const mem = Memory.fromString(input);
  const offset = fn(mem.offset);
  // @ts-ignore — Memory is a global provided by Extism JS runtime
  return Memory.find(offset).readString();
}

/**
 * Call a host function and parse the JSON result.
 */
export function callHostJson<T>(fnName: string, input: string): T {
  const raw = callHost(fnName, input);
  return JSON.parse(raw) as T;
}
