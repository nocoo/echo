FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ip-service/package.json ./packages/ip-service/
COPY packages/collector/package.json ./packages/collector/
COPY packages/dashboard/package.json ./packages/dashboard/
RUN bun install --frozen-lockfile

FROM deps AS dashboard
WORKDIR /app
COPY packages/dashboard ./packages/dashboard
RUN bun run --cwd packages/dashboard build

FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS runner
WORKDIR /app/packages/ip-service
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages/ip-service/node_modules ./node_modules
COPY packages/ip-service/src ./src
COPY packages/ip-service/scripts ./scripts
COPY packages/ip-service/package.json ./package.json
COPY packages/ip-service/tsconfig.json ./tsconfig.json
COPY --from=dashboard /app/packages/dashboard/dist /app/packages/dashboard/dist
ENV NODE_ENV=production
ENV PORT=7010
ENV IPDB_DIR=/data
ENV STATE_DIR=/state
ENV DASHBOARD_DIR=/app/packages/dashboard/dist
EXPOSE 7010
CMD ["bun", "run", "src/index.ts"]
