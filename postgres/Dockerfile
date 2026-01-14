ARG POSTGRES_IMAGE
FROM ${POSTGRES_IMAGE}

COPY ./01_init_dbs.sql /docker-entrypoint-initdb.d/
COPY ./02_init_anduin_dagster_tables.sh /docker-entrypoint-initdb.d/

RUN mkdir -p /etc/anduin/
COPY ./anduin-dagster.sql /etc/anduin/anduin-dagster.sql