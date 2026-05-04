# Alinhar com Traefik: loadbalancer.server.port=3001
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src/ ./src/
RUN mkdir -p /app/data
ENV PORT=3001
EXPOSE 3001
CMD ["node", "src/server.js"]
