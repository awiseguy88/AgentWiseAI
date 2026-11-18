FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# no runtime deps; keep image minimal
COPY src ./src
COPY tasks ./tasks
COPY tests ./tests
COPY web ./web
COPY LICENSE README.md PLAN.md ./
RUN mkdir -p /app/data
EXPOSE 3030
ENV DRIFT_GUARD_PORT=3030
CMD ["node", "src/cli.js", "serve", "--port", "3030", "--data-dir", "/app/data"]