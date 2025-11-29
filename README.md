# SF Flow Visualizer

A VS Code extension to visualize Salesforce Flow XML files with an interactive diagram.

## Features

- 🎨 **Visual Flow Diagram** - See your Salesforce Flows as interactive diagrams
- 🔍 **Node Details** - Click any node to view its properties and XML
- 🔄 **Auto Layout** - Automatically arranges nodes for better visibility
- 🖱️ **Pan & Zoom** - Navigate large flows easily with drag and scroll
- 📁 **Context Menu** - Right-click any `.flow-meta.xml` file to visualize

## Supported Flow Elements

| Element Type | Support |
|--------------|---------|
| Start | ✅ |
| Screens | ✅ |
| Decisions | ✅ |
| Assignments | ✅ |
| Loops | ✅ |
| Record Create | ✅ |
| Record Update | ✅ |
| Record Lookup | ✅ |
| Record Delete | ✅ |
| Actions | ✅ |
| Subflows | ✅ |
| Wait Events | ✅ |
| Custom Errors | ✅ |

## Installation

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/Avinava/vscode-sf-flow-visualiser/releases)
2. In VS Code, open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Extensions: Install from VSIX...`
4. Select the downloaded file

### From Source

```bash
# Clone the repository
git clone https://github.com/Avinava/vscode-sf-flow-visualiser.git
cd vscode-sf-flow-visualiser

# Install dependencies
npm run install:all

# Build the extension
npm run build

# Package the extension
npm run package
```

## Usage

### From Editor

1. Open a `.flow-meta.xml` file in VS Code
2. Click the graph icon in the editor title bar, or
3. Open Command Palette and run `SF Flow: Visualize Flow`

### From Explorer

1. Right-click any `.flow-meta.xml` file in the Explorer
2. Select `Visualize Flow`

### Navigation

- **Pan**: Click and drag on the canvas background
- **Zoom**: `Ctrl/Cmd + Scroll` or use the zoom buttons
- **Reset View**: Click the home icon in the toolbar
- **Toggle Auto-Layout**: Click the layout button to auto-arrange nodes

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.85+

### Setup

```bash
# Install all dependencies
npm run install:all

# Watch for extension changes
npm run watch

# In another terminal, start webview dev server
npm run dev:webview
```

### Building

```bash
# Build everything
npm run build

# Package as VSIX
npm run package
```

### Project Structure

```
vscode-sf-flow-visualiser/
├── src/                    # Extension source code
│   ├── extension.ts        # Entry point
│   ├── panels/
│   │   └── FlowPanel.ts    # Webview panel manager
│   └── utilities/
│       ├── getUri.ts       # URI helper
│       └── getNonce.ts     # CSP nonce generator
├── webview-ui/             # React webview app
│   ├── src/
│   │   ├── App.tsx         # Main React component
│   │   ├── index.tsx       # Entry point
│   │   └── index.css       # Tailwind CSS
│   ├── package.json
│   └── vite.config.ts
├── assets/                 # Icons and images
├── out/                    # Compiled extension
└── package.json            # Extension manifest
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `sf-flow-visualizer.autoLayout` | `true` | Auto-layout nodes when coordinates are missing |
| `sf-flow-visualizer.theme` | `light` | Visualizer theme (light/dark/auto) |

## Commands

| Command | Description |
|---------|-------------|
| `SF Flow: Visualize Flow` | Open the flow visualizer for current file |

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Built with:
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)