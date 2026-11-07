import { randomUUID } from "node:crypto";
import app from "./server.js";

const port = Number(process.env.PORT ?? 7010);
const instanceId = process.env.INSTANCE_ID ?? randomUUID();

const server = Bun.serve({
  fetch: app.fetch,
  port,
});

console.log(`echo api instance=${instanceId} port=${server.port}`);
