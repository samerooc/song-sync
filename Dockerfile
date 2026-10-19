# Production Dockerfile for SyncRoom
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and subpackage package files
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN npm --prefix server install
RUN npm --prefix client install

# Copy source code
COPY . .

# Build frontend production bundle
RUN npm --prefix client run build

# Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 4000

CMD ["node", "server/src/server.js"]
