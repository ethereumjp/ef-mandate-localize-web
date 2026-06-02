PYTHON ?= python3
BUILD_SCRIPT := scripts/build.py

.PHONY: build pdf markdown clean

build:
	$(PYTHON) $(BUILD_SCRIPT)

pdf:
	$(PYTHON) $(BUILD_SCRIPT)

markdown:
	$(PYTHON) $(BUILD_SCRIPT) --no-pdf

clean:
	rm -rf dist

