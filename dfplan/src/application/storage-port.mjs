/** @typedef {import('../domain/types.mjs').StoragePort} StoragePort */
/** @param {StoragePort} port */
export function assertStoragePort(port) {
  for (const method of [
    "load",
    "save",
    "loadPeople",
    "addPerson",
    "setPersonActive",
    "readPreference",
    "writePreference",
  ])
    if (typeof port[method] !== "function")
      throw Error("Storage port missing " + method);
  return port;
}
