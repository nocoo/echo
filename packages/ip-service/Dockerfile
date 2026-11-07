FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ip-service/package.json ./packages/ip-service/
RUN cd packages/ip-service && bun install --frozen-lockfile

FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS runner
WORKDIR /app/packages/ip-service
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages/ip-service/node_modules ./node_modules
COPY packages/ip-service/src ./src
COPY packages/ip-service/scripts ./scripts
COPY packages/ip-service/package.json ./package.json
COPY packages/ip-service/tsconfig.json ./tsconfig.json
ENV NODE_ENV=production
ENV PORT=7010
ENV IPDB_DIR=/data
EXPOSE 7010
CMD ["bun", "run", "src/index.ts"]
