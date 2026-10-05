FROM alpine:3.23

RUN apk upgrade --no-cache \
    && apk add --no-cache openssl

COPY apps/tls-init/initialize-internal-tls.sh /usr/local/bin/initialize-internal-tls
RUN chmod 0755 /usr/local/bin/initialize-internal-tls

ENTRYPOINT ["/usr/local/bin/initialize-internal-tls"]
