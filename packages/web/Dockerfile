FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/web/package*.json ./packages/web/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/web ./packages/web
COPY packages/shared ./packages/shared

# Build shared package
RUN npm run build --workspace=@luxai/shared

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@luxai/web", "--", "--host"]
