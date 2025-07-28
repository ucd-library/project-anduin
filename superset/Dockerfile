FROM apache/superset:4.1.3

USER root

RUN apt update && apt install -y \
  yq \
  zip \
  unzip \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
  psycopg2-binary 

RUN mkdir -p /app/docker
WORKDIR /app/docker
COPY superset-init.sh .
COPY superset-start.sh .

WORKDIR /app
COPY superset_config.py  .