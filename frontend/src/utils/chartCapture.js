import html2canvas from "html2canvas";

export function waitForPaint(frames = 2) {
  return new Promise((resolve) => {
    let remaining = frames;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**

 * @param {HTMLElement} el
 * @param {{ scale?: number, background?: string }} [opts]
 * @returns {Promise<{ dataUrl: string, width: number, height: number } | null>}
 */
export async function captureElementAsPng(el, { scale = 2.5, background = "#ffffff" } = {}) {
  if (!el) return null;
  const canvas = await html2canvas(el, {
    backgroundColor: background,
    scale,
    logging: false,
    useCORS: true,
  });
  return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

/**
 * @param {HTMLElement} containerEl
 * @param {string[]} keys
 * @returns {Promise<Record<string, {dataUrl:string,width:number,height:number}>>}
 */
export async function captureChartsByKey(containerEl, keys, opts) {
  const result = {};
  if (!containerEl) return result;

  for (const key of keys) {
    const wrapper = containerEl.querySelector(`[data-chart-key="${key}"]`);
    if (!wrapper) continue;
    try {
      const captured = await captureElementAsPng(wrapper, opts);
      if (captured) result[key] = captured;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Couldn't capture chart "${key}" for the PDF export`, err);
    }
  }
  return result;
}