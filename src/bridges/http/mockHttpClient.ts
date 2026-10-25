import type {
  HttpClientBridge,
  HttpRequestOptions,
  HttpResponse,
} from "./types";

export type MockResponseHandler =
  | Partial<HttpResponse>
  | ((options: HttpRequestOptions) => HttpResponse | Promise<HttpResponse>);

interface MockRoute {
  pattern: string | RegExp;
  handler: MockResponseHandler;
}

export class MockHttpClient implements HttpClientBridge {
  private routes: MockRoute[] = [];

  setResponse(
    urlPattern: string | RegExp,
    response: MockResponseHandler,
  ): void {
    const index = this.routes.findIndex((r) =>
      r.pattern instanceof RegExp && urlPattern instanceof RegExp
        ? r.pattern.source === urlPattern.source &&
          r.pattern.flags === urlPattern.flags
        : r.pattern === urlPattern,
    );
    if (index >= 0) {
      this.routes[index] = { pattern: urlPattern, handler: response };
    } else {
      this.routes.push({ pattern: urlPattern, handler: response });
    }
  }

  reset(): void {
    this.routes = [];
  }

  async getHtml(options: HttpRequestOptions): Promise<HttpResponse> {
    if (options.signal?.aborted) {
      throw options.signal.reason;
    }

    const matched = this.routes.find((route) => {
      if (typeof route.pattern === "string") {
        return route.pattern === options.url;
      }
      return route.pattern.test(options.url);
    });

    if (!matched) {
      throw new Error(
        `[MockHttpClient] No mock response configured for URL: ${options.url}`,
      );
    }

    const resolved =
      typeof matched.handler === "function"
        ? await matched.handler(options)
        : matched.handler;

    return {
      status: resolved.status ?? 200,
      url: resolved.url ?? options.url,
      html: resolved.html ?? "",
      headers: resolved.headers ?? {},
    };
  }
}
