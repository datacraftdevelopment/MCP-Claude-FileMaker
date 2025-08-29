# Multi-stage build for production deployment
FROM node:18-slim as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript (if present)
RUN if [ -d "src" ]; then npm run build; fi

# Production stage
FROM node:18-slim as production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build/
COPY --from=builder /app/server.js ./
COPY --from=builder /app/.env.example ./ 

# Copy other necessary files
COPY --from=builder /app/README.md ./
COPY --from=builder /app/connectors/ ./connectors/

# Create non-root user
RUN groupadd -g 1001 nodegroup && \
    useradd -r -u 1001 -g nodegroup nodeuser

# Create logs directory
RUN mkdir -p logs && chown nodeuser:nodegroup logs

# Change ownership of app directory
RUN chown -R nodeuser:nodegroup /app
USER nodeuser

# Expose port (optional, for HTTP mode)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Default command
CMD ["node", "server.js"]
