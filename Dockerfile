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
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
	&& rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/build ./build
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV DATABASE_URL=/app/data/ajar-books.db
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME /app/data
EXPOSE 3000

# Starts as root (needed to fix the bind-mounted volume's ownership) then
# drops to the unprivileged `node` user before ever running app code.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build"]
