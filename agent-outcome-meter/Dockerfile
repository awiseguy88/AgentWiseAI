FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev || npm install
COPY . .
ENV PORT=3000
ENV NODE_ENV=production
ENV DATABASE_URL=postgres://agentmeter:agentmeter@postgres:5432/agentmeter
EXPOSE 3000
CMD ["node", "src/server.js"]
