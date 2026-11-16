# Multi-stage build for minimal offline image
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
COPY src ./src
COPY test ./test
COPY PLAN.md LICENSE README.md ./
ENV NODE_ENV=production
# Default entrypoint runs the test suite
ENTRYPOINT ["node", "src/cli.js"]
CMD ["test", "--offline"]