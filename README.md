# CatFace

Shows your cat in the status bar. The image changes mood based on how many
errors/warnings are currently in your code.

## 1. Add your cat's photos
You can. But why would you replace my fat boy with another?
But if you really are heartless, just drop the images into each folder.

Folder names are integers, representing the tolerance level for errors.

## 2. Install dependencies & run

```bash
npm install
```

Then press `F5` in VS Code (with this folder open) to launch an Extension
Development Host with CatFace active. Open a file with some lint/type
errors and watch the status bar icon in the bottom-left change mood.
Click it to open a bigger panel view of your cat.

## 3. Package it for real use (optional)

```bash
npm install -g @vscode/vsce
vsce package
```

This produces a `.vsix` file you can install via
**Extensions → ... → Install from VSIX** in any VS Code instance.

## Customizing

- **More/fewer moods**: edit the `MOODS` array and `moodForCount()` in
  `extension.js`, and add matching images to `media/`.
- **Warnings vs errors only**: toggle `catface.warningsCountTowardMood`
  in settings.
- **Thresholds**: `catface.thresholds` in settings, e.g.
  `{ "concerned": 1, "worried": 4, "distressed": 10 }`.
