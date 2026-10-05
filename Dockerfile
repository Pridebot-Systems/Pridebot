FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN test -f API/index.js && test -f Web/pfp/index.html \
  || (echo "API/ or Web/ is empty — clone with --recursive or run: git submodule update --init" && exit 1)

RUN mkdir -p data && chown node:node data
USER node

CMD ["node", "Bot/clustermanager.js"]
