FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api-gateway/package.json apps/api-gateway/package.json
COPY apps/auth-service/package.json apps/auth-service/package.json
COPY apps/customer-service/package.json apps/customer-service/package.json
COPY apps/product-service/package.json apps/product-service/package.json
COPY apps/order-service/package.json apps/order-service/package.json
COPY apps/shipment-service/package.json apps/shipment-service/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci --omit=dev

COPY apps ./apps
COPY packages ./packages

ARG SERVICE_NAME
ENV SERVICE_NAME=$SERVICE_NAME
ENV NODE_ENV=production
ENV PROTO_DIR=/app/packages/contracts/proto

USER node
CMD ["sh", "-c", "npm start --workspace @ecommerce/$SERVICE_NAME"]

