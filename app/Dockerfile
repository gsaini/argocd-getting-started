# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build-once image.
#
# The three build args below are the *only* thing that makes one build differ
# from another. CI passes the git SHA / version / timestamp here so they are
# frozen into the image and travel unchanged through dev -> staging -> prod.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

ENV NODE_ENV=production \
    PORT=8080 \
    APP_VERSION=$APP_VERSION \
    GIT_SHA=$GIT_SHA \
    BUILD_TIME=$BUILD_TIME

WORKDIR /app

# This app is intentionally dependency-free, so there is nothing to npm install.
COPY package.json ./
COPY server.js ./

# Run as a non-root user.
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.js"]
