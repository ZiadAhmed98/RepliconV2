# Stage 1: Build the frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production server — only what Node needs at runtime
FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache mailcap

COPY package*.json ./
# Install ALL production dependencies from package.json (includes new packages)
RUN npm install --only=production

# Copy built frontend and server
COPY --from=builder /app/dist ./dist
COPY server.js .
COPY .env .

EXPOSE 3000
CMD ["node", "server.js"]
