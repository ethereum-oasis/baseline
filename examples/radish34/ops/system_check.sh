#!/bin/bash

# 12GB = 12 * 1024 * 1024 * 1024 = 12884901888

REQ_BYTES=12884901888
TOTAL_BYTES=$(docker info --format '{{json .MemTotal}}')

if [ $(($TOTAL_BYTES + 0)) -lt $(($REQ_BYTES + 0)) ]; then
    echo "WARNING: Docker needs at least 12GB to run the baseline stack."
    exit 1
fi
