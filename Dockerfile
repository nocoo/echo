FROM oven/bun:1.3.6 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

FROM oven/bun:1.3.6 AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run ipdb:fetch
ENV PORT=7012
EXPOSE 7012
CMD ["bun", "run", "src/index.ts"]
