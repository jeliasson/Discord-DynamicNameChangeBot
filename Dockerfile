FROM node:10
WORKDIR /app

COPY .env .
COPY app.js .
COPY package-lock.json .
COPY package.json .

RUN npm install

ENTRYPOINT [ "node", "app.js" ]