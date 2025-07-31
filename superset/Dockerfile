FROM apache/superset:4.1.3

USER root

RUN apt update && apt install -y \
  yq \
  zip \
  unzip \
  vim \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
  psycopg2-binary \
  authlib

RUN mkdir -p /app/docker
WORKDIR /app/docker
COPY superset-init.sh .
COPY superset-start.sh .
COPY superset-load-dashboard.sh .

WORKDIR /app
COPY superset_config.py  .
COPY custom_security_manager.py .
RUN touch __init__.py
ENV SUPERSET_CONFIG_PATH=/app/superset_config.py
# for loading custom security manager
ENV PYTHONPATH="${PYTHONPATH}:/app" 