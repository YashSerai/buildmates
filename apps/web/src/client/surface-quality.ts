export type RenderedSurfaceIssue = {
  code: "clipped_text" | "low_contrast" | "small_text" | "horizontal_overflow" | "opening_dead_space";
  message: string;
};

export function auditRenderedSurface(root: HTMLElement): RenderedSurfaceIssue[] {
  const issues: RenderedSurfaceIssue[] = [];
  if (root.scrollWidth > root.clientWidth + 1) {
    issues.push({ code: "horizontal_overflow", message: "The page extends beyond its preview width." });
  }
  const seen = new Set<string>();
  const iframe = root.querySelector<HTMLIFrameElement>("iframe.surface-generated-site");
  const generatedRoot = iframe?.contentDocument?.body ?? null;
  if (generatedRoot && generatedRoot.scrollWidth > generatedRoot.clientWidth + 1) add({ code: "horizontal_overflow", message: "The generated page extends beyond its preview width." });
  if (generatedRoot && hasEmptyOpeningComposition(generatedRoot)) add({ code: "opening_dead_space", message: "The opening leaves too much empty space before the main profile content." });
  const auditRoot = generatedRoot ?? root;
  for (const element of auditRoot.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,li,dt,dd,a,button,strong,span")) {
    if (!isVisibleText(element)) continue;
    const style = getComputedStyle(element);
    const size = Number.parseFloat(style.fontSize);
    if (size < 12) add({ code: "small_text", message: `Text is too small near "${sample(element)}".` });
    if (isClipped(element, auditRoot)) add({ code: "clipped_text", message: `Text is clipped near "${sample(element)}".` });
    const ratio = contrastAgainstResolvedBackground(element);
    const threshold = size >= 24 || (size >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700) ? 3 : 4.5;
    if (ratio !== null && ratio < threshold) add({ code: "low_contrast", message: `Text contrast is too low near "${sample(element)}".` });
  }
  function add(issue: RenderedSurfaceIssue) {
    const key = `${issue.code}:${issue.message}`;
    if (!seen.has(key) && issues.length < 12) {
      seen.add(key);
      issues.push(issue);
    }
  }
  return issues;
}

function hasEmptyOpeningComposition(root: HTMLElement) {
  const heading = root.querySelector<HTMLElement>("h1");
  const opening = heading?.closest<HTMLElement>("header,section,article,main");
  if (!heading || !opening) return false;
  const openingRect = opening.getBoundingClientRect();
  const headingRect = heading.getBoundingClientRect();
  if (openingRect.height < 640 || openingRect.width < 280) return false;
  const style = getComputedStyle(opening);
  const hasVisual = style.backgroundImage !== "none" || Boolean(opening.querySelector("img,picture,figure"));
  if (hasVisual) return false;
  const emptyBeforeHeading = headingRect.top - openingRect.top;
  const maximumIntentionalGap = Math.max(320, Math.min(640, openingRect.width * 0.45));
  return emptyBeforeHeading > maximumIntentionalGap && emptyBeforeHeading / openingRect.height > 0.45;
}

function isVisibleText(element: HTMLElement) {
  if (element.closest('[aria-hidden="true"]')) return false;
  const style = getComputedStyle(element);
  return Boolean(element.textContent?.trim()) && style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity) > 0;
}

function isClipped(element: HTMLElement, root: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const elementStyle = getComputedStyle(element);
  const clipsX = elementStyle.overflowX === "hidden" || elementStyle.overflowX === "clip";
  const clipsY = elementStyle.overflowY === "hidden" || elementStyle.overflowY === "clip";
  // Browser font metrics commonly make scrollHeight a few pixels taller than
  // clientHeight even when visible text is fully rendered. Treat an element's
  // own dimensions as clipping only when that axis actually clips overflow.
  if ((clipsX && element.scrollWidth > element.clientWidth + 1) ||
      (clipsY && element.scrollHeight > element.clientHeight + 1)) return true;
  for (let parent = element.parentElement; parent && parent !== root.parentElement; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (![style.overflow, style.overflowX, style.overflowY].some((value) => value === "hidden" || value === "clip")) continue;
    const boundary = parent.getBoundingClientRect();
    if (rect.left < boundary.left - 1 || rect.right > boundary.right + 1 || rect.top < boundary.top - 1 || rect.bottom > boundary.bottom + 1) return true;
  }
  return false;
}

function contrastAgainstResolvedBackground(element: HTMLElement) {
  const foreground = parseRgb(getComputedStyle(element).color);
  if (!foreground) return null;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.backgroundImage !== "none") return null;
    const background = parseRgb(style.backgroundColor);
    if (background && background[3] >= 0.98) return contrast(foreground, background);
  }
  return contrast(foreground, [255, 255, 255, 1]);
}

function parseRgb(value: string): [number, number, number, number] | null {
  const match = value.match(/rgba?\((?:\s*)([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
}

function contrast(a: [number, number, number, number], b: [number, number, number, number]) {
  const luminance = ([r, g, blue]: [number, number, number, number]) => {
    const channels = [r, g, blue].map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function sample(element: HTMLElement) {
  const value = element.textContent?.replace(/\s+/g, " ").trim() ?? "text";
  return value.length > 42 ? `${value.slice(0, 39)}...` : value;
}
