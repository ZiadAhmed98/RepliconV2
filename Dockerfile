# Stage 1: Build the frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# This creates the /app/dist folder
RUN npm run build 

# Stage 2: Serve with the backend
FROM node:18-alpine
WORKDIR /app

# Add the Linux dictionary for MIME types
RUN apk add --no-cache mailcap

COPY package*.json ./
# Install production dependencies only
RUN npm install --omit=dev

# Copy ONLY the built frontend from the builder stage
COPY --from=builder /app/dist ./dist
# Copy the server files
COPY server.js .
COPY server/ ./server/

# Run as non-root user
USER node

EXPOSE 3000
CMD ["node", "server.js"]