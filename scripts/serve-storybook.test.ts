import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createStorybookServer } from "./serve-storybook.mjs";

describe("serve-storybook (R1-39)", () => {
  let tempDir: string;
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    // 一時ディレクトリにダミーの Storybook 静的ファイルを配置
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "storybook-static-test-"));
    fs.writeFileSync(
      path.join(tempDir, "index.html"),
      "<html>Storybook</html>",
    );
    fs.writeFileSync(path.join(tempDir, "test.js"), "console.log('test');");

    server = createStorybookServer({ baseDir: tempDir, port: 0 });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const request = (
    urlPath: string,
  ): Promise<{
    statusCode: number;
    data: string;
    headers: http.IncomingHttpHeaders;
  }> => {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `http://127.0.0.1:${serverPort}${urlPath}`,
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 500,
              data,
              headers: res.headers,
            });
          });
        },
      );
      req.on("error", reject);
    });
  };

  it("ルートパス '/' への GET リクエストで index.html が返されること", async () => {
    const res = await request("/");
    expect(res.statusCode).toBe(200);
    expect(res.data).toBe("<html>Storybook</html>");
    expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
  });

  it("静的アセットへの GET リクエストで該当ファイルと適切な MIME タイプが返されること", async () => {
    const res = await request("/test.js");
    expect(res.statusCode).toBe(200);
    expect(res.data).toBe("console.log('test');");
    expect(res.headers["content-type"]).toBe(
      "application/javascript; charset=utf-8",
    );
  });

  it("存在しないファイルへのリクエストで 404 が返されること", async () => {
    const res = await request("/non-existent.html");
    expect(res.statusCode).toBe(404);
    expect(res.data).toBe("Not Found");
  });

  it("不正な URI エンコード（%E0%A4%A 等）で 400 Bad Request が返されサーバーが落ちないこと (R1-39)", async () => {
    const res = await request("/%E0%A4%A");
    expect(res.statusCode).toBe(400);
    expect(res.data).toBe("Bad Request");
  });

  it("パストラバーサル（../）を含むリクエストで 404 または 403 が返され安全に遮断されること", async () => {
    const res = await request("/../../etc/passwd");
    // 正規化されて baseDir 内で探されるか 403 / 404
    expect([403, 404]).toContain(res.statusCode);
  });
});
