.PHONY: build clean mod

clean:
	rm -rf ./.bin 2>/dev/null || true
	rm ./ident 2>/dev/null || true
	go fix ./...
	go clean -i ./...

build: clean mod
	go fmt ./...
	go build -v -o ./.bin/hcs_registry .

mod:
	go mod init 2>/dev/null || true
	go mod tidy
	go mod vendor 
