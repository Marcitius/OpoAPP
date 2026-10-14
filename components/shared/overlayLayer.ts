let layer = 12000;
export const nextOverlayLayer = () => ++layer;
export function isTopOverlay(el: HTMLElement) {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-overlay-layer]"))
      .sort(
        (a, b) =>
          Number(a.dataset.overlayLayer) - Number(b.dataset.overlayLayer),
      )
      .at(-1) === el
  );
}
