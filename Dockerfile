# Stage 1: Build the React + Vite app
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine
# Copy the built files from the dist folder (Vite's default output) to Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Expose port 80 for web traffic
EXPOSE 80
# Start Nginx
CMD ["nginx", "-g", "daemon off;"]