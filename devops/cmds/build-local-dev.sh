#! /bin/bash

VERSION=$1
if [[ -z "$VERSION" ]]; then
  VERSION="main"
fi

cork-kube build exec \
  -p project-anduin \
  -v $VERSION \
  -o sandbox