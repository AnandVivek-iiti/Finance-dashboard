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
 * @param {SVGSVGElement} svgEl
 * @param {{ scale?: number, background?: string }} [opts]
 * @returns {Promise<{ dataUrl: string, width: number, height: number } | null>}
 */
export async function captureSvgAsPng(svgEl, { scale = 2.5, background = "#ffffff" } = {}) {
  if (!svgEl) return null;

  const rect = svgEl.getBoundingClientRect();
  const width = rect.width || svgEl.width?.baseVal?.value;
  const height = rect.height || svgEl.height?.baseVal?.value;
  if (!width || !height) return null;

  const clone = svgEl.cloneNode(true);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to rasterize chart SVG"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**

 * @param {HTMLElement} containerEl
 * @param {string[]} keys
 * @returns {Promise<Record<string, {dataUrl:string,width:number,height:number}>>}
 */
export async function captureChartsByKey(containerEl, keys, opts) {
  const result = {};
  if (!containerEl) {
    // eslint-disable-next-line no-console
    console.error("captureChartsByKey: container isn't mounted - no charts will be included in the export.");
    return result;
  }

  for (const key of keys) {
    const wrapper = containerEl.querySelector(`[data-chart-key="${key}"]`);
    const svg = wrapper?.querySelector("svg.recharts-surface") || wrapper?.querySelector("svg");
    if (!svg) continue;
    try {
      const captured = await captureSvgAsPng(svg, opts);
      if (captured) result[key] = captured;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Couldn't capture chart "${key}" for the PDF export`, err);
    }
  }
  return result;
}