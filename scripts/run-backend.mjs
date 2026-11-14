import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") throw new Error("Use dev or start.");

const backend = fileURLToPath(new URL("../backend/", import.meta.url));
const envFile = fileURLToPath(new URL("../backend/.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const python = fileURLToPath(new URL(
  process.platform === "win32"
    ? "../backend/.venv/Scripts/python.exe"
    : "../backend/.venv/bin/python",
  import.meta.url,
));

if (!existsSync(python)) {
  throw new Error("Create backend/.venv and install dependencies; see backend/README.md.");
}

const args = ["-m", "uvicorn", "app.main:app", "--port", "8000"];
if (mode === "dev") args.push("--reload");
const child = spawn(python, args, { cwd: backend, stdio: "inherit" });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
