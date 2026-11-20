/** Standalone worker: only public model downloads, never an audio-upload request. */
let pipelinePromise = null,
  engineKey = "";
const originalFetch = self.fetch.bind(self);
self.onmessage = async (event) => {
  const { id, pcm, config, runtimeURL, language } = event.data;
  const send = (value) => self.postMessage({ id, ...value });
  try {
    if (!(pcm instanceof Float32Array) || pcm.length > 16000 * 300)
      throw Error("audio-size");
    const runtime = new URL(runtimeURL);
    if (
      runtime.href !==
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js"
    )
      throw Error("runtime");
    // Inference code uses GET model assets; block accidental non-read HTTP requests.
    self.fetch = (input, init) => {
      const method = String(
        init?.method ||
          (typeof input === "object" && "method" in input
            ? input.method
            : "GET"),
      ).toUpperCase();
      if (!["GET", "HEAD"].includes(method)) throw Error("upload-blocked");
      return originalFetch(input, init);
    };
    const key = config.model + "@" + config.revision;
    if (!pipelinePromise || engineKey !== key) {
      engineKey = key;
      pipelinePromise = (async () => {
        const { pipeline, env } = await import(runtimeURL);
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.proxy = false;
        env.backends.onnx.wasm.wasmPaths = new URL("./", runtimeURL).href;
        return pipeline("automatic-speech-recognition", config.model, {
          device: "wasm",
          dtype: "q8",
          revision: config.revision,
          progress_callback: (progress) =>
            send({
              type: "progress",
              stage: "loading",
              progress: Number(progress.progress) || 0,
              file: progress.file || "",
            }),
        });
      })().catch((error) => {
        pipelinePromise = null;
        throw error;
      });
    }
    const transcribe = await pipelinePromise;
    send({ type: "progress", stage: "processing" });
    const result = await transcribe(pcm, {
      language,
      task: "transcribe",
      chunk_length_s: 20,
      stride_length_s: 3,
      max_new_tokens: 256,
      return_timestamps: false,
    });
    const text = String(result.text || "").trim();
    if (!text) throw Error("no-text");
    send({
      type: "result",
      text,
      model: config.model,
      revision: config.revision,
    });
  } catch (error) {
    console.error("Local transcription engine:", error.message);
    send({
      type: "error",
      code:
        error.message === "no-text"
          ? "no-text"
          : error.message === "audio-size"
            ? "too-long"
            : "model-failed",
    });
  }
};
