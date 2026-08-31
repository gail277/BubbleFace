const vscode = require('vscode');
const path = require('path');

// Mood tiers, in order from best to worst.
// Each maps to an image file in media/ named e.g. media/happy.png
const MOODS = [
  { key: 'happy', label: 'Happy', emoji: '😻' },
  { key: 'concerned', label: 'Concerned', emoji: '🙀' },
  { key: 'worried', label: 'Worried', emoji: '😾' },
  { key: 'distressed', label: 'Distressed', emoji: '🙀🔥' }
];

let statusBarItem;
let panel;
let context;

function getThresholds() {
  const config = vscode.workspace.getConfiguration('catface');
  return config.get('thresholds') || { concerned: 1, worried: 3, distressed: 6 };
}

function countProblems() {
  const diagnostics = vscode.languages.getDiagnostics();
  const config = vscode.workspace.getConfiguration('catface');
  const includeWarnings = config.get('warningsCountTowardMood');

  let count = 0;
  for (const [, diags] of diagnostics) {
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error) count++;
      else if (includeWarnings && d.severity === vscode.DiagnosticSeverity.Warning) count++;
    }
  }
  return count;
}

function moodForCount(count) {
  const t = getThresholds();
  if (count >= t.distressed) return MOODS[3];
  if (count >= t.worried) return MOODS[2];
  if (count >= t.concerned) return MOODS[1];
  return MOODS[0];
}

function imageUri(moodKey) {
  const filePath = vscode.Uri.file(
    path.join(context.extensionPath, 'media', `${moodKey}.png`)
  );
  return filePath;
}

function updateStatusBar() {
  const count = countProblems();
  const mood = moodForCount(count);

  statusBarItem.text = `${mood.emoji} ${count}`;
  statusBarItem.tooltip = `CatFace: your cat is ${mood.label.toLowerCase()} (${count} problem${count === 1 ? '' : 's'})`;
  statusBarItem.command = 'catface.showPanel';
  statusBarItem.show();

  if (panel) {
    panel.webview.html = getPanelHtml(mood, count);
  }
}

function getPanelHtml(mood, count) {
  const imgSrc = panel.webview.asWebviewUri(imageUri(mood.key));
  return `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
      }
      img {
        max-width: 80%;
        max-height: 60vh;
        border-radius: 12px;
        object-fit: contain;
      }
      h2 { margin-top: 16px; font-weight: 500; }
    </style>
  </head>
  <body>
    <img src="${imgSrc}" alt="${mood.label}" />
    <h2>${mood.label} — ${count} problem${count === 1 ? '' : 's'}</h2>
  </body>
  </html>`;
}

function activate(ctx) {
  context = ctx;

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  ctx.subscriptions.push(statusBarItem);

  ctx.subscriptions.push(
    vscode.commands.registerCommand('catface.showPanel', () => {
      if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
      } else {
        panel = vscode.window.createWebviewPanel(
          'catface',
          'CatFace',
          vscode.ViewColumn.Beside,
          {
            enableScripts: false,
            localResourceRoots: [vscode.Uri.file(path.join(ctx.extensionPath, 'media'))]
          }
        );
        panel.onDidDispose(() => { panel = undefined; });
      }
      updateStatusBar();
    })
  );

  ctx.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => updateStatusBar())
  );
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('catface')) updateStatusBar();
    })
  );

  updateStatusBar();
}

function deactivate() {}

module.exports = { activate, deactivate };
