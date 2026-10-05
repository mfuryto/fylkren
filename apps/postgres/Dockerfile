FROM postgres:18-alpine

# The upstream image currently ships a gosu binary built with a vulnerable Go
# standard library. su-exec provides the same one-shot privilege drop without
# keeping that Go runtime in the final image.
RUN apk upgrade --no-cache \
    && apk add --no-cache su-exec \
    && sed -i 's/exec gosu postgres/exec su-exec postgres/' /usr/local/bin/docker-entrypoint.sh \
    && rm -f /usr/local/bin/gosu

COPY --chown=postgres:postgres apps/postgres/pg_hba.fylkren.conf /etc/postgresql/pg_hba.fylkren.conf
COPY --chown=postgres:postgres apps/postgres/pg_ident.fylkren.conf /etc/postgresql/pg_ident.fylkren.conf

USER postgres

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD pg_isready -U "${POSTGRES_USER:-fylkren}" -d "${POSTGRES_DB:-fylkren}" || exit 1
