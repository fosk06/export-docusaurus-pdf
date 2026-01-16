# `docusaurus-export-pdf`

A CLI and Node.js tool to export **Docusaurus-generated documentation websites** to PDF.

> **Enhanced version** with improved sidebar handling and better error recovery for complex Docusaurus documentation structures.

---

## Features

- Export pages from a Docusaurus site to PDF
- CLI tool (`docexport`) for quick command-line usage
- Node.js API (`run` function) for programmatic use
- Supports custom output file paths
- Optional temporary file cleanup
- URL validation (only `http`/`https`)
- Automatically creates output directories

---

## Installation

Globally:

```
npm install -g docusaurus-export-pdf
```

Locally:

```
npm install docusaurus-export-pdf
```

---

## CLI Usage

```
docexport <url> [options]
```

### Options

| Option                    | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `<url>`                   | URL of your Docusaurus site (required)         |
| `-o, --output <filename>` | Output PDF file path (default: `./output.pdf`) |
| `--no-clean`              | Do not clean temporary files                   |
| `-V, --version`           | Show CLI version                               |
| `-h, --help`              | Show help                                      |

### Examples

Export your Docusaurus site to the default `output.pdf`:

```
docexport http://localhost:3000
```

Export to a custom path:

```
docexport http://localhost:3000 -o ./out/docs.pdf
```

Export without cleaning temporary files:

```
docexport http://localhost:3000 --no-clean
```

---

## Programmatic Usage

### Basic Usage

```
import { run } from 'docusaurus-export-pdf';

(async () => {
  const url = 'http://localhost:3000';
  const output = './out/docs.pdf';
  const clean = true;

  await run(url, output, clean);
})();
```

### Advanced Usage with Custom Configuration

```
import { exportToPdf, defaultConfig } from 'docusaurus-export-pdf';

(async () => {
  const url = 'http://localhost:3000';
  const output = './out/docs.pdf';

  const customConfig = {
    ...defaultConfig,
    timeouts: {
      ...defaultConfig.timeouts,
      pageLoad: 15000,
    },
    pdf: {
      ...defaultConfig.pdf,
      width: '1200px',
    },
  };

  await exportToPdf(url, output, customConfig);
})();
```

> **Note:** Only works with Docusaurus-generated documentation. Node.js 16+ is recommended.

---

## Development

```
git clone https://github.com/fosk06/export-docusaurus-pdf.git
cd export-docusaurus-pdf
npm install
node ./bin.js http://localhost:3000 -o ./out/dev.pdf
```

## Improvements in this version

- ✅ **Improved sidebar handling**: Better detection and expansion of collapsible menu items
- ✅ **Multiple click strategies**: Uses JavaScript expansion, force clicks, and fallback methods
- ✅ **Better error recovery**: Continues processing even if some menu items fail
- ✅ **Enhanced visibility checks**: Verifies element visibility before attempting clicks
- ✅ **Timeout handling**: More robust timeout management for complex documentation structures
- ✅ **Refactored codebase**: Clean architecture with separated concerns, better error handling, and structured logging
- ✅ **Modular design**: Services for sidebar expansion, link collection, PDF export, and merging
- ✅ **Configuration management**: Centralized configuration with easy customization

---

## License

MIT
