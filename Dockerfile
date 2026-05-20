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
COPY package*.json ./
# Install production dependencies only
RUN npm install --only=production
# Copy ONLY the built frontend from the builder stage
COPY --from=builder /app/dist ./dist
# Copy the server and env files
COPY server.js .
COPY .env .

EXPOSE 3000
CMD ["node", "server.js"]