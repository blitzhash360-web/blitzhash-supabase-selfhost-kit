FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY lib ./lib
COPY server.mjs ./
COPY public ./public
ENV NODE_ENV=production
EXPOSE 9100
USER node
CMD ["node", "server.mjs"]
