#!/bin/bash

pushd deploy && git diff --exit-code --quiet HEAD . && if [ $? -ne 0 ] || [[ ! -dir ./node_modules ]]; then npm ci; fi && popd
