/** Declarative commands: no eval, inline handlers or DOM dependencies. */
export function createCommandBus() {
  /** @type {Map<string,(payload:any)=>any>} */ const registry = new Map();
  return {
    registry,
    register(name, handler) {
      if (registry.has(name)) throw Error("Duplicate command: " + name);
      registry.set(name, handler);
    },
    async run(name, payload = {}) {
      const handler = registry.get(name);
      if (!handler) throw Error("Unknown command: " + name);
      return handler(payload);
    },
  };
}
export const commands = createCommandBus();
