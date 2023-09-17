FROM node:20-alpine

WORKDIR /app

COPY . /app/
RUN npm install
RUN npm run build

EXPOSE 4000

CMD ["node", "dist/index.js"]
