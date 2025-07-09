#! /bin/bash

DIR=$(dirname "$0")
cd "$DIR"
DIR=$(pwd)

script=$1
if [ -z "$script" ]; then
    echo "Usage: $0 <script>"
    exit 1
fi

if [ ! -d "$script" ]; then
    echo "Script '$script' not found!"
    exit 1
fi

cd "$script"

cmd="dagster dev -f /defs/$script/defs.py"
mount="-v $DIR:/defs"

echo "docker run --rm -it \
    -n dagster-dev \
    -p 3000:3000 \
    $mount \
    --entrypoint bash \
    dagster:latest -c \"$cmd\""

docker run --rm -it \
    --name dagster-dev \
    -p 3000:3000 \
    $mount \
    --entrypoint bash \
    dagster:latest -c bash