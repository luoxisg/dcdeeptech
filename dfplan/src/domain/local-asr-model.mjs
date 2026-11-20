/** Public, pinned download configuration; no audio or credentials. */
export const localASRConfig = Object.freeze({
  runtime: "@deepfamily/whisper-runtime",
  model: "onnx-community/whisper-tiny",
  revision: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
  maxSeconds: 300,
  maxImportBytes: 12 * 1024 * 1024,
  sampleRate: 16000,
});
export function asrLanguage(value) {
  return String(value).startsWith("en") ? "english" : "chinese";
}
export function transcriptionSummary(clip, language = "zh") {
  const en = language === "en";
  if (clip.transcript?.trim())
    return en
      ? "Transcript received — review against the audio."
      : "已获得转写文字，请对照录音核实。";
  const reasons = {
    network: en
      ? "Browser recognition service/network failed."
      : "浏览器识别服务或网络失败。",
    "not-allowed": en
      ? "Browser recognition permission was denied."
      : "浏览器未授予识别权限。",
    "service-not-allowed": en
      ? "The browser did not permit its recognition service."
      : "浏览器不允许使用其识别服务。",
    unsupported: en
      ? "Browser live recognition is unavailable."
      : "浏览器不支持实时识别。",
    "no-speech": en ? "No speech was recognized." : "浏览器没有识别到语音。",
    service: en
      ? "The browser recognition service did not start."
      : "浏览器识别服务未能启动。",
  };
  return (
    (en ? "No transcript received. " : "未获得转写文字。") +
    (reasons[clip.transcriptError] ||
      (clip.transcriptState === "off"
        ? en
          ? "Live recognition was off."
          : "当时未开启实时转写。"
        : en
          ? "The browser returned no usable text; the exact cause is unknown."
          : "浏览器未返回可用文字，具体原因尚不确定。"))
  );
}
/** Downmix/resample before passing PCM to the worker; no private PCM is persisted. */
export function prepareASRAudio(channels, sourceRate) {
  if (
    !channels.length ||
    !channels[0]?.length ||
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0
  )
    throw Error("decode");
  const duration = channels[0].length / sourceRate;
  if (duration > localASRConfig.maxSeconds) throw Error("too-long");
  const count = Math.floor(duration * localASRConfig.sampleRate),
    out = new Float32Array(count);
  let energy = 0;
  for (let i = 0; i < count; i++) {
    const at = (i * sourceRate) / localASRConfig.sampleRate,
      left = Math.floor(at),
      fraction = at - left;
    let sample = 0;
    for (const channel of channels)
      sample +=
        ((channel[left] || 0) * (1 - fraction) +
          (channel[Math.min(left + 1, channel.length - 1)] || 0) * fraction) /
        channels.length;
    out[i] = sample;
    energy += sample * sample;
  }
  if (!count || Math.sqrt(energy / count) < 0.00001) throw Error("silent");
  return out;
}
