-include .env
export

.PHONY: clean build fetch generate site serve test local report report-generate upload report-upload

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

report-generate: build
	node dist/report.js

report: build fetch report-generate
	open site/report.html

upload: build
	node dist/upload.js

report-upload: build fetch report-generate upload
