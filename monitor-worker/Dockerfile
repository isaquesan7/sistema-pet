FROM node:22-alpine
WORKDIR /worker
COPY collect.mjs ./collect.mjs
USER node
CMD ["node", "collect.mjs"]
