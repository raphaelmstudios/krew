# KREW's container for Fly.io (see fly.toml and the README's "Deploying on Fly.io" section).
# Two stages: the first builds the website and installs the server's packages, the second
# keeps only what's needed to run, so the final image stays small.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Tools for compiling better-sqlite3 and bcrypt, in case a ready-made build isn't available
# for this system. Only needed here, not in the final image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Website: install (including Vite, which the build needs), then build into client/dist.
# npm install rather than npm ci, so a package list and lock file that have drifted slightly
# apart don't stop a deploy.
COPY client/package.json client/package-lock.json client/
RUN cd client && npm install --include=dev --no-audit --no-fund
COPY client client
RUN cd client && npm run build

# Server: production packages only.
COPY server/package.json server/package-lock.json server/
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY server server

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/krew.db \
    UPLOADS_DIR=/data/uploads

COPY --from=build /app/client/dist client/dist
# The server also reads the page titles and descriptions from the website's source
# (server/src/pageMeta.js imports client/src/pageMeta.js), plus the website's package.json,
# which tells Node that file is a modern JavaScript module.
COPY --from=build /app/client/package.json client/package.json
COPY --from=build /app/client/src/pageMeta.js client/src/pageMeta.js
COPY --from=build /app/server server

# The database and uploaded photos live on the volume mounted at /data, never in the image,
# so they survive every restart and redeploy.
EXPOSE 8080
# start.js restores an off-site backup first when backups are set up (optional on Fly,
# where the volume already keeps the data), then starts the server.
CMD ["node", "server/src/start.js"]