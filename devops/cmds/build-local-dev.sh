#! /bin/bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $ROOT_DIR/../..

VERSION=$1
if [[ -z "$VERSION" ]]; then
  VERSION="main"
fi

cork-kube build exec \
  -p caskfs \
  -v $VERSION \
  -o sandbox \
  --set-env .env

cork-kube build exec \
  -p project-anduin \
  -v $VERSION \
  -o sandbox \
  --set-env .env