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
      ? "These are recording references and manual notes, not an automatic transcript. Audio files must be downloaded separately."
      : "以下为录音索引和手工笔记，并非自动转写。音频文件须分别下载。",
    ...clips.map(
      (clip, index) =>
        `${en ? "Clip" : "片段"} ${index + 1} · ${en ? "Round" : "第"} ${clip.round + 1}${en ? "" : "轮"} · ${recordingTime(clip.duration)}\n${clip.prompt[en ? 1 : 0]}\n${clip.startedAt}\n${clip.filename}\n${clip.incomplete ? (en ? "Interrupted recording; check playback." : "录音曾中断，请回放检查。") + "\n" : ""}${clip.note?.trim() || (en ? "No transcript yet; listen to the recording and add notes." : "尚无文字转写，请播放录音并补充笔记。")}`,
    ),
  ].join("\n\n");
}
