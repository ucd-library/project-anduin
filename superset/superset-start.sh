#! /bin/bash

DIR=/etc/superset/init
SUPERSET_FILE=$DIR/superset
DASHBOARD_FILE=$DIR/dashboard

set -e

if test -f $SUPERSET_FILE; then
  echo "Superset init file exists, skipping init"
else
  echo "Starting Superset init"
  /app/docker/superset-init.sh
  touch $SUPERSET_FILE
fi

if test -f $DASHBOARD_FILE; then
  echo "Dashboard init file exists, skipping init"
else 
  echo "Starting Dashboard init"
  if [ -d /io ]; then
    for file in /io/*.zip; do
      if [ -e "$file" ]; then
        echo "Importing $file"
        /app/docker/superset-load-dashboard.sh "$file"
      fi
    done
  else
    echo "/io directory does not exist, skipping dashboard import"
  fi
  touch $DASHBOARD_FILE
fi

export SERVER_THREADS_AMOUNT=8
# start up the web server

/usr/bin/run-server.sh