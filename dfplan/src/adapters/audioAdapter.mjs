// A streaming resampler retains fractional position across capture buffers.
export function createResampler(rate, target = 16000) {
  let tail = new Float32Array(), position = 0;
  return (input) => {
    const samples = new Float32Array(tail.length + input.length); samples.set(tail); samples.set(input, tail.length);
    const output = [], step = rate / target;
    while (position + 1 < samples.length) {
      const i = Math.floor(position), fraction = position - i;
      const value = samples[i] * (1 - fraction) + samples[i + 1] * fraction;
      output.push(Math.round(Math.max(-1, Math.min(1, value)) * (value < 0 ? 32768 : 32767))); position += step;
    }
    const consumed = Math.min(Math.floor(position), samples.length);
    tail = samples.slice(consumed); position -= consumed;
    return Int16Array.from(output);
  };
}
export class AudioAdapter {
  unlock() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) throw new Error("此浏览器不支持音频 / Audio is not supported");
    this.context ||= new Context();
    // Called synchronously inside the Start click before any network/microphone await.
    return this.context.resume();
  }
  async capture(onPCM, onRMS) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
    this.stream = stream;
    this.source = this.context.createMediaStreamSource(stream);
    this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 2048;
    // ScriptProcessor is deliberately used for broad iOS support without another worklet asset.
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    const resample = createResampler(this.context.sampleRate);
    const wave = new Float32Array(this.analyser.fftSize);
    this.processor.onaudioprocess = (event) => {
      this.analyser.getFloatTimeDomainData(wave);
      const rms = Math.sqrt(wave.reduce((sum, v) => sum + v * v, 0) / wave.length);
      onRMS(rms); onPCM(resample(event.inputBuffer.getChannelData(0)));
    };
    this.gain = this.context.createGain(); this.gain.gain.value = 0;
    this.source.connect(this.analyser); this.analyser.connect(this.processor);
    this.processor.connect(this.gain); this.gain.connect(this.context.destination);
  }
  beginAudio() { this.chunks = []; }
  addAudio(data) { (this.chunks ||= []).push(data); }
  playAudio() {
    const generation = this.generation || 0;
    const chunks = this.chunks || []; this.chunks = [];
    this.queue = (this.queue || Promise.resolve()).catch(() => {}).then(async () => {
      if (generation !== (this.generation || 0)) return;
      const data = await new Blob(chunks, { type: "audio/mpeg" }).arrayBuffer();
      if (!data.byteLength) return;
      const buffer = await this.context.decodeAudioData(data);
      if (generation !== (this.generation || 0)) return;
      await new Promise((resolve) => {
        const source = this.playing = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.context.destination);
        source.onended = () => { if (this.playing === source) this.playing = null; resolve(); }; source.start();
      });
    });
    return this.queue;
  }
  interrupt() { this.generation = (this.generation || 0) + 1; this.chunks = []; this.playing?.stop(); this.playing = null; }
  dispose() {
    this.disposed = true; this.interrupt(); this.stream?.getTracks().forEach((track) => track.stop());
    for (const node of [this.source, this.analyser, this.processor, this.gain]) node?.disconnect();
    if (this.processor) this.processor.onaudioprocess = null;
    this.context?.close();
  }
}
