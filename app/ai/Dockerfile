# VYENFITA AI Service Dockerfile
FROM node:24.14.1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Production image
FROM node:24.14.1-alpine

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.env.example ./.env.example

# Environment variables
ENV NODE_ENV=production
ENV AI_SERVICE_PORT=3001
ENV AI_SERVICE_HOST=0.0.0.0

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/ai/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the service
CMD ["node", "dist/index.js"]
