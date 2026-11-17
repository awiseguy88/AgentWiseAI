FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ sqlite-dev
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY web ./web
COPY tests ./tests
COPY LICENSE README.md PLAN.md ./
RUN mkdir -p /app/data
EXPOSE 3400
ENV ICG_PORT=3400
CMD ["node", "src/cli.js", "serve", "--port", "3400", "--data-dir", "/app/data"]