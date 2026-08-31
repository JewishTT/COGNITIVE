# ========================================================================
# COGNITIVE Frontend - Vue 3 Dockerfile
# ========================================================================

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY frontend/ ./frontend/

# Build application
RUN npm run build

# Stage 2: Production - Nginx
FROM nginx:alpine AS production

# Copy built files
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy public assets
COPY frontend/public/ /usr/share/nginx/html/public/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
