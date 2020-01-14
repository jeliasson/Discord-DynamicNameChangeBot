FROM node:10
WORKDIR /app

COPY .env .
COPY app.js .
COPY package-lock.json .
COPY yarn.lock .

RUN yarn install --frozen-lockfile

ENTRYPOINT [ "node", "app.js" ]