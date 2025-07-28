#! /bin/bash

DIR=/nf-init
SUPERSET_FILE=$DIR/superset
DASHBOARD_FILE=$DIR/dashboard

set -e

if test -f $SUPERSET_FILE; then
  echo "Superset init file exists, skipping init"
else
  echo "Starting Superset init"
  /app/docker/superset_init.sh
  touch $SUPERSET_FILE
fi

if test -f $DASHBOARD_FILE; then
  echo "Dashboard init file exists, skipping init"
else
  echo "Starting Dashboard init"
  for file in /io/*.zip; do
    echo "Importing $file"
    /app/docker/load_dashboard.sh $file
  done
  touch $DASHBOARD_FILE
fi

export SERVER_THREADS_AMOUNT=8
# start up the web server

/usr/bin/run-server.sh