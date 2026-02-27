# Build stage for Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Build stage for Backend
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
# If using TypeScript for backend, run build here
# RUN npm run build

# Final stage
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /app/backend ./
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 8080
ENV PORT=8080
ENV DATA_PATH=/app/data

CMD ["node", "server.js"]
