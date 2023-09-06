FROM node:20-alpine
WORKDIR /home/node/app
COPY ["package.json", "package-lock.json*", "./"]
USER node
RUN npm install
COPY ./src ./src
RUN npm build
EXPOSE 3000
CMD [ "node", "dist/index.js" ]