#!/bin/bash

npm run compose:up -- -d ganache messenger-buyer messenger-supplier1 messenger-supplier2
npm run await-stack
npm run compose:run -- --rm deploy
npm run compose:restart -- merkle-tree api-buyer api-supplier1 api-supplier2