import { createApiServer } from "./app.js";

const port = Number(process.env.API_PORT || 4000);
const host = process.env.API_HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("API_PORT must be an integer between 1 and 65535.");

const server = createApiServer();
server.on("error", (error) => {
  console.error(`API could not start: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`Field Atlas API: http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close());
}
