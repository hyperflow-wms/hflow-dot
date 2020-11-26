FROM node:12-alpine
WORKDIR /hflow-tools
COPY . .
RUN npm install -g /hflow-tools
