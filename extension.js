const vscode = require('vscode');
const path = require('path');
const fs = require('fs');


let config;

let statusBarItem;
let panel;
let context;
let resourcesDir;
let THRESHOLDS = [];
let webviewView;
let previousCount = 0;

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



function updateStatusBar() {
  console.log("update status bar");

  const count = countProblems();

  if (count === previousCount) { return; }
  previousCount = count;


  const mood = getMood(count);

  statusBarItem.text = `Errors: ${count}`;
  statusBarItem.tooltip =
    `${mood.message} tooltip (${count} problem${count === 1 ? '' : 's'})`;

  statusBarItem.command = 'bubbleface.showPanel';
  statusBarItem.show();

  if (webviewView) {
    webviewView.webview.html =
      getPanelHtml(webviewView.webview, mood, count);
  }
}

function getPanelHtml(webview, mood, count) {
  console.log("getpanel");
  const errorsHtml = getErrorsHtml();
  const imgSrc = webview.asWebviewUri(
    vscode.Uri.file(mood.image)
  ); return `<!DOCTYPE html>
  
<html>
  <head>
    <style>
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100vh;
        margin: 0;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
      }

      img {
        width: 250px;
        height: 250px;
        object-fit: contain;
        border-radius: 12px;
      }

      h3 {
        font-size: 1em;
        margin: 10px 0 0 0;
        font-weight: 400;
      }

      h1 {
        text-align: center;
        margin: 0 0 0 0;
        font-size: 3em;
        font-weight: 600;
      }

      h2 {
      font-size: 1.2em;
        margin: 8px 0 0 0; 
        font-weight: 500;
      }

      h4{
        font-size: 0.8em;
        margin: 1px 0 1px 0;
        font-weight: 200;
        color: var(--vscode-descriptionForeground);
      }
      .errors{
        width: 100%;
      }

      ul{
      
        list-style-type: "${config.get('bulletStyle')}";
        padding: 0;
      }

      li{
        margin: 10px 4px 0 0;

      }

      b{
        font-weight: 700;
      }

      li.error {
        color: ${config.get('errorColor')};
      }

      li.warning {
        color: ${config.get('warningColor')};
      }
    </style>
  </head>

  <body>
    <img src="${imgSrc}" alt="${mood.message}" />
    <h4>Follow the fat rat on instagram @bubbles_isbeautiful</h4>
    <h2>The number of problems with you:</h2>
    <h1>${count}</h1>
    <h3>${mood.message}</h3>
    </br></br>
    <div class="errors">
    ${errorsHtml}
  </div>
  </body>
</html>
`
}


function getErrorsHtml() {
  const diagnostics = vscode.languages.getDiagnostics();

  let errorsHtml = "";
  let warningsHtml = "";

  for (const [, diags] of diagnostics) {
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error) {

        errorsHtml += `
                    <li class="error">
                        <b>[Line ${d.range.start.line + 1}]:</b>
                        ${d.message}
                    </li>
                `;
      }
      else if (d.severity === vscode.DiagnosticSeverity.Warning && config.get('warningsCountTowardMood')) {

        warningsHtml += `
                    <li class="warning">
                        <b>[Line ${d.range.start.line + 1}]:</b>
                        ${d.message}
                    </li>
                `;
      }
    }
  }
  html = `<ul>${errorsHtml}${warningsHtml}</ul>`;

  return html;
}

function activate(ctx) {
  try {
    console.log("activate - STARTING");
    context = ctx;
    console.log("context set");
    config = vscode.workspace.getConfiguration('bubbleface');
    resourcesDir = path.join(context.extensionPath, 'resources');
    console.log("resourcesDir:", resourcesDir);

    console.log("About to load thresholds");
    THRESHOLDS = loadThresholds();
    console.log("Thresholds loaded:", THRESHOLDS);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    ctx.subscriptions.push(statusBarItem);
    console.log("Status bar item created");

    ctx.subscriptions.push(
      vscode.commands.registerCommand('bubbleface.showPanel', () => {
        if (panel) {
          panel.reveal(vscode.ViewColumn.Beside);
        } else {
          panel = vscode.window.createWebviewPanel(
            'bubbleface',
            'BubbleFace',
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
    console.log("Command registered");

    ctx.subscriptions.push(
      vscode.languages.onDidChangeDiagnostics(() => updateStatusBar())
    );
    console.log("onDidChangeDiagnostics registered");

    ctx.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('bubbleface')) updateStatusBar();
      })
    );
    console.log("onDidChangeConfiguration registered");

    console.log("About to register webview view provider");

    const provider = {
      resolveWebviewView(view) {
        console.log("resolveWebviewView called!");

        webviewView = view;

        view.webview.options = {
          enableScripts: false,
          localResourceRoots: [
            vscode.Uri.file(path.join(ctx.extensionPath, 'resources'))
          ]
        };

        const count = countProblems();
        const mood = getMood(count);

        view.webview.html = getPanelHtml(view.webview, mood, count);
      }
    };

    ctx.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'bubbleface-status',
        provider
      )
    );

    console.log("Webview provider registered");

    updateStatusBar();
    console.log("activate - SUCCESS");
  } catch (err) {
    console.error("ERROR in activate():", err);
    console.error("Stack trace:", err.stack);
    vscode.window.showErrorMessage(`BubbleFace activation error: ${err.message}`);
  }
}

function deactivate() { }

function getMood(count) {
  console.log("get mood");

  let thresholdNum = getThreshold(count);

  if (thresholdNum == -1) {
    return { message: config.get('defaultMessage'), image: config.get('defaultImage') };
  }


  const thresholdDir = path.join(resourcesDir, `thresholds`, `${thresholdNum}`);
  return { message: getMessage(thresholdDir), image: getImage(thresholdDir) };
}

function getMessage(thresholdDir) {
  console.log("get message");
  const messagesFile = path.join(thresholdDir, 'messages.txt');
  console.log(messagesFile);
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

function getImage(thresholdDir) {
  console.log("get image");
  const imagesDir = path.join(thresholdDir, 'images');

  let files = [];
  try {
    files = fs.readdirSync(imagesDir).filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f));
  } catch (err) {
    // Folder doesn't exist — treat as "no images found"
    files = [];
  }

  if (files.length === 0) {
    return path.join(resourcesDir, config.get('defaultImage'));
  }

  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
}


function getThreshold(count) {
  if (THRESHOLDS.length == 0) return -1;
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (count <= THRESHOLDS[i]) {
      return i;
    }
  }
  return THRESHOLDS.length - 1;
}



function loadThresholds() {
  try {
    const csvPath = path.join(context.extensionPath, 'resources', 'threshold_levels.csv');
    console.log("loadThresholds: csvPath:", csvPath);

    if (!fs.existsSync(csvPath)) {
      console.error('Threshold CSV file not found at:', csvPath);
      vscode.window.showErrorMessage('Threshold CSV file not found.');
      return []; //error threshold
    }

    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.trim().split('\n');
    const thresholds = [];
    for (let i = 1; i < lines.length; i++) { // skip header
      const parts = lines[i].split(',');
      if (parts.length > 1 && parts[1].trim() !== "") {
        const level = Number(parts[1].trim());
        thresholds.push(level);
      }
    }
    console.log("loadThresholds: successfully loaded thresholds:", thresholds);
    return thresholds;
  } catch (err) {
    console.error("loadThresholds: error:", err);
    return [];
  }
}

module.exports = { activate, deactivate };
