#! /bin/bash

DIR=/etc/superset/init
SUPERSET_INIT_FILE=$DIR/superset
DASHBOARD_INIT_FILE=$DIR/dashboard

set -e

if test -f $SUPERSET_INIT_FILE; then
  echo "Superset init file exists, skipping init"
else
  echo "Starting Superset init"
  /app/docker/superset-init.sh
  touch $SUPERSET_INIT_FILE
fi

if test -f $DASHBOARD_INIT_FILE; then
  echo "Dashboard init file exists, skipping init"
else 
  if [ ! -z "$DASHBOARD_FILE" ]; then
    echo "Starting Dashboard init"
    /app/docker/superset-load-dashboard.sh "$DASHBOARD_FILE"
  fi
  touch $DASHBOARD_INIT_FILE
fi

export SERVER_THREADS_AMOUNT=8
# start up the web server

/usr/bin/run-server.sh