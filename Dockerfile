FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache python3 make g++ && npm ci --omit=dev && apk del python3 make g++

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]