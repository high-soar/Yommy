import type http from "node:http";

export interface CreateStorybookServerOptions {
  baseDir?: string;
  port?: number;
}

export function createStorybookServer(
  options?: CreateStorybookServerOptions,
): http.Server;
