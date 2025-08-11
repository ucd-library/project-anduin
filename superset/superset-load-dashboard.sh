#! /bin/bash

set -e

ZIP_FILE=$1
TMP_DIR=/tmp/dashboard
PG_CONFIG_FILE_SUBPATH=/databases/PostgreSQL.yaml
LOCAL_ZIP_FILE=""

PGHOST=${PGHOST:-"postgres"}
PGPORT=${PGPORT:-"5432"}
PGUSER=${PGUSER:-"postgres"}
PGPASSWORD=${PGPASSWORD:-"postgres"}
PGDATABASE=${PGDATABASE:-"postgres"}

# Check if the file is from Google Cloud Storage
if [[ $ZIP_FILE == gs://* ]]; then
  echo "Google Cloud Storage file detected: $ZIP_FILE"
  
  # Check if gsutil is available
  if ! command -v gsutil &> /dev/null; then
    echo "Error: gsutil is not installed or not in PATH"
    echo "Please install Google Cloud SDK to use gs:// URLs"
    exit 1
  fi

  if [ -z $GOOGLE_APPLICATION_CREDENTIALS ]; then
    echo "Error: GOOGLE_APPLICATION_CREDENTIALS is not set."
    echo 1
  fi

  gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS"

  # Extract filename from GCS path
  GCS_FILENAME=$(basename "$ZIP_FILE")
  LOCAL_ZIP_FILE="/tmp/$GCS_FILENAME"
  
  echo "Copying $ZIP_FILE to $LOCAL_ZIP_FILE"
  gsutil cp "$ZIP_FILE" "$LOCAL_ZIP_FILE"
  
  # Use the local copy for the rest of the script
  ZIP_FILE="$LOCAL_ZIP_FILE"
fi

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

if [[ -f $PG_CONFIG_FILE ]] ; then
  echo "PostgreSQL config file found ($PG_CONFIG_FILE) - updating sqlalchemy_uri"

  # Set the sqlalchemy_uri property
  SQLALCHEMY_URI="postgresql+psycopg2://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
  PG_CONFIG=$(cat $PG_CONFIG_FILE | yq -y ".sqlalchemy_uri = \"${SQLALCHEMY_URI}\"")

  # Write the modified PG_CONFIG back to the same file
  echo "$PG_CONFIG" > $PG_CONFIG_FILE
fi


# Strip extension from filename
# FILENAME=$(basename "$ZIP_FILE")
ZIP_FILE="${ZIP_FILE%.*}"

cd $TMP_DIR
FOLDER_NAME=$(basename $FOLDER)
zip -r "$ZIP_FILE-updated.zip" $FOLDER_NAME

superset import-dashboards -p "$ZIP_FILE-updated.zip" -u admin

rm -rf $TMP_DIR
rm "$ZIP_FILE-updated.zip"

# Clean up the locally downloaded GCS file if it exists
if [ -n "$LOCAL_ZIP_FILE" ] && [ -f "$LOCAL_ZIP_FILE" ]; then
  echo "Cleaning up locally downloaded file: $LOCAL_ZIP_FILE"
  rm "$LOCAL_ZIP_FILE"
fi