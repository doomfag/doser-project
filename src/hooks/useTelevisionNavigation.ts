import { useEffect } from "react";
import { nextSpatialIndex, type Direction } from "../domain/spatialNavigation";
export const television = document.documentElement.dataset.doserTv === "true";
export function useTelevisionNavigation() {
  useEffect(() => {
    if (!television) return;
    function controls(): HTMLElement[] {
      const scope = document.querySelector("dialog[open]") ?? document;
      return [
        ...scope.querySelectorAll<HTMLElement>(
          'button,a[href],input,select,textarea,summary,[tabindex="0"]',
        ),
      ].filter(
        (e) =>
          !e.matches(':disabled,[aria-hidden="true"]') &&
          e.getClientRects().length > 0 &&
          getComputedStyle(e).visibility !== "hidden",
      );
    }
    function press(event: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      if (
        event.key === "BrowserBack" ||
        event.key === "Escape" ||
        event.keyCode === 10009 ||
        event.keyCode === 461
      ) {
        const dialog =
          document.querySelector<HTMLDialogElement>("dialog[open]");
        if (dialog) {
          event.preventDefault();
          dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
          return;
        }
        const back = document.querySelector<HTMLButtonElement>(".back");
        if (back) {
          event.preventDefault();
          back.click();
          return;
        }
        if (location.hash && location.hash !== "#home") {
          event.preventDefault();
          location.hash = "home";
          return;
        }
        return;
      }
      if (event.key === "Enter" && active?.matches('input[type="checkbox"]')) {
        event.preventDefault();
        active.click();
        return;
      }
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      )
        return;
      if (active?.matches('textarea,[contenteditable="true"]')) return;
      if (
        active?.matches("input") &&
        ["ArrowLeft", "ArrowRight"].includes(event.key)
      )
        return;
      const elements = controls();
      if (!elements.length) return;
      const current = elements.includes(active!) ? active! : null;
      const next = current
        ? nextSpatialIndex(
            current.getBoundingClientRect(),
            elements.map((e) => e.getBoundingClientRect()),
            event.key as Direction,
          )
        : 0;
      if (next >= 0) {
        event.preventDefault();
        elements[next].focus({ preventScroll: true });
        elements[next].scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
    document.addEventListener("keydown", press);
    const first = controls()[0];
    if (first && !document.activeElement?.closest("dialog"))
      first.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", press);
  }, []);
}
