FROM node:16-alpine

USER nobody

# ensure all directories exist
WORKDIR /app

EXPOSE 4000

CMD ["node", "dist/index.js"]
