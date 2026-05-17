FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
