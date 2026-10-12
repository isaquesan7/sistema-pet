FROM node:22-alpine
WORKDIR /worker
COPY dispatch.mjs ./dispatch.mjs
USER node
CMD ["node", "dispatch.mjs"]
