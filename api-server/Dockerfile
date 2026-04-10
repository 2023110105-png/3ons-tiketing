FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3002
ENV NODE_OPTIONS="--max-old-space-size=512"

EXPOSE 3002

CMD ["npm", "start"]

