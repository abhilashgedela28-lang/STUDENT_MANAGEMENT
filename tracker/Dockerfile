# Stage 1: Build the React client
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Production Server Runner
FROM node:20-alpine
WORKDIR /app

# Set default production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy server package definitions and install production modules
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --no-audit

# Copy server application source code
COPY server/ ./server/

# Copy built React client assets into client/dist so Express serves them directly
COPY --from=client-builder /app/client/dist ./client/dist

# Security: run application as non-root user
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Container healthcheck using existing Actuator endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/actuator/health || exit 1

CMD ["node", "server/src/server.js"]
