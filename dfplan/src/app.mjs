import { store } from "./application/store.mjs";
import { installCommands } from "./application/actions.mjs";
import {
  startApplication,
  receiveStorageEvent,
} from "./application/runtime.mjs";
import { createLocalStoragePort } from "./adapters/local-storage.mjs";
import { backendConfig } from "./adapters/backend-config.mjs";
import { consumeInviteToken } from "./adapters/invite-token.mjs";
import { installRenderer } from "./ui/renderer.mjs";
import { installUIEvents } from "./ui/events.mjs";
import { installKeyboardAvoidance } from "./ui/keyboard-viewport.mjs";
import { installVoiceEntry } from "./ui/voice-entry.mjs";
// Consume and scrub any invitation before navigation can alter the fragment.
const invitation = consumeInviteToken(location, history);
let deviceStorage;
try {
  deviceStorage = localStorage;
} catch {
  deviceStorage = {
    getItem: () => null,
    setItem: () => {
      throw Error("Device storage is unavailable. Export your changes.");
    },
  };
}
installCommands();
installVoiceEntry();
installUIEvents();
installRenderer();
installKeyboardAvoidance();
void startApplication(
  { url: new URL(location.href), storage: deviceStorage, invitation },
  {
    cloudEnabled: backendConfig.enabled,
    local: createLocalStoragePort,
    cloud: async (callbacks, preferences) =>
      (await import("./adapters/firestore-port.mjs")).createFirestorePort(
        callbacks,
        preferences,
      ),
  },
).catch((error) => store.update({ error: String(error.message || error) }));
window.addEventListener("storage", (event) => {
  if (event.newValue !== null) void receiveStorageEvent(event.key);
});
window.addEventListener("hashchange", () => {
  const view = location.hash.slice(1);
  if (
    [
      "overview",
      "board",
      "list",
      "timeline",
      "history",
      "dashboard",
      "people",
      "interview",
      "facts",
      "security",
      "digitization",
    ].includes(view)
  )
    store.navigate(
      view,
      document.querySelector('[data-slot="viewport"]').scrollTop,
    );
});
