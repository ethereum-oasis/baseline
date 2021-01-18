#!/bin/bash

./stop.sh

docker volume rm radish34_mongo-buyer radish34_mongo-supplier1 radish34_mongo-supplier2 radish34_mongo-merkle-tree-volume radish34_chaindata || true
docker image rm radish34_logger radish34_api-buyer radish34_api-supplier1 radish34_api-supplier2 radish34_deploy radish34_messenger-buyer radish34_messenger-supplier1 radish34_messenger-supplier2 || true 
rm -rf ./config
rm -rf ./zkp/output