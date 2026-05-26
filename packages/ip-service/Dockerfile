FROM oven/bun:1.3.6 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ip-service/package.json ./packages/ip-service/
RUN cd packages/ip-service && bun install

FROM oven/bun:1.3.6 AS runner
WORKDIR /app/packages/ip-service
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages/ip-service/node_modules ./node_modules
COPY packages/ip-service/ .
RUN bun run ipdb:fetch
ENV PORT=7010
EXPOSE 7010
CMD ["bun", "run", "src/index.ts"]
