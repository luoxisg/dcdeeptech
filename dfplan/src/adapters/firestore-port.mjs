import { connectBackend } from "./firestore-client.mjs";
/** @param {any} callbacks @param {any} preferences */
export async function createFirestorePort(callbacks, preferences) {
  const api = await connectBackend(
    callbacks.onSession,
    callbacks.onProject,
    callbacks.onError,
    callbacks.onPeople,
    callbacks.onPeopleError,
    callbacks.invitation,
  );
  return {
    api,
    load: () => api.refresh(),
    save: (next, text, textEn) =>
      api.save(next, callbacks.getRevision(), text, textEn),
    audit: (text, textEn) =>
      api.appendAudit(callbacks.getRevision(), text, textEn),
    loadPeople: () => api.listPeople(),
    addPerson: (name, responsibility) => api.addPerson(name, responsibility),
    setPersonActive: (id, active) => api.setPersonActive(id, active),
    readPreference: preferences.readPreference,
    writePreference: preferences.writePreference,
    rawBackup: preferences.rawBackup,
  };
}
