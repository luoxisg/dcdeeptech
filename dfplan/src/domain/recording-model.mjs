/** Local recording metadata and prompts; no browser APIs or invented transcripts. */
export const recordingByteLimit = 128 * 1024 * 1024;
export const recordingPrompts = [
  ["讲一件您愿意留下来的往事吧。", "Tell a story you would like to preserve."],
  [
    "那件事里，最让您难忘的一个细节是什么？",
    "What is one detail from that experience you remember most clearly?",
  ],
  [
    "如果现在回头看，您想对当时的自己说什么？",
    "Looking back, what would you say to your younger self?",
  ],
];
export function recordingPrompt(round) {
  return (
    recordingPrompts[round] || [
      "还有什么想补充的？我们可以慢慢说。",
      "Is there anything else you would like to add? Take your time.",
    ]
  );
}
export function recordingExtension(mime) {
  const value = String(mime).toLowerCase().split(";")[0].trim();
  return (
    {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/mp4": "m4a",
      "video/mp4": "m4a",
      "audio/aac": "aac",
      "audio/x-m4a": "m4a",
      "audio/wav": "wav",
    }[value] || "bin"
  );
}
export function recordingTime(ms) {
  const sec = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
  return (
    String(Math.floor(sec / 60)).padStart(2, "0") +
    ":" +
    String(sec % 60).padStart(2, "0")
  );
}
export function recordingDraft(clips, lang = "zh") {
  const en = lang === "en";
  return [
    en
      ? "Oral-history recording notes — pending verification"
      : "口述访谈录音笔记——待核实",
    en
      ? "Recording references, optional machine transcription and manual notes. Machine text is unverified; it is not an automatic factual record. Download audio files separately."
      : "以下为录音索引、机器转写（如有）及手工笔记；机器文字待核实，不代表事实。音频文件须分别下载。",
    ...clips.map(
      (clip, index) =>
        `${en ? "Clip" : "片段"} ${index + 1} · ${en ? "Round" : "第"} ${clip.round + 1}${en ? "" : "轮"} · ${recordingTime(clip.duration)}\n${clip.prompt[en ? 1 : 0]}\n${clip.startedAt}\n${clip.filename}\n${clip.incomplete ? (en ? "Interrupted recording; check playback." : "录音曾中断，请回放检查。") + "\n" : ""}${en ? "Transcript (unverified):" : "转写文字（待核实）："}
${clip.transcript?.trim() || (en ? "No transcript; listen to the recording." : "尚无转写，请回放录音。")}
${clip.transcript?.trim() && clip.transcriptState && clip.transcriptState !== "complete" && clip.transcriptState !== "off" ? (en ? "Transcript may be incomplete." : "转写可能不完整。") + "\n" : ""}${clip.transcriptEdited && clip.machineTranscript ? (en ? "Original machine transcript: " : "原始机器转写：") + clip.machineTranscript + "\n" : ""}${en ? "Manual notes:" : "手工笔记："}
${clip.note?.trim() || (en ? "No manual notes yet." : "尚无手工笔记。")}`,
    ),
  ].join("\n\n");
}
