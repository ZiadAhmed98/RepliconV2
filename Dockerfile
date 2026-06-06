# Stage 1: Build the frontend + compile native modules (needs build tools)
FROM node:18-alpine AS builder
WORKDIR /app

# Required to compile native Node modules (e.g. better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production — copy pre-built artifacts, no build tools needed
FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache mailcap

COPY package*.json ./

# Copy pre-built node_modules from builder (includes compiled native binaries)
COPY --from=builder /app/node_modules ./node_modules

# Copy built frontend and server
COPY --from=builder /app/dist ./dist
COPY server.js .
COPY lib/ ./lib/
COPY routes/ ./routes/
COPY .env .

EXPOSE 3000
CMD ["node", "server.js"]
