import { createServer } from "node:http";
import { GET } from "./geocode.js";

export function createApiServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://localhost");
      let result: Response;
      if (request.method !== "GET") {
        request.resume();
        result = Response.json(
          { error: "Method not allowed." },
          { status: 405, headers: { Allow: "GET" } },
        );
      } else if (url.pathname === "/health") {
        result = Response.json({ status: "ok", service: "field-atlas-api" });
      } else if (url.pathname === "/api/geocode") {
        result = await GET(new Request(url));
      } else {
        result = Response.json({ error: "Not found." }, { status: 404 });
      }
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "The API could not complete this request." }));
    }
  });
}
