export interface DensityConfig {
  dpi: string;
  legacy: number;
  fg: number;
  safe: number;
}

export interface PngDimensions {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

export interface IcoImage {
  width: number;
  height: number;
  buffer: Buffer;
}

export interface GenerateIconsOptions {
  sourcePath?: string;
  androidResDir?: string;
  publicDir?: string;
  backgroundColor?: string;
  densities?: DensityConfig[];
  chromium?: { launch: (opts?: unknown) => Promise<unknown> };
}

export const DENSITIES: DensityConfig[];
export const BACKGROUND_COLOR: string;

export function parsePngDimensions(buffer: Buffer): PngDimensions;
export function createIco(images: IcoImage[]): Buffer;
export function updateLauncherBackgroundXml(
  filePath: string,
  color?: string,
): void;
export function generateIcons(options?: GenerateIconsOptions): Promise<void>;
