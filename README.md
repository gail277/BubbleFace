# CatFace

Shows your cat in the status bar. The image changes mood based on how many
errors/warnings are currently in your code.

## 1. Add your cat's photos

Drop 4 images into the `media/` folder, named exactly:

- `media/happy.png` — 0 problems
- `media/concerned.png` — a few problems (default: 1-2)
- `media/worried.png` — more problems (default: 3-5)
- `media/distressed.png` — lots of problems (default: 6+)

PNG or JPG both work — just keep the filenames matching (rename to `.png`
even if the source is a `.jpg`, or edit the extension in `extension.js`
`imageUri()` to use the right extension). Square-ish images around
400-800px work best.

You can adjust the thresholds in VS Code settings under `catface.thresholds`.

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
