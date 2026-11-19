/** Optional live microphone level test only: no recording, recognition or network upload. */
export function createInterviewMeter(onLevel, onStatus) {
  let epoch = 0,
    stream = null,
    context = null,
    frame = 0;
  function stop() {
    epoch++;
    cancelAnimationFrame(frame);
    frame = 0;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    const old = context;
    context = null;
    if (old && old.state !== "closed") void old.close().catch(() => {});
    onLevel(0);
    onStatus("off");
  }
  return {
    stop,
    async start() {
      stop();
      const token = epoch;
      if (!navigator.mediaDevices?.getUserMedia) {
        onStatus("unsupported");
        return;
      }
      onStatus("requesting");
      let acquired = null;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (token !== epoch) {
          acquired.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = acquired;
        context = new AudioContext();
        await context.resume();
        if (token !== epoch) return;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        const bytes = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (token !== epoch) return;
          analyser.getByteTimeDomainData(bytes);
          let sum = 0;
          bytes.forEach((value) => (sum += ((value - 128) / 128) ** 2));
          onLevel(Math.min(1, Math.sqrt(sum / bytes.length) * 5));
          frame = requestAnimationFrame(tick);
        };
        stream.getTracks().forEach((track) =>
          track.addEventListener(
            "ended",
            () => {
              if (token === epoch) stop();
            },
            { once: true },
          ),
        );
        onStatus("active");
        tick();
      } catch {
        acquired?.getTracks().forEach((track) => track.stop());
        if (token === epoch) {
          stop();
          onStatus("denied");
        }
      }
    },
  };
}
export function downloadInterview(text) {
  const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = "DeepFamily_Interview_Draft.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
