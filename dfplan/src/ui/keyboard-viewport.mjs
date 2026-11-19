/** Keep each sheet inside the visual viewport without replacing the active form. */
export function installKeyboardAvoidance() {
  const viewport = window.visualViewport;
  const update = () => {
    const height = viewport?.height || window.innerHeight;
    const inset = Math.max(
      0,
      window.innerHeight - height - (viewport?.offsetTop || 0),
    );
    document.documentElement.style.setProperty(
      "--visual-height",
      height + "px",
    );
    document.documentElement.style.setProperty(
      "--keyboard-inset",
      inset + "px",
    );
    const active = /** @type {HTMLElement} */ (document.activeElement);
    if (
      active?.closest("dialog[open]") &&
      active.matches("input,textarea,select")
    )
      requestAnimationFrame(() =>
        active.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "auto",
        }),
      );
  };
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  document.addEventListener("focusin", update);
  update();
  return () => {
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    document.removeEventListener("focusin", update);
  };
}
export function installSwipeDismiss(dialog, close) {
  let start = null,
    delta = 0;
  dialog.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-sheet-handle]")) {
      start = { x: event.clientX, y: event.clientY };
      dialog.setPointerCapture?.(event.pointerId);
    }
  });
  dialog.addEventListener("pointermove", (event) => {
    if (!start) return;
    delta = Math.max(0, event.clientY - start.y);
    if (Math.abs(event.clientX - start.x) < 60)
      dialog.style.translate = `0 ${delta}px`;
  });
  const finish = () => {
    if (!start) return;
    start = null;
    dialog.style.translate = "";
    if (delta >= 80) close();
    delta = 0;
  };
  dialog.addEventListener("pointerup", finish);
  dialog.addEventListener("pointercancel", () => {
    start = null;
    dialog.style.translate = "";
  });
}
