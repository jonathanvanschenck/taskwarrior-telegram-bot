FROM node:24-alpine
LABEL authors="Jonathan D. B. Van Schenck"

LABEL org.opencontainers.image.description="Telegram bot interface for Taskwarrior task management"
LABEL org.opencontainers.image.source="https://github.com/jonathanvanschenck/taskwarrior-telegram-bot"
LABEL org.opencontainers.image.license="ISC"
LABEL org.opencontainers.image.authors="Jonathan D. B. Van Schenck"

ARG TW_VERSION=2

RUN if [ "$TW_VERSION" = "3" ]; then \
      apk add --no-cache task3; \
    else \
      apk add --no-cache task; \
    fi

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js env.js ./
COPY lib/ ./lib/

CMD ["node", "index.js"]
