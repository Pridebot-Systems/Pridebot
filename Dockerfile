# Pridebot — bot, API services, and web front-ends in one container.
# Build from a checkout that includes the API/ and Web/ submodules:
#   git clone --recursive <Main repo>
FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so code-only changes reuse this layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Refuse to build without the submodules: API/ and Web/ would be empty and the
# bot would fail at startup instead of here.
RUN test -f API/index.js && test -f Web/pfp/index.html \
  || (echo "API/ or Web/ is empty — clone with --recursive or run: git submodule update --init" && exit 1)

# data/ (generated avatars, shutdown marker) is the only path written at runtime;
# it is mounted as a volume. Everything else stays root-owned and read-only.
RUN mkdir -p data && chown node:node data
USER node

CMD ["node", "Bot/clustermanager.js"]
