/** Scripted oral-history prototype. These examples are not facts about a real family. */
export const interviewStates = [
  "idle",
  "speaking",
  "listening",
  "thinking",
  "complete",
];
const transitions = {
  idle: ["speaking"],
  speaking: ["listening", "idle"],
  listening: ["thinking", "idle"],
  thinking: ["speaking", "complete", "idle"],
  complete: ["idle"],
};
export const canInterviewTransition = (from, to) =>
  transitions[from]?.includes(to) || false;
export const elderPauseMs = 3500;
export const interviewScript = [
  {
    prompt: [
      "您好，我们慢慢聊。您记忆里家里最早开始做小生意，是在哪一年呢？",
      "Let’s take our time. Around what year did your family first start its small business?",
    ],
    raw: [
      "嗯……让我想想，大概是1982年吧，祖父天还没亮，就推着木板车去老码头卖热茶和干货。",
      "Let me think… perhaps around 1982. Before dawn, Grandfather would push a wooden cart to the old harbour to sell tea and dried goods.",
    ],
    clean: [
      "据口述者回忆，约1982年，祖父清晨推着木板车到老码头售卖热茶与干货。年份及具体地点尚待核实。",
      "The narrator recalls that around 1982, Grandfather took a wooden cart to the old harbour before dawn to sell tea and dried goods. The year and location remain unverified.",
    ],
    entities: [
      ["time", "约1982年", "Around 1982"],
      ["person", "祖父", "Grandfather"],
      ["place", "老码头", "Old harbour"],
    ],
    check: [
      "起业年份、月份及老码头的具体位置待核实。",
      "Verify the year, month and exact harbour location.",
    ],
  },
  {
    prompt: [
      "当时除了祖父，还有谁一起搭把手？有没有让您印象深刻的小事？",
      "Who helped Grandfather then? Is there a small moment you remember?",
    ],
    raw: [
      "叔公那时候年轻，经常帮着从驳船上扛麻袋。下雨天，码头上的工人还借帆布棚子给我们遮雨。",
      "Great-uncle was young then and often helped carry sacks from the barges. When it rained, dock workers lent us a canvas shelter.",
    ],
    clean: [
      "口述者提到叔公协助搬运货品，码头工友曾借出帆布棚遮雨。人物身份与事件细节尚待核实。",
      "The narrator describes a great-uncle helping to move goods and dock workers lending a canvas shelter. The identities and event details remain unverified.",
    ],
    entities: [
      ["person", "叔公", "Great-uncle"],
      ["place", "驳船泊位", "Barge berth"],
    ],
    check: [
      "叔公本名、当年年龄及其他知情者待核实。",
      "Verify the great-uncle’s name, age at the time and other witnesses.",
    ],
  },
  {
    prompt: [
      "后来，小摊位是怎样发展成老铺子的？不确定的年份也可以先保留。",
      "How did the stall become a shop? It’s fine to leave uncertain dates open.",
    ],
    raw: [
      "大概八十年代中后期，祖父攒下本钱，在老街口租了半间铺面，挂上家里的第一块木匾。",
      "Around the mid-to-late 1980s, Grandfather saved enough to rent half a shop at the old street corner and put up our first wooden sign.",
    ],
    clean: [
      "据回忆，二十世纪八十年代中后期，祖父在老街口租下半间铺面并挂起木匾。商号、门牌和日期尚待核实。",
      "The narrator recalls that in the mid-to-late 1980s, Grandfather rented half a shop at the old street corner and put up a wooden sign. The business name, address and dates remain unverified.",
    ],
    entities: [
      ["time", "1980年代中后期", "Mid-to-late 1980s"],
      ["place", "老街口铺面", "Shop at the old street corner"],
      ["tag", "首块木匾", "First wooden sign"],
    ],
    check: [
      "商号全称、门牌号及开铺日期待核实。",
      "Verify the business name, street number and opening date.",
    ],
  },
];
export function collectInterviewEntities(turns) {
  const seen = new Set();
  return turns
    .flatMap((index) => interviewScript[index]?.entities || [])
    .filter((entity) => {
      const key = entity[0] + ":" + entity[1];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function interviewDraft(turns, language = "zh") {
  const lang = language === "en" ? 1 : 0;
  return {
    title: turns.length
      ? lang
        ? "Old harbour family business — unverified sample draft"
        : "老码头创业往事——待核实示例初稿"
      : lang
        ? "Oral-history draft"
        : "口述访谈初稿",
    body: turns
      .map((index) => interviewScript[index]?.clean[lang] || "")
      .join("\n\n"),
    checks: turns.map((index) => interviewScript[index]?.check[lang] || ""),
    entities: collectInterviewEntities(turns),
  };
}
