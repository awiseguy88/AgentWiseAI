FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
COPY fixtures ./fixtures
COPY public ./public
RUN npm install && npm run build
EXPOSE 8787
CMD ["node", "dist/cli.js", "serve", "--file", "fixtures/runs-30.jsonl", "--port", "8787"]