const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const config = vscode.workspace.getConfiguration('catface');

// Mood tiers, in order from best to worst.
// Each maps to an image file in media/ named e.g. media/happy.png
`const MOODS = [
  { key: 'happy', label: 'Happy', emoji: '😻' },
  { key: 'concerned', label: 'Concerned', emoji: '🙀' },
  { key: 'worried', label: 'Worried', emoji: '😾' },
  { key: 'distressed', label: 'Distressed', emoji: '🙀🔥' }
];`

let statusBarItem;
let panel;
let context;
let resourcesDir;
const THRESHOLDS = getThresholds();

function getThresholds() {
  const config = vscode.workspace.getConfiguration('catface');
  return config.get('thresholds') || [0, 1, 3, 5, 10, 15, 20, 25, 30, 40];
}

function countProblems() {
  const diagnostics = vscode.languages.getDiagnostics();

  let severeCount = 0;
  let warningCount = 0;
  for (const [, diags] of diagnostics) {
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error) severeCount++;
      else if (config.get('warningsCountTowardMood') && d.severity === vscode.DiagnosticSeverity.Warning) warningCount++;
    }
  }
  return severeCount;
}

`
function moodForCount(count) {
  const t = getThresholds();
  if (count >= t.distressed) return MOODS[3];
  if (count >= t.worried) return MOODS[2];
  if (count >= t.concerned) return MOODS[1];
  return MOODS[0];
}`

function imageUri(moodKey) {
  const filePath = vscode.Uri.file(
    path.join(context.extensionPath, 'media', `${moodKey}.png`)
  );
  return filePath;
}

function updateStatusBar() {
  const count = countProblems();
  const mood = getMood(count);
  statusBarItem.text = `Errors: ${count}`;
  statusBarItem.tooltip = `${mood.message} tooltip (${count} problem${count === 1 ? '' : 's'})`;
  statusBarItem.command = 'catface.showPanel';
  statusBarItem.show();

  if (panel) {
    panel.webview.html = getPanelHtml(mood, count);
  }
}

function getPanelHtml(mood, count) {
const imgSrc = panel.webview.asWebviewUri(
    vscode.Uri.file(mood.image)
);  return `<!DOCTYPE html>
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
    <img src="${imgSrc}" alt="${mood.message}" />
    <h2>${mood.message} — ${count} problem${count === 1 ? '' : 's'}</h2>
  </body>
  </html>`;
}

function activate(ctx) {
  console.log("CATFACE ACTIVATED");
  context = ctx;
  resourcesDir = path.join(context.extensionPath, 'resources');

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
            localResourceRoots: [vscode.Uri.file(path.join(ctx.extensionPath, 'resources'))]
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

function getMood(count){
  
  const folderName = `threshold${getThreshold(count)}`;
  return {message: getMessage(folderName), image: getImage(folderName)};
}

function getMessage(folderName) {
    const messagesFile = path.join(resourcesDir, folderName, 'messages.txt');

    let messages = [];
    try {
        const data = fs.readFileSync(messagesFile, 'utf8');
        messages = data.trim().split('\n').filter(line => line.trim() !== '');
    } catch (err) {
        // File doesn't exist or can't be read — treat as "no messages found"
        messages = [];
    }

    if (messages.length === 0) {
        return config.get('defaultMessage');
    }

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    return randomMessage;

}

function getImage(folderName) {
  const imagesDir = path.join(resourcesDir, folderName, 'images');

  let files = [];
  try {
    files = fs.readdirSync(imagesDir).filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f));
  } catch (err) {
    // Folder doesn't exist — treat as "no images found"
    files = [];
  }

  if (files.length === 0) {
    return path.join(resourcesDir, config.get('defaultImage'));  }

  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
}


function getThreshold(count){
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (count < THRESHOLDS[i]) {
      return i === 0 ? 0 : i;
    }
  }
  return THRESHOLDS.length;
}


`
function loadThresholds() {
  const fs = require('fs');
  const csvPath = path.join(context.extensionPath, 'resources', 'threshold.csv');
  if (!fs.existsSync(csvPath)) {
    vscode.window.showErrorMessage('Threshold CSV file not found.');
    return [-1]; // error threshold
  }

  const data = fs.readFileSync(csvPath, 'utf8');
  const lines = data.trim().split('\n');
  const thresholds = [];
  for (let i = 1; i < lines.length; i++) { // skip header
    const level = lines[i].split(',')[1];
    thresholds.push(level.trim());
  }

  return thresholds;
}
`


module.exports = { activate, deactivate };
