FROM node:20-alpine

WORKDIR /app

# Cài dependencies trước (tận dụng layer cache)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend

EXPOSE 3000

# Tự migrate DB rồi khởi động server
CMD ["sh", "-c", "node setup-db.js && node migrate-db.js && node server.js"]
