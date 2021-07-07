FROM radish34_logger

RUN mkdir /app
WORKDIR /app

COPY . .
RUN npm ci

EXPOSE 80
CMD npm run dev
