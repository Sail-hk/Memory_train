FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY client/package*.json ./client/
RUN npm --prefix client ci

COPY . .
RUN npm run build && rm -rf client/node_modules

ENV PORT=3001
ENV DB_PATH=/app/data/memory.db

EXPOSE 3001
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
