/** Twelve B2B quantity lines mapped onto the existing six-rate configuration. */
export const captureCatalog = [
  ["documents", "page", "文档扫描", "Documents", "页", "pages", 5000],
  ["manuscripts", "page", "手稿采集", "Manuscripts", "页", "pages", 0],
  ["genealogy", "page", "族谱古籍", "Genealogies / books", "页", "pages", 0],
  ["photos", "photo", "老照片", "Photo prints", "张", "images", 1500],
  ["negatives", "photo", "胶片底片", "Film negatives", "帧", "frames", 0],
  ["slides", "photo", "幻灯片", "Slides", "帧", "frames", 0],
  [
    "cassettes",
    "audioMinute",
    "录音磁带",
    "Audio cassettes",
    "分钟",
    "minutes",
    9000,
  ],
  ["reels", "audioMinute", "开盘录音", "Reel audio", "分钟", "minutes", 0],
  [
    "oral",
    "audioMinute",
    "口述录音数字化",
    "Oral-history audio capture",
    "分钟",
    "minutes",
    0,
  ],
  ["vhs", "videoMinute", "VHS 录像", "VHS video", "分钟", "minutes", 500],
  ["hi8", "videoMinute", "Hi8 录像", "Hi8 video", "分钟", "minutes", 0],
  [
    "betamax",
    "videoMinute",
    "Betamax 录像",
    "Betamax video",
    "分钟",
    "minutes",
    0,
  ],
].map(([id, rate, zh, en, unitZh, unitEn, quantity]) => ({
  id: String(id),
  rate: String(rate),
  zh: String(zh),
  en: String(en),
  unitZh: String(unitZh),
  unitEn: String(unitEn),
  quantity: Number(quantity),
}));
export function captureTotals(quantities) {
  const totals = { page: 0, photo: 0, audioMinute: 0, videoMinute: 0 };
  for (const row of captureCatalog) {
    const n = Number(quantities[row.id] || 0);
    if (!Number.isFinite(n) || n < 0 || n > 100000)
      throw Error("Quantity must be between 0 and 100000.");
    totals[row.rate] += n;
  }
  return {
    pages: totals.page,
    photos: totals.photo,
    tapes: totals.audioMinute / 60,
    tapeMinutes: 60,
    video: totals.videoMinute,
  };
}
