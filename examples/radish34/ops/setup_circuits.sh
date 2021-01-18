#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

printf "\nSetting up circuits within ZKP service.\n"

npm run compose:up -- -d --no-recreate zkp
./ops/await_stack.sh

if [ "$1" = "" ]; then
  printf "\nNo circuit selector provided. Defaulting to createMSA/createPO circuits.\n"
  circuit_selector="0"
else
  circuit_selector=$1
fi

case "$circuit_selector" in
  "0")
    if [ ! -d ./zkp/output/createMSA ]; then
        printf "\n${GREEN}*** Running setup for createMSA ***${NC}\n"
        curl -d '{"filepath": "business-logic/createMSA.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys
        printf "\n${GREEN}*** createMSA setup complete ***${NC}\n"
    fi
    if [ ! -d ./zkp/output/createPO ]; then
        printf "\n${GREEN}*** Running setup for createPO ***${NC}\n"
        curl -d '{"filepath": "business-logic/createPO.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys
        printf "\n${GREEN}*** createPO setup complete ***${NC}\n"
    fi
    if [ ! -d ./zkp/output/createAgreement ]; then
        printf "\n${GREEN}*** Running setup for createAgreement ***${NC}\n"
        curl -d '{"filepath": "business-logic/createAgreement.zok", "jwt": "ZKP"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys
        printf "\n${GREEN}*** createAgreement setup complete ***${NC}\n"
    fi
    ;;
  "1")
    if [ ! -d ./zkp/output/createDummyMSA ]; then
      printf "\n${GREEN}*** Running setup for createDummyMSA ***${NC}\n"
      curl -d '{"filepath": "dummy-circuits/createDummyMSA.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys
      printf "\n${GREEN}*** createDummyMSA setup complete ***${NC}\n"
    fi
    if [ ! -d ./zkp/output/createDummyPO ]; then
      printf "\n${GREEN}*** Running setup for createDummyPO ***${NC}\n"
      curl -d '{"filepath": "dummy-circuits/createDummyPO.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys
      printf "\n${GREEN}*** createDummyPO setup complete ***${NC}\n"
    fi
    ;;
  "2")
    if [ ! -d ./zkp/output/createAgreement ]; then
        printf "\n${GREEN}*** Running setup for createAgreement ***${NC}\n"
        curl -d '{"filepath": "business-logic/createAgreement.zok"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys
        printf "\n${GREEN}*** createAgreement setup complete ***${NC}\n"
    fi
    ;;
  *)
    printf "\nDid not receive valid zkp circuit selection.\n\n"
    ;;
esac
    
printf "\nFinished setting up zkp circuits.\n\n"
