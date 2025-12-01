# Changelog

All notable changes to the SF Flow Visualizer extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- markdownlint-disable MD024 -->

## [1.1.4] - 2025-12-01

### Fixed

- Start nodes that only define scheduled/async paths now mirror Salesforce by pinning the "Run Immediately" leg directly into an End node, preventing stray branch lines down the main lane
- Start connector parsing now ignores nested connectors (e.g., scheduled path entries) so automatic branch labeling stays accurate even when the immediate path is missing

## [1.1.3] - 2025-12-01

### Fixed

- Scheduled path connectors (Run Immediately / Run Asynchronously) from Start nodes now route horizontally before dropping, eliminating the unnecessary vertical jog that previously appeared between the branch line and target nodes

## [1.1.2] - 2025-12-01

### Fixed

- Loop connectors now keep their animated bead perfectly aligned with the branch entry so For-Each branches feel anchored instead of drifting mid-air
- Branch line routing for loop bodies now forces a horizontal-first drop, eliminating the jagged kink that previously appeared before the connector turned downward
- Fault connectors stay horizontal longer before bending, keeping short-hop fault paths perfectly straight and easier to scan

## [1.1.1] - 2025-11-30

### Improved

- **Better Defaults**: Light theme and flow animation are now enabled by default for a better out-of-the-box experience
- User preferences for theme and animation are now persisted and restored across sessions
- State persistence now correctly restores user preferences on initial load without flash of default values

## [1.1.0] - 2025-11-30

### Changed

- **Major Refactor**: Complete rewrite of the auto-layout engine inspired by Salesforce's Auto-Layout Canvas (ALC) system
- Improved layout algorithm for better handling of complex flows with nested branches and merge points
- Enhanced connector routing with orthogonal paths and rounded corners
- Better branch visualization with symmetric positioning around parent nodes
- Optimized node positioning and spacing for clearer flow representation

### Improved

- More accurate merge point detection for converging branches
- Enhanced fault path visualization with proper horizontal routing
- Better loop connector handling with proper loopback visualization
- Improved performance for large flows with many nodes
- More consistent node and connector rendering

### Technical

- Refactored flow model to match Salesforce's internal structure with proper node relationships
- Implemented comprehensive node type detection and mapping
- Added proper z-index layering for nodes and connectors
- Improved TypeScript type definitions for flow elements
- Better code organization and maintainability

## [1.0.0] - 2025-11-XX

### Added

- Initial release of SF Flow Visualizer
- Interactive visualization of Salesforce Flow XML files
- Support for all major flow elements (Start, Decision, Loop, Screen, Actions, etc.)
- Pan and zoom navigation
- Node detail inspector sidebar
- Fault path tracking with red dashed connectors
- Auto-layout capability
- Theme support (light, dark, auto)
- Multiple access points (editor title, context menu, command palette)
- Configuration settings for auto-layout and theme preferences

[1.1.4]: https://github.com/Avinava/vscode-sf-flow-visualiser/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/Avinava/vscode-sf-flow-visualiser/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/Avinava/vscode-sf-flow-visualiser/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Avinava/vscode-sf-flow-visualiser/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Avinava/vscode-sf-flow-visualiser/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Avinava/vscode-sf-flow-visualiser/releases/tag/v1.0.0
