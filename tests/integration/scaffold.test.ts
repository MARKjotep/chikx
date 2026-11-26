import { describe, expect, test } from "bun:test";

const root = new URL("../../", import.meta.url);

interface PackageManifest {
  name?: string;
  private?: boolean;
  type?: string;
  workspaces?: string[];
  bin?: Record<string, string>;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function readManifest(path: string): Promise<PackageManifest> {
  return (await Bun.file(new URL(path, root)).json()) as PackageManifest;
}

describe("workspace scaffold", () => {
  test("root package is the public @chikx/chikx ESM workspace", async () => {
    const pkg = await readManifest("package.json");
    expect(pkg.name).toBe("@chikx/chikx");
    expect(pkg.private).toBeUndefined();
    expect(pkg.type).toBe("module");
    expect(pkg.workspaces).toEqual(["packages/*"]);
  });

  test("@chikx/compiler has no runtime dependencies", async () => {
    const pkg = await readManifest("packages/compiler/package.json");
    expect(pkg.name).toBe("@chikx/compiler");
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  test("@chikx/cli exposes the built Node-compatible chikx bin", async () => {
    const pkg = await readManifest("packages/cli/package.json");
    expect(pkg.name).toBe("@chikx/cli");
    expect(pkg.bin).toEqual({ chikx: "./dist/index.js" });
    expect(pkg.bin?.chikx).toBe(pkg.main);
  });

  test("CLI source entry uses the Node shebang so the built bin runs without Bun", async () => {
    const source = await Bun.file(new URL("packages/cli/src/index.ts", root)).text();
    expect(source.split("\n")[0]).toBe("#!/usr/bin/env node");
  });

  test("language service and VS Code packages are present", async () => {
    const languageService = await readManifest("packages/language-service/package.json");
    const vscode = await readManifest("packages/vscode/package.json");
    expect(languageService.name).toBe("@chikx/language-service");
    expect(vscode.name).toBe("chikx");
  });
});
