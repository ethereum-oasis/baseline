#!/bin/bash

docker-compose down --remove-orphans
docker network rm radish34_network-buyer radish34_network-supplier1 radish34_network-supplier2 radish34_geth || true
docker volume rm radish34_mongo-merkle-tree-volume || true