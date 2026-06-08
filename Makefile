-include .env
export

.PHONY: clean build fetch generate site serve test local report

local: clean site serve

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
	python3 -m http.server $(or $(PORT),8000) -d site

test:
	npx vitest run

report: site
	open site/index.html
