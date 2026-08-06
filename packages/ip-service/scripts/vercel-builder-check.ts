import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const BUILDER_VERSION = "5.9.5";
const packageDir = path.resolve(import.meta.dir, "..");
const tempRoot = await mkdtemp(path.join(tmpdir(), "echo-vercel-builder-"));
const sourceDir = path.join(tempRoot, "source");
const workDir = path.join(tempRoot, "work");
const builderDir = path.join(tempRoot, "builder");
const previousStrictErrors = process.env.EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS;

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

try {
  await cp(packageDir, sourceDir, {
    recursive: true,
    filter(source) {
      const relative = path.relative(packageDir, source);
      const [firstSegment = ""] = relative.split(path.sep);
      return !["coverage", "data", "node_modules", ".vercel"].includes(firstSegment);
    },
  });
  await mkdir(workDir);
  await mkdir(builderDir);
  await writeFile(
    path.join(builderDir, "package.json"),
    `${JSON.stringify({ private: true }, null, 2)}\n`,
  );

  run("bun", ["add", "--no-save", `@vercel/node@${BUILDER_VERSION}`], builderDir);

  const builderRequire = createRequire(
    path.join(builderDir, "node_modules", "@vercel", "node", "dist", "index.js"),
  );
  const { build } = builderRequire("@vercel/node") as {
    build(options: Record<string, unknown>): Promise<{ output?: { type?: string } }>;
  };
  const { glob } = builderRequire("@vercel/build-utils") as {
    glob(pattern: string, cwd: string): Promise<Record<string, unknown>>;
  };

  process.env.EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS = "1";
  const result = await build({
    files: await glob("**", sourceDir),
    entrypoint: "src/index.ts",
    workPath: workDir,
    repoRootPath: workDir,
    config: { projectSettings: { installCommand: "bun install" } },
    meta: {},
    considerBuildCommand: true,
  });

  if (result.output?.type !== "Lambda") {
    throw new Error(`expected Lambda output, received ${result.output?.type ?? "none"}`);
  }

  const installedPackage = JSON.parse(
    await readFile(path.join(workDir, "node_modules", "typescript7", "package.json"), "utf8"),
  ) as { version?: string };
  if (installedPackage.version !== "7.0.2") {
    throw new Error(`expected TypeScript 7.0.2, received ${installedPackage.version ?? "none"}`);
  }

  console.log(`Vercel builder ${BUILDER_VERSION}: strict TypeScript build produced Lambda`);
} finally {
  if (previousStrictErrors === undefined) {
    delete process.env.EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS;
  } else {
    process.env.EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS = previousStrictErrors;
  }
  await rm(tempRoot, { recursive: true, force: true });
}
