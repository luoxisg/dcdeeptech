import { commands } from "../application/command-bus.mjs";
import { store } from "../application/store.mjs";

export function installVoiceEntry() {
  let opening = false;
  commands.register("voice-open", async () => {
    if (opening) return;
    opening = true;
    try {
      const { openVoiceOverlay } = await import("./voiceOverlay.mjs");
      const state = store.getState();
      openVoiceOverlay({ lang: state.language, largeText: state.elder,
        onTextScaleChange: (elder) => {
          if (store.getState().elder !== elder) void commands.run("text-scale");
        },
      });
    } finally { opening = false; }
  });
}
