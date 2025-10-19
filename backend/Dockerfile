FROM node:20-alpine
WORKDIR /usr/src/app

COPY package*.json tsconfig*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "run", "start:prod"]
