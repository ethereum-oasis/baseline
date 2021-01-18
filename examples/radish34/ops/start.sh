#!/bin/bash

npm run system-check
npm run install-config
npm run dockerize 
./ops/dockerCompose_$1.sh
npm run deploy
npm run compose:up -- -d api-buyer api-supplier1 api-supplier2 ui