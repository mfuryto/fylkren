FROM node:24-alpine AS build
WORKDIR /src

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY shared/frontend/package.json shared/frontend/package.json
RUN pnpm install --frozen-lockfile --filter @fylkren/web... --ignore-scripts

COPY apps/web apps/web
COPY shared/frontend shared/frontend
COPY docs docs
COPY assets assets
COPY VERSION README.md CHANGELOG.md SECURITY.md NOTICE.md TRADEMARKS.md ./
RUN pnpm rebuild esbuild && pnpm --filter @fylkren/web build

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
RUN apk upgrade --no-cache \
    && sed -i '/^user[[:space:]]/d; s|^pid[[:space:]].*;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx /etc/nginx/conf.d /usr/share/nginx/html /var/cache/nginx
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1:8080/ || exit 1
