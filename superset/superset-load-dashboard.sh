#! /bin/bash

set -e

ZIP_FILE=$1
TMP_DIR=/tmp/dashboard
PG_CONFIG_FILE_SUBPATH=/databases/PostgreSQL.yaml

if [ -d $TMP_DIR ]; then
  rm -rf $TMP_DIR
fi

unzip $ZIP_FILE -d $TMP_DIR


for FOLDER in $TMP_DIR/*; do
  if [ -d "$FOLDER" ]; then
    PG_CONFIG_FILE=$FOLDER$PG_CONFIG_FILE_SUBPATH
    echo "Checking $PG_CONFIG_FILE"
    if [ -f $PG_CONFIG_FILE ]; then
      break
    fi
  fi
done

if [ ! -f $PG_CONFIG_FILE ]; then
  echo "PostgreSQL config file not found"
  exit 0
fi

echo "$PG_CONFIG_FILE found"

# Set the sqlalchemy_uri property
PG_CONFIG=$(cat $PG_CONFIG_FILE | yq -y '.sqlalchemy_uri = "postgresql+psycopg2://postgres:postgres@postgres:5432/postgres"')

# Write the modified PG_CONFIG back to the same file
echo "$PG_CONFIG" > $PG_CONFIG_FILE

# Strip extension from filename
# FILENAME=$(basename "$ZIP_FILE")
ZIP_FILE="${ZIP_FILE%.*}"

cd $TMP_DIR
FOLDER_NAME=$(basename $FOLDER)
zip -r "$ZIP_FILE-updated.zip" $FOLDER_NAME

superset import-dashboards -p "$ZIP_FILE-updated.zip" -u admin

rm -rf $TMP_DIR
rm "$ZIP_FILE-updated.zip"