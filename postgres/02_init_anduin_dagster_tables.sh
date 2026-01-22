#!/usr/bin/env bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "dagster" \
  -f /etc/anduin/anduin-dagster.sql