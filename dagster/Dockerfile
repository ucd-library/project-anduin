FROM python:3.11-slim

# Install basic tools and dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        bash \
        curl \
        ca-certificates \
        gcc \
        g++ \
        libpq-dev \
        gnupg \
        tini \
    # Add Node.js 20.x (adjust if needed)
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    # Install Dagster
    && pip install --no-cache-dir \
        dagster \
        dagster-graphql \
        dagster-webserver \
        dagster-postgres \
        dagster-docker \
        psycopg2-binary \
    # Clean up
    && apt-get purge -y gcc g++ curl gnupg \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Optional: create non-root user
# RUN useradd -ms /bin/bash dagster
# USER dagster
# WORKDIR /home/dagster

# Set $DAGSTER_HOME and copy dagster.yaml and workspace.yaml there
ENV DAGSTER_HOME=/opt/dagster/dagster_home/

RUN mkdir -p $DAGSTER_HOME

COPY dagster.yaml $DAGSTER_HOME
COPY workspace.yaml $DAGSTER_HOME
WORKDIR $DAGSTER_HOME

# Set default Postgres connection parameters
ENV DAGSTER_POSTGRES_HOST=postgres
ENV DAGSTER_POSTGRES_PORT=5432
ENV DAGSTER_POSTGRES_USER=postgres
ENV DAGSTER_POSTGRES_PASSWORD=postgres
ENV DAGSTER_POSTGRES_DB=dagster

ENTRYPOINT ["tini", "--"]