import { describe, it, expect } from "vitest";
import { formatByteSize } from "./formatByteSize";

describe("formatByteSize", () => {
  describe("0 または負数、非有限数の場合", () => {
    it("0 bytes の場合は '0 B' を返すこと", () => {
      expect(formatByteSize(0)).toBe("0 B");
    });

    it("負数の場合は '0 B' を返すこと", () => {
      expect(formatByteSize(-1)).toBe("0 B");
      expect(formatByteSize(-1024)).toBe("0 B");
    });

    it("NaN や Infinity などの非有限数の場合は '0 B' を返すこと", () => {
      expect(formatByteSize(NaN)).toBe("0 B");
      expect(formatByteSize(Infinity)).toBe("0 B");
      expect(formatByteSize(-Infinity)).toBe("0 B");
    });
  });

  describe("1024 未満（バイト単位）の場合", () => {
    it("1バイトから1023バイトまで正しく 'X B' 形式でフォーマットされること", () => {
      expect(formatByteSize(1)).toBe("1 B");
      expect(formatByteSize(100)).toBe("100 B");
      expect(formatByteSize(1023)).toBe("1023 B");
    });
  });

  describe("1024 以上 1MB 未満（KB単位）の場合", () => {
    it("1024バイトちょうどで '1.0 KB' を返すこと", () => {
      expect(formatByteSize(1024)).toBe("1.0 KB");
    });

    it("小数を1桁に丸めて '12.5 KB' 形式で返すこと", () => {
      expect(formatByteSize(12800)).toBe("12.5 KB");
    });

    it("1MB 未満の境界値（1048575 バイト）で '1024.0 KB' を返すこと", () => {
      expect(formatByteSize(1024 * 1024 - 1)).toBe("1024.0 KB");
    });
  });

  describe("1MB 以上（MB単位）の場合", () => {
    it("1MB（1048576 バイト）ちょうどで '1.0 MB' を返すこと", () => {
      expect(formatByteSize(1024 * 1024)).toBe("1.0 MB");
    });

    it("1.5MB（1572864 バイト）で '1.5 MB' を返すこと", () => {
      expect(formatByteSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    });

    it("10MB を超える大きな容量でも 'X.X MB' 形式でフォーマットされること", () => {
      expect(formatByteSize(10 * 1024 * 1024)).toBe("10.0 MB");
      expect(formatByteSize(100.25 * 1024 * 1024)).toBe("100.3 MB");
    });
  });
});
