import {
  localASRConfig,
  asrLanguage,
  prepareASRAudio,
} from "../domain/local-asr-model.mjs";
/** Native ESM/worker client. Model downloads are lazy and explicit; audio stays on-device. */
export function createLocalASRClient() {
  let worker = null,
    serial = 0,
    pending = null,
    decoding = false;
  function cancel(reason = "cancelled") {
    serial++;
    worker?.terminate();
    worker = null;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(Error(reason));
      pending = null;
    }
  }
  async function transcribe(blob, language, onProgress = (_value) => {}) {
    if (pending || decoding) throw Error("busy");
    if (!blob?.size || blob.size > localASRConfig.maxImportBytes)
      throw Error("file-size");
    decoding = true;
    const generation = ++serial;
    onProgress({ stage: "decoding" });
    let context, pcm;
    try {
      context = new AudioContext();
      await context.resume();
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      if (generation !== serial) throw Error("cancelled");
      pcm = prepareASRAudio(
        Array.from({ length: decoded.numberOfChannels }, (_, i) =>
          decoded.getChannelData(i),
        ),
        decoded.sampleRate,
      );
    } catch (error) {
      throw Error(
        ["too-long", "silent", "cancelled"].includes(error.message)
          ? error.message
          : "decode",
      );
    } finally {
      decoding = false;
      await context?.close().catch(() => {});
    }
    if (generation !== serial) throw Error("cancelled");
    const imports =
      JSON.parse(
        document.querySelector('script[type="importmap"]')?.textContent || "{}",
      ).imports || {};
    const workerURL = imports["./src/adapters/local-asr-worker.mjs"],
      runtimeURL = imports[localASRConfig.runtime];
    if (!workerURL || !runtimeURL) throw Error("runtime");
    if (!worker) {
      worker = new Worker(new URL(workerURL, document.baseURI), {
        type: "module",
      });
      worker.onmessage = (event) => {
        const value = event.data;
        if (!pending || value.id !== pending.id) return;
        if (value.type === "progress") {
          pending.onProgress(value);
          return;
        }
        const task = pending;
        pending = null;
        clearTimeout(task.timer);
        if (value.type === "result") task.resolve(value);
        else task.reject(Error(value.code || "model-failed"));
      };
      worker.onerror = () => {
        const task = pending;
        pending = null;
        worker?.terminate();
        worker = null;
        if (task) {
          clearTimeout(task.timer);
          task.reject(Error("model-failed"));
        }
      };
    }
    onProgress({ stage: "loading" });
    return new Promise((resolve, reject) => {
      const duration = (pcm.length / 16000) * 1000;
      const timer = setTimeout(
        () => {
          cancel("timeout");
        },
        10 * 60 * 1000,
      );
      pending = {
        id: generation,
        resolve: (value) => resolve({ ...value, duration }),
        reject,
        onProgress,
        timer,
      };
      worker.postMessage(
        {
          id: generation,
          pcm,
          language: asrLanguage(language),
          config: localASRConfig,
          runtimeURL,
        },
        [pcm.buffer],
      );
    });
  }
  return { transcribe, cancel };
}
