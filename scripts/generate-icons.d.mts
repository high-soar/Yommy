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
  outputDir?: string;
  androidResDir?: string;
  publicDir?: string;
}

export function parsePngDimensions(buffer: Buffer): PngDimensions;
export function createIco(images: IcoImage[]): Buffer;
export function updateLauncherBackgroundXml(
  filePath: string,
  color?: string,
): void;
export function generateIcons(options?: GenerateIconsOptions): Promise<void>;
