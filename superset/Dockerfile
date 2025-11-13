FROM apache/superset:6.0.0rc2

USER root

RUN apt update && apt install -y \
  yq \
  zip \
  unzip \
  vim \
  curl \
  gnupg \
  lsb-release \
  && rm -rf /var/lib/apt/lists/*

# Install Google Cloud CLI
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
  && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - \
  && apt update \
  && apt install -y google-cloud-cli \
  && rm -rf /var/lib/apt/lists/*
# Set python3 as gcloud sdk default python interpreter
ENV CLOUDSDK_PYTHON="/usr/bin/python3"

RUN uv pip install --no-cache-dir \
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

CMD [ "/app/docker/superset-start.sh" ]