import app from "./server.js";

const port = Number(process.env.PORT ?? 7012);

const server = Bun.serve({
  fetch: app.fetch,
  port,
});

console.log(`echo api listening on :${server.port}`);
