# Multi-stage build: compile the Vite SPA, then serve it with nginx.
# VITE_* env vars are baked into the bundle at build time, so the backend
# URL is passed via --build-arg from Cloud Build, not at runtime.

FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Cloud Run injects $PORT. nginx:alpine's entrypoint runs envsubst on
# /etc/nginx/templates/*.template before starting nginx.
ENV PORT=8080
EXPOSE 8080
