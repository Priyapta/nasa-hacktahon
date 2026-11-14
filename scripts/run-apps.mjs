import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") throw new Error("Use dev or start.");
const root = fileURLToPath(new URL("..", import.meta.url));
const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    } else {
      try { process.kill(-child.pid, "SIGTERM"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
for (const workspace of mode === "dev" ? ["shared", "api", "web"] : ["api", "web"]) {
  const args = [process.env.npm_execpath, "run", mode, "--workspace", `@field-atlas/${workspace}`];
  if (workspace === "web") args.push("--", ...process.argv.slice(3));
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  children.push(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code || 1); });
}
