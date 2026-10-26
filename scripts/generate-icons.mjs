import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

/**
 * Standard Android DPI configurations.
 */
export const DENSITIES = [
  { dpi: "mdpi", legacy: 48, fg: 108, safe: 72 },
  { dpi: "hdpi", legacy: 72, fg: 162, safe: 108 },
  { dpi: "xhdpi", legacy: 96, fg: 216, safe: 144 },
  { dpi: "xxhdpi", legacy: 144, fg: 324, safe: 216 },
  { dpi: "xxxhdpi", legacy: 192, fg: 432, safe: 288 },
];

/**
 * Yommy Dark Navy branding background color.
 */
export const BACKGROUND_COLOR = "#0D0E26";

/**
 * Validates and extracts dimensions from a PNG buffer.
 *
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number, bitDepth: number, colorType: number }}
 */
export function parsePngDimensions(buffer) {
  if (buffer.length < 24) {
    throw new Error("Invalid PNG buffer: too short");
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSignature.length; i++) {
    if (buffer[i] !== pngSignature[i]) {
      throw new Error("Invalid PNG signature");
    }
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  return { width, height, bitDepth, colorType };
}

/**
 * Creates a Windows ICO format binary buffer containing multiple PNG images.
 *
 * @param {Array<{ width: number, height: number, buffer: Buffer }>} images
 * @returns {Buffer}
 */
export function createIco(images) {
  if (!images || images.length === 0) {
    throw new Error("At least one image is required to create an ICO");
  }

  const count = images.length;
  const headerSize = 6;
  const entrySize = 16;
  let currentOffset = headerSize + count * entrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO format
  header.writeUInt16LE(count, 4); // Number of images

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image size in bytes
    entry.writeUInt32LE(currentOffset, 12); // Image data offset
    entries.push(entry);
    currentOffset += img.buffer.length;
  }

  return Buffer.concat([
    header,
    ...entries,
    ...images.map((img) => img.buffer),
  ]);
}

/**
 * Writes or updates ic_launcher_background.xml.
 *
 * @param {string} filePath
 * @param {string} [color]
 */
export function updateLauncherBackgroundXml(
  filePath,
  color = BACKGROUND_COLOR,
) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${color}</color>
</resources>
`;
  fs.writeFileSync(filePath, xmlContent, "utf-8");
}

/**
 * Main icon generator using Playwright Chromium HTML5 Canvas.
 *
 * @param {Object} [options]
 * @param {string} [options.sourcePath]
 * @param {string} [options.androidResDir]
 * @param {string} [options.publicDir]
 * @param {string} [options.backgroundColor]
 * @param {Array<{ dpi: string, legacy: number, fg: number, safe: number }>} [options.densities]
 */
export async function generateIcons(options = {}) {
  const rootDir = process.cwd();
  let sourcePath = options.sourcePath;

  if (sourcePath) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Master icon file not found: ${sourcePath}`);
    }
  } else {
    sourcePath = path.resolve(rootDir, "assets", "icon.png");
    if (!fs.existsSync(sourcePath)) {
      const fallbackPath = path.resolve(rootDir, "reference", "image.png");
      if (fs.existsSync(fallbackPath)) {
        sourcePath = fallbackPath;
      } else {
        throw new Error(`Master icon file not found: ${sourcePath}`);
      }
    }
  }

  const androidResDir =
    options.androidResDir ||
    path.resolve(rootDir, "android", "app", "src", "main", "res");
  const publicDir = options.publicDir || path.resolve(rootDir, "public");
  const bgColor = options.backgroundColor || BACKGROUND_COLOR;
  const densities = options.densities || DENSITIES;

  const sourceBuffer = fs.readFileSync(sourcePath);
  const sourceBase64 = sourceBuffer.toString("base64");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const rendered = await page.evaluate(
      async ({ b64, densityList, backgroundHex }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const srcWidth = img.naturalWidth;
        const srcHeight = img.naturalHeight;

        // 1. Draw source to full canvas to inspect pixels
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = srcWidth;
        fullCanvas.height = srcHeight;
        const fullCtx = fullCanvas.getContext("2d");
        fullCtx.drawImage(img, 0, 0);
        const fullData = fullCtx.getImageData(0, 0, srcWidth, srcHeight).data;

        // 2. Detect squircle bounds inside off-white margin
        const isOuterWhite = (x, y) => {
          const idx = (y * srcWidth + x) * 4;
          return (
            fullData[idx] > 200 &&
            fullData[idx + 1] > 200 &&
            fullData[idx + 2] > 200
          );
        };

        const midX = Math.floor(srcWidth / 2);
        const midY = Math.floor(srcHeight / 2);

        let top = 0;
        let bottom = srcHeight - 1;
        let left = 0;
        let right = srcWidth - 1;

        while (top < midY && isOuterWhite(midX, top)) top++;
        while (bottom > midY && isOuterWhite(midX, bottom)) bottom--;
        while (left < midX && isOuterWhite(left, midY)) left++;
        while (right > midX && isOuterWhite(right, midY)) right--;

        const sw = right - left + 1;
        const sh = bottom - top + 1;

        // 3. Clean source canvas (only inner squircle, outer white made transparent)
        const cleanCanvas = document.createElement("canvas");
        cleanCanvas.width = sw;
        cleanCanvas.height = sh;
        const cleanCtx = cleanCanvas.getContext("2d");
        cleanCtx.drawImage(fullCanvas, left, top, sw, sh, 0, 0, sw, sh);
        const cleanImgData = cleanCtx.getImageData(0, 0, sw, sh);
        const cd = cleanImgData.data;
        for (let i = 0; i < cd.length; i += 4) {
          if (cd[i] > 200 && cd[i + 1] > 200 && cd[i + 2] > 200) {
            cd[i + 3] = 0;
          }
        }
        cleanCtx.putImageData(cleanImgData, 0, 0);

        // 4. Foreground source canvas (illustration only, navy keyed to transparent)
        const fgSourceCanvas = document.createElement("canvas");
        fgSourceCanvas.width = sw;
        fgSourceCanvas.height = sh;
        const fgSourceCtx = fgSourceCanvas.getContext("2d");
        fgSourceCtx.drawImage(cleanCanvas, 0, 0);
        const fgData = fgSourceCtx.getImageData(0, 0, sw, sh);
        const fd = fgData.data;
        for (let i = 0; i < fd.length; i += 4) {
          if (fd[i + 3] === 0) continue;
          const r = fd[i];
          const g = fd[i + 1];
          const b = fd[i + 2];
          // Distance to navy #0D0E26 (13, 14, 38)
          const distNavy = Math.hypot(r - 13, g - 14, b - 38);
          if (distNavy < 25) {
            fd[i + 3] = 0;
          } else if (distNavy < 35) {
            fd[i + 3] = Math.round(((distNavy - 25) / 10) * 255);
          }
        }
        fgSourceCtx.putImageData(fgData, 0, 0);

        const toBase64 = (c) =>
          c.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");

        const androidResults = {};

        // Render Android density assets
        for (const item of densityList) {
          const { dpi, legacy, fg, safe } = item;

          // A: Legacy square (rounded rect)
          const cSquare = document.createElement("canvas");
          cSquare.width = legacy;
          cSquare.height = legacy;
          const ctxSquare = cSquare.getContext("2d");
          ctxSquare.beginPath();
          ctxSquare.roundRect(0, 0, legacy, legacy, legacy * 0.18);
          ctxSquare.fillStyle = backgroundHex;
          ctxSquare.fill();
          ctxSquare.clip();
          const padSq = Math.round(legacy * 0.08);
          ctxSquare.drawImage(
            cleanCanvas,
            padSq,
            padSq,
            legacy - padSq * 2,
            legacy - padSq * 2,
          );

          // B: Legacy round (circle)
          const cRound = document.createElement("canvas");
          cRound.width = legacy;
          cRound.height = legacy;
          const ctxRound = cRound.getContext("2d");
          ctxRound.beginPath();
          ctxRound.arc(legacy / 2, legacy / 2, legacy / 2, 0, Math.PI * 2);
          ctxRound.fillStyle = backgroundHex;
          ctxRound.fill();
          ctxRound.clip();
          const padRd = Math.round(legacy * 0.1);
          ctxRound.drawImage(
            cleanCanvas,
            padRd,
            padRd,
            legacy - padRd * 2,
            legacy - padRd * 2,
          );

          // C: Adaptive foreground
          const cFg = document.createElement("canvas");
          cFg.width = fg;
          cFg.height = fg;
          const ctxFg = cFg.getContext("2d");
          const fgOffset = (fg - safe) / 2;
          ctxFg.drawImage(fgSourceCanvas, fgOffset, fgOffset, safe, safe);

          androidResults[dpi] = {
            legacy: toBase64(cSquare),
            round: toBase64(cRound),
            foreground: toBase64(cFg),
          };
        }

        // Render Web assets
        // 1. icon-192.png
        const c192 = document.createElement("canvas");
        c192.width = 192;
        c192.height = 192;
        const ctx192 = c192.getContext("2d");
        ctx192.fillStyle = backgroundHex;
        ctx192.fillRect(0, 0, 192, 192);
        const pad192 = Math.round(192 * 0.1);
        ctx192.drawImage(
          cleanCanvas,
          pad192,
          pad192,
          192 - pad192 * 2,
          192 - pad192 * 2,
        );

        // 2. icon-512.png
        const c512 = document.createElement("canvas");
        c512.width = 512;
        c512.height = 512;
        const ctx512 = c512.getContext("2d");
        ctx512.fillStyle = backgroundHex;
        ctx512.fillRect(0, 0, 512, 512);
        const pad512 = Math.round(512 * 0.1);
        ctx512.drawImage(
          cleanCanvas,
          pad512,
          pad512,
          512 - pad512 * 2,
          512 - pad512 * 2,
        );

        // 3. apple-touch-icon.png (180x180, strictly opaque)
        const cApple = document.createElement("canvas");
        cApple.width = 180;
        cApple.height = 180;
        const ctxApple = cApple.getContext("2d");
        ctxApple.fillStyle = backgroundHex;
        ctxApple.fillRect(0, 0, 180, 180);
        const padApple = Math.round(180 * 0.1);
        ctxApple.drawImage(
          cleanCanvas,
          padApple,
          padApple,
          180 - padApple * 2,
          180 - padApple * 2,
        );

        // 4. Favicon sizes (16, 32, 48)
        const faviconImages = {};
        for (const fSize of [16, 32, 48]) {
          const cFav = document.createElement("canvas");
          cFav.width = fSize;
          cFav.height = fSize;
          const ctxFav = cFav.getContext("2d");
          ctxFav.beginPath();
          ctxFav.roundRect(0, 0, fSize, fSize, fSize * 0.18);
          ctxFav.fillStyle = backgroundHex;
          ctxFav.fill();
          ctxFav.clip();
          const padFav = Math.max(1, Math.round(fSize * 0.08));
          ctxFav.drawImage(
            cleanCanvas,
            padFav,
            padFav,
            fSize - padFav * 2,
            fSize - padFav * 2,
          );
          faviconImages[fSize] = toBase64(cFav);
        }

        return {
          android: androidResults,
          web: {
            icon192: toBase64(c192),
            icon512: toBase64(c512),
            appleTouchIcon: toBase64(cApple),
            favicons: faviconImages,
          },
        };
      },
      {
        b64: sourceBase64,
        densityList: densities,
        backgroundHex: bgColor,
      },
    );

    // Write Android assets
    for (const item of densities) {
      const { dpi } = item;
      const targetDir = path.join(androidResDir, `mipmap-${dpi}`);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const res = rendered.android[dpi];
      fs.writeFileSync(
        path.join(targetDir, "ic_launcher.png"),
        Buffer.from(res.legacy, "base64"),
      );
      fs.writeFileSync(
        path.join(targetDir, "ic_launcher_round.png"),
        Buffer.from(res.round, "base64"),
      );
      fs.writeFileSync(
        path.join(targetDir, "ic_launcher_foreground.png"),
        Buffer.from(res.foreground, "base64"),
      );
    }

    // Update ic_launcher_background.xml
    const backgroundXmlPath = path.join(
      androidResDir,
      "values",
      "ic_launcher_background.xml",
    );
    updateLauncherBackgroundXml(backgroundXmlPath, bgColor);

    // Write Web assets
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(publicDir, "icon-192.png"),
      Buffer.from(rendered.web.icon192, "base64"),
    );
    fs.writeFileSync(
      path.join(publicDir, "icon-512.png"),
      Buffer.from(rendered.web.icon512, "base64"),
    );
    fs.writeFileSync(
      path.join(publicDir, "apple-touch-icon.png"),
      Buffer.from(rendered.web.appleTouchIcon, "base64"),
    );

    // Create favicon.ico
    const icoImages = [16, 32, 48].map((size) => ({
      width: size,
      height: size,
      buffer: Buffer.from(rendered.web.favicons[size], "base64"),
    }));
    const icoBuffer = createIco(icoImages);
    fs.writeFileSync(path.join(publicDir, "favicon.ico"), icoBuffer);
  } finally {
    await browser.close();
  }
}

// CLI entrypoint
const currentFileUrl = import.meta.url;
const executedFileUrl = pathToFileURL(process.argv[1] || "").href;

if (currentFileUrl === executedFileUrl) {
  generateIcons()
    .then(() => {
      console.log("✅ All icons generated successfully!");
    })
    .catch((err) => {
      console.error("❌ Icon generation failed:", err);
      process.exit(1);
    });
}
