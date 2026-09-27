import type { Branding } from "../app/models";

const iconSize = 64;
let revision = 0;

export function logoPlacement(width: number, height: number) {
  if (width <= 0 || height <= 0) return null;
  const scale = Math.min((iconSize - 8) / width, (iconSize - 8) / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  return { x: (iconSize - drawnWidth) / 2, y: (iconSize - drawnHeight) / 2, width: drawnWidth, height: drawnHeight };
}

export function applyBrandingFavicon(branding: Branding) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return () => undefined;
  let active = true;
  const canvas = document.createElement("canvas");
  canvas.width = iconSize;
  canvas.height = iconSize;
  const context = canvas.getContext("2d");
  if (!context) return () => { active = false; };

  function useCanvas() {
    if (active) link!.href = canvas.toDataURL("image/png");
  }

  function drawFallback() {
    context!.clearRect(0, 0, iconSize, iconSize);
    context!.fillStyle = branding.primaryColor;
    context!.fillRect(0, 0, iconSize, iconSize);
    context!.fillStyle = "#ffffff";
    context!.font = "bold 43px sans-serif";
    context!.textAlign = "center";
    context!.textBaseline = "middle";
    context!.fillText(branding.productName.trim().charAt(0).toUpperCase() || "F", iconSize / 2, iconSize / 2 + 2);
    useCanvas();
  }

  if (!branding.hasLogo) {
    drawFallback();
    return () => { active = false; };
  }

  const source = `/api/branding/logo?v=${++revision}`;
  link.href = source;
  const image = new Image();
  image.onload = () => {
    if (!active) return;
    const placement = logoPlacement(image.naturalWidth, image.naturalHeight);
    if (!placement) { drawFallback(); return; }
    context.clearRect(0, 0, iconSize, iconSize);
    context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
    useCanvas();
  };
  image.onerror = () => { if (active) drawFallback(); };
  image.src = source;
  return () => { active = false; };
}
