// Minimal shims for the Node builtins used by the i18n parity tests.
// This project has no @types/node; Vitest executes tests on Node, so these
// resolve at runtime.

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:path" {
  export function resolve(...paths: string[]): string;
}

interface ImportMeta {
  readonly dirname: string;
}