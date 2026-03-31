FROM node:20-slim AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# Copy source
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/
COPY client/ client/

# Build
FROM base AS build
RUN npm run build

# Production
FROM node:20-slim AS production
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/shared/package.json shared/
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/package.json server/
COPY --from=build /app/client/dist client/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
