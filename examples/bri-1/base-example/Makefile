.PHONY: clean reset restart start start-attached stop

clean:
	docker-compose -f ./ops/splunk/docker-compose.yml down --rmi all --volumes --remove-orphans

logs:
	docker-compose -f ./ops/splunk/docker-compose.yml logs -f

reset: stop clean
	docker-compose -f ./ops/splunk/docker-compose.yml up -d --build --force-recreate --remove-orphans

restart: stop start

start:
	docker-compose -f ./ops/splunk/docker-compose.yml up -d --remove-orphans

start-attached:
	docker-compose -f ./ops/splunk/docker-compose.yml up --remove-orphans

stop:
	docker-compose -f ./ops/splunk/docker-compose.yml down --remove-orphans
