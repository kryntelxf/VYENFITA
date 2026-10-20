FROM node:24.14.1-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json yarn.lock* ./

RUN yarn install --frozen-lockfile || yarn install

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate

RUN yarn build || npx tsc -p tsconfig.json || echo "build step not configured"

FROM node:24.14.1-alpine AS runner

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN apk add --no-cache openssl dumb-init

COPY package.json yarn.lock* ./

RUN yarn install --frozen-lockfile --production || yarn install --production

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

RUN chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV AI_SERVICE_PORT=3001
ENV AI_SERVICE_HOST=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
