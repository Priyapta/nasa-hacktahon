import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const backend = fileURLToPath(new URL("../backend/", import.meta.url));
const envFile = `${backend}.env`;
if (existsSync(envFile)) process.loadEnvFile(envFile);
const python = `${backend}.venv/${process.platform === "win32" ? "Scripts/python.exe" : "bin/python"}`;
const result = spawnSync(python, ["-m", "app.migrate"], { cwd: backend, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
