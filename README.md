# BubbleFace

BubbleFace is a VS Code extension that turns your code quality into a playful mood indicator. It watches the current diagnostics in your workspace and changes the status bar image and message based on how many problems are present.

It is designed to be lighthearted and visual: as your error count rises, the panel gets more dramatic, and the messages/images change to reflect the mood.

## Features

- Shows a status bar item with the current error count
- Updates the mood based on diagnostic thresholds
- Displays a custom panel with current problems and a themed image
- Supports warning counting through a configuration setting
- Uses a folder-based threshold system for messages and images

## How it works

The extension reads diagnostics from VS Code and maps the total problem count to a threshold level. Each threshold folder contains:

- `messages.txt` - one message per line
- `images/` - matching image files for that mood

Threshold folders are named with integers such as `0`, `1`, `2`, `4`, `6`, etc. The extension sorts these values and uses the first threshold that matches the current count.

## Installation

1. Open this project in VS Code.
2. Run:

```bash
npm install
```

3. Press `F5` to launch the Extension Development Host.
4. Open a file with errors or warnings and watch BubbleFace react in the status bar.

## Customising the mood levels

The threshold data lives under:

```text
resources/thresholds/
```

Example structure:

```text
resources/
  thresholds/
    0/
      messages.txt
      images/
    2/
      messages.txt
      images/
    6/
      messages.txt
      images/
```

Add or edit files in each folder to change the messages or images shown at each threshold.

## Configuration

The extension exposes the following settings in VS Code:

- `bubbleface.warningsCountTowardMood` - include warnings in the total count
- `bubbleface.defaultMessage` - fallback message when no message file is found
- `bubbleface.defaultImage` - fallback image path
- `bubbleface.bulletStyle` - symbol used for the list items in the panel
- `bubbleface.errorColor` - colour used for error entries
- `bubbleface.warningColor` - colour used for warning entries

## Packaging

To build the extension package:

```bash
npm install
npx @vscode/vsce package
```

This creates a `.vsix` file that can be installed in VS Code via the Extensions view.

## Notes

This extension is intentionally playful and visual, and is meant to make code issues a little more expressive while still reflecting the real problem count.

