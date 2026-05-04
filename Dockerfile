# Node 22+ tem WebSocket nativo; mesmo assim o polyfill em server.js cobre Node 20 se precisares.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src/ ./src/
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
