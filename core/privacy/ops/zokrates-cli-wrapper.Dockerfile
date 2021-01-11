FROM zokrates/zokrates:0.6.3 as builder
FROM node:14

ENV ZOKRATES_BIN=/app/zokrates
ENV ZOKRATES_STDLIB=/app/stdlib

RUN mkdir /app
WORKDIR /app

COPY --from=builder /home/zokrates/.zokrates/bin/zokrates $ZOKRATES_BIN
COPY --from=builder /home/zokrates/.zokrates/stdlib $ZOKRATES_STDLIB

COPY package*.json tsconfig*.json jest.config.js ./

RUN npm ci
