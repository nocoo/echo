import app from "./server";

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  fetch: app.fetch,
  port,
});

console.log(`echo api listening on :${server.port}`);
