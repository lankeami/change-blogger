.PHONY: clean build fetch generate site serve test

clean:
	rm -rf dist site

build:
	npx tsc

fetch: build
	node dist/fetch.js

generate: build
	node dist/generate.js

site: build fetch generate

serve:
	python3 -m http.server 8080 -d site

test:
	npx vitest run
