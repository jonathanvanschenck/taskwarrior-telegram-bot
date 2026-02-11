FROM node:24-alpine

ARG TW_VERSION=2

RUN if [ "$TW_VERSION" = "3" ]; then \
      apk add --no-cache task3; \
    else \
      apk add --no-cache task; \
    fi

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["node", "index.js"]
