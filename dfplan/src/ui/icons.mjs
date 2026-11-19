import { html, raw } from "./html.mjs";
const paths = {
  home: "M3 10 12 3l9 7v11H3zM9 21v-7h6v7",
  tasks: "M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1",
  facts: "m4 12 5 5L21 5M3 3h12",
  capture: "M3 4h18v16H3zM3 16l6-7 5 6 3-4 4 5",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z",
  arrow: "m9 5 7 7-7 7",
  people:
    "M3 21v-3a6 6 0 0 1 12 0v3M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8m2 9v-3a6 6 0 0 0-2-4",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  close: "m5 5 14 14M19 5 5 19",
};
export function icon(name) {
  return html`<svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="${paths[name] || paths.tasks}"></path>
  </svg>`;
}
