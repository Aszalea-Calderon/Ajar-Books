# syntax=docker/dockerfile:1

FROM node:22-slim AS base
WORKDIR /app
RUN npm install -g pnpm@11

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# SvelteKit's build-time route analysis imports server modules, which requires
# DATABASE_URL to be set even though no real queries run during the build.
ENV DATABASE_URL=./build.db
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/build ./build
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

ENV DATABASE_URL=/app/data/ajar-books.db
RUN mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000

CMD ["node", "build"]
