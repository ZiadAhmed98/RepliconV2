# Stage 1: Build the frontend
FROM node:18-alpine AS builder
WORKDIR /app
# Copy everything from the root of your repo
COPY . .
# Install dependencies and build
RUN npm install
RUN npm run build

# Stage 2: Serve with the backend
FROM node:18-alpine
WORKDIR /app
# Copy package files for the backend
COPY package*.json ./
# Install only production dependencies
RUN npm install --only=production
# Copy the built frontend from Stage 1
COPY --from=builder /app/dist ./dist
# Copy the server file from the root
COPY server.js .
# Copy environment file
COPY .env .

EXPOSE 3000
CMD ["node", "server.js"]