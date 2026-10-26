import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  parsePngDimensions,
  createIco,
  updateLauncherBackgroundXml,
  generateIcons,
} from "./generate-icons.mjs";

describe("アプリアイコン生成スクリプト及びアセット配置検証 (AC-ICON-01〜04)", () => {
  const rootDir = process.cwd();

  describe("parsePngDimensions (PNGヘッダー解析)", () => {
    it("有効なPNGバッファから幅・高さ・ビット深度・カラータイプを抽出できること", () => {
      // 1x1 最小PNGバイナリ
      const samplePng = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG Signature
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR length (13)
        0x49,
        0x48,
        0x44,
        0x52, // "IHDR"
        0x00,
        0x00,
        0x01,
        0x00, // width: 256
        0x00,
        0x00,
        0x00,
        0x80, // height: 128
        0x08, // bit depth: 8
        0x06, // color type: 6 (RGBA)
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // CRC
      ]);

      const result = parsePngDimensions(samplePng);
      expect(result).toEqual({
        width: 256,
        height: 128,
        bitDepth: 8,
        colorType: 6,
      });
    });

    it("バッファサイズが24バイト未満の場合はエラーをスローすること", () => {
      const shortBuf = Buffer.alloc(20);
      expect(() => parsePngDimensions(shortBuf)).toThrow(
        "Invalid PNG buffer: too short",
      );
    });

    it("PNGシグネチャが不一致の場合はエラーをスローすること", () => {
      const invalidSigBuf = Buffer.alloc(25);
      expect(() => parsePngDimensions(invalidSigBuf)).toThrow(
        "Invalid PNG signature",
      );
    });
  });

  describe("createIco (マルチアイコンICO生成)", () => {
    it("複数のPNG画像から正常なICOバイナリを構築できること", () => {
      const png16 = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
      const png32 = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);

      const icoBuf = createIco([
        { width: 16, height: 16, buffer: png16 },
        { width: 32, height: 32, buffer: png32 },
      ]);

      // Header: Reserved(0), Type(1), Count(2)
      expect(icoBuf.readUInt16LE(0)).toBe(0);
      expect(icoBuf.readUInt16LE(2)).toBe(1);
      expect(icoBuf.readUInt16LE(4)).toBe(2);

      // Entry 1
      expect(icoBuf.readUInt8(6)).toBe(16); // width
      expect(icoBuf.readUInt8(7)).toBe(16); // height
      expect(icoBuf.readUInt32LE(14)).toBe(png16.length); // size

      // Entry 2
      expect(icoBuf.readUInt8(22)).toBe(32); // width
      expect(icoBuf.readUInt8(23)).toBe(32); // height
      expect(icoBuf.readUInt32LE(30)).toBe(png32.length); // size
    });

    it("256px以上の画像サイズは0としてエントリに記録されること", () => {
      const dummyPng = Buffer.alloc(30);
      const icoBuf = createIco([{ width: 256, height: 256, buffer: dummyPng }]);
      expect(icoBuf.readUInt8(6)).toBe(0);
      expect(icoBuf.readUInt8(7)).toBe(0);
    });

    it("画像配列が空の場合はエラーをスローすること", () => {
      expect(() => createIco([])).toThrow(
        "At least one image is required to create an ICO",
      );
    });
  });

  describe("updateLauncherBackgroundXml (Adaptive Icon 背景色更新)", () => {
    it("指定パスに ic_launcher_background.xml を期待するカラーで作成・更新できること", () => {
      const testXmlPath = path.join(rootDir, "test-output-bg.xml");
      try {
        updateLauncherBackgroundXml(testXmlPath, "#0D0E26");
        const content = fs.readFileSync(testXmlPath, "utf-8");
        expect(content).toContain(
          '<color name="ic_launcher_background">#0D0E26</color>',
        );
      } finally {
        if (fs.existsSync(testXmlPath)) {
          fs.unlinkSync(testXmlPath);
        }
      }
    });
  });

  describe("AC-ICON-01: マスター正本アセット配置検証", () => {
    it("assets/icon.png が存在し、1024x1024 の PNG であること", () => {
      const iconPath = path.join(rootDir, "assets", "icon.png");
      expect(fs.existsSync(iconPath)).toBe(true);

      const buf = fs.readFileSync(iconPath);
      const { width, height } = parsePngDimensions(buf);
      expect(width).toBe(1024);
      expect(height).toBe(1024);
    });
  });

  describe("AC-ICON-02: Android アプリアイコンアセット検証", () => {
    it("ic_launcher_background.xml の背景色が #0D0E26 であること", () => {
      const xmlPath = path.join(
        rootDir,
        "android/app/src/main/res/values/ic_launcher_background.xml",
      );
      expect(fs.existsSync(xmlPath)).toBe(true);
      const content = fs.readFileSync(xmlPath, "utf-8");
      expect(content).toContain(
        '<color name="ic_launcher_background">#0D0E26</color>',
      );
    });

    const densities = [
      { dpi: "mdpi", legacy: 48, fg: 108 },
      { dpi: "hdpi", legacy: 72, fg: 162 },
      { dpi: "xhdpi", legacy: 96, fg: 216 },
      { dpi: "xxhdpi", legacy: 144, fg: 324 },
      { dpi: "xxxhdpi", legacy: 192, fg: 432 },
    ] as const;

    for (const { dpi, legacy, fg } of densities) {
      describe(`mipmap-${dpi} ディレクトリのアセット検証`, () => {
        const dir = path.join(
          rootDir,
          `android/app/src/main/res/mipmap-${dpi}`,
        );

        it(`ic_launcher.png が ${legacy}x${legacy} px であること`, () => {
          const filePath = path.join(dir, "ic_launcher.png");
          expect(fs.existsSync(filePath)).toBe(true);
          const { width, height } = parsePngDimensions(
            fs.readFileSync(filePath),
          );
          expect(width).toBe(legacy);
          expect(height).toBe(legacy);
        });

        it(`ic_launcher_round.png が ${legacy}x${legacy} px であること`, () => {
          const filePath = path.join(dir, "ic_launcher_round.png");
          expect(fs.existsSync(filePath)).toBe(true);
          const { width, height } = parsePngDimensions(
            fs.readFileSync(filePath),
          );
          expect(width).toBe(legacy);
          expect(height).toBe(legacy);
        });

        it(`ic_launcher_foreground.png が ${fg}x${fg} px かつアルファ透過チャンネル（colorType 6）を持つこと`, () => {
          const filePath = path.join(dir, "ic_launcher_foreground.png");
          expect(fs.existsSync(filePath)).toBe(true);
          const { width, height, colorType } = parsePngDimensions(
            fs.readFileSync(filePath),
          );
          expect(width).toBe(fg);
          expect(height).toBe(fg);
          expect(colorType).toBe(6);
        });
      });
    }
  });

  describe("AC-ICON-03: Web アセット配置検証", () => {
    it("public/favicon.ico が存在し、16px, 32px, 48px のマルチ解像度エントリを含むこと", () => {
      const icoPath = path.join(rootDir, "public", "favicon.ico");
      expect(fs.existsSync(icoPath)).toBe(true);
      const buf = fs.readFileSync(icoPath);

      expect(buf.readUInt16LE(0)).toBe(0); // Reserved
      expect(buf.readUInt16LE(2)).toBe(1); // ICO type
      const count = buf.readUInt16LE(4);
      expect(count).toBe(3);

      const sizes = [
        buf.readUInt8(6), // entry 1 width
        buf.readUInt8(22), // entry 2 width
        buf.readUInt8(38), // entry 3 width
      ];
      expect(sizes).toEqual([16, 32, 48]);
    });

    it("public/icon-192.png が存在し、192x192 px であること", () => {
      const filePath = path.join(rootDir, "public", "icon-192.png");
      expect(fs.existsSync(filePath)).toBe(true);
      const { width, height } = parsePngDimensions(fs.readFileSync(filePath));
      expect(width).toBe(192);
      expect(height).toBe(192);
    });

    it("public/icon-512.png が存在し、512x512 px であること", () => {
      const filePath = path.join(rootDir, "public", "icon-512.png");
      expect(fs.existsSync(filePath)).toBe(true);
      const { width, height } = parsePngDimensions(fs.readFileSync(filePath));
      expect(width).toBe(512);
      expect(height).toBe(512);
    });

    it("public/apple-touch-icon.png が存在し、180x180 px であること", () => {
      const filePath = path.join(rootDir, "public", "apple-touch-icon.png");
      expect(fs.existsSync(filePath)).toBe(true);
      const { width, height } = parsePngDimensions(fs.readFileSync(filePath));
      expect(width).toBe(180);
      expect(height).toBe(180);
    });
  });

  describe("AC-ICON-04: generateIcons 自動生成実行検証", () => {
    it("generateIcons() の実行がエラーなく完了すること", async () => {
      await expect(generateIcons()).resolves.not.toThrow();
    }, 30000);
  });
});
