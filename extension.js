// VS Code API used to register commands, create UI elements, and read diagnostics.
const vscode = require('vscode');
// Node path helper for resolving file and directory paths inside the extension.
const path = require('path');
// Node filesystem module for reading threshold files and image/message folders.
const fs = require('fs');

// Current workspace configuration values for BubbleFace, such as colors and default settings.
let config;

// Status bar item displayed in the VS Code activity bar showing the error count.
let statusBarItem;
// Active webview panel used to display the BubbleFace UI in a separate editor.
let panel;
// Extension context passed in by VS Code so resources and subscriptions can be managed.
let context;
// Root folder where the extension stores its bundled resources and threshold data.
let resourcesDir;
// Sorted threshold values used to map problem counts to the correct mood level.
let THRESHOLDS = [];
// Reference to the sidebar webview view used to keep the panel and status bar in sync.
let webviewView;
// Stores the last rendered HTML so the extension avoids unnecessary UI refreshes.
let previousErrorsHtml = '';
// Cached mood groups loaded from the threshold folders, each containing messages and images.
let MOODS = [];



/**
 * Starts the extension, creates the status bar item, and registers all event listeners and commands.
 *
 * @param {vscode.ExtensionContext} ctx The extension context used for subscription lifecycle and resource paths.
 * @returns {void} Nothing is returned.
 */
function activate(ctx) {
  try {
    // Store the extension context so later logic can access the workspace resources and manage
    // command subscriptions cleanly.
    context = ctx;
    config = vscode.workspace.getConfiguration('bubbleface');

    // Point to the extension's resource directory and load the numeric threshold values used to
    // decide the displayed mood for different problem counts.
    resourcesDir = path.join(context.extensionPath, 'resources');
    THRESHOLDS = loadThresholds();
  MOODS = loadMoods();  

    // Create the status bar item that sits in the VS Code left-hand toolbar.
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    ctx.subscriptions.push(statusBarItem);

    ctx.subscriptions.push(
      vscode.commands.registerCommand('bubbleface.showPanel', () => {
        // Reuse the same panel if it is already open; otherwise create a new one beside the editor.
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

    ctx.subscriptions.push(
      vscode.languages.onDidChangeDiagnostics(() => updateStatusBar())
    );

    ctx.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('bubbleface')) updateStatusBar();
      })
    );

    const provider = {
      /**
       * Populates the custom sidebar with the current mood and error summary.
       */
      resolveWebviewView(view) {
        // Keep a reference to the active sidebar view so the status bar and panel can sync later.
        webviewView = view;

        view.webview.options = {
          enableScripts: false,
          localResourceRoots: [
            vscode.Uri.file(path.join(ctx.extensionPath, 'resources'))
          ]
        };

        // Build the content for the side panel from the live diagnostics and current threshold mood.
        const { count, errorsHtml } = getProblemData();
        const mood = getMood(count);

        view.webview.html = getPanelHtml(view.webview, mood, count, errorsHtml);
      }
    };

    ctx.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'bubbleface-status',
        provider
      )
    );

    updateStatusBar();
  } catch (err) {
    vscode.window.showErrorMessage(`BubbleFace activation error: ${err.message}`);
  }
}

/**
 * Handles extension deactivation cleanup.
 *
 * @returns {void} Nothing is returned.
 */
function deactivate() { }




/**
 * Refreshes the status bar item and any open webview panel when the current problem count changes.
 *
 * @returns {void} Nothing is returned.
 */
function updateStatusBar() {
    const { count, errorsHtml } = getProblemData();

    if (errorsHtml === previousErrorsHtml) {
        return;
    }
    previousErrorsHtml = errorsHtml;

    const mood = getMood(count);

    statusBarItem.text = `Errors: ${count}`;
    statusBarItem.tooltip =
        `${mood.message} tooltip (${count} problem${count === 1 ? '' : 's'})`;

    statusBarItem.command = 'bubbleface.showPanel';
    statusBarItem.show();

    if (webviewView) {
        webviewView.webview.html =
            getPanelHtml(webviewView.webview, mood, count, errorsHtml);
    }
}


/**
 * Builds the HTML for the BubbleFace panel using the active mood and current error count.
 *
 * @param {vscode.Webview} webview The webview instance used to resolve image URIs.
 * @param {{ message: string, image: string }} mood The selected mood object containing the message and image filepath.
 * @param {number} count The current number of problems to display.
 * @returns {string} The generated HTML string for the panel.
 */
function getPanelHtml(webview, mood, count, errorsHtml) {
  // Gather the current error/warning list and convert it to HTML markup before building the panel.
  const errorColor = config.get('errorColor');
  const warningColor = config.get('warningColor');

  // Resolve the mood image as a webview-safe URI so it can be displayed inside the VS Code panel.
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
        margin: 0;
        margin-bottom: 20px;
      }

      li {
        list-style: none;
        position: relative;
        padding-left: ${(config.get('bulletStyle').length) * 14}px;
        margin: 10px 4px 0 0;
}

      li::before {
        content: "${config.get('bulletStyle')}";
        position: absolute;
        left: 0;
        color: var(--vscode-descriptionForeground);
        margin-right: 2px;
      }

      b{
        font-weight: 700;
      }

      li.error {
        color: ${errorColor || 'var(--vscode-editorError-foreground)'};
      }

      li.warning {
        color: ${warningColor || 'var(--vscode-editorWarning-foreground)'};
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



/**
 * Collects the active diagnostic entries and converts them into the count and HTML list used by the panel.
 *
 * @returns {{ count: number, errorsHtml: string }} The total problem count and the rendered HTML for display.
 */
function getProblemData() {
    const diagnostics = vscode.languages.getDiagnostics();

    let errorCount = 0;
    let errorsHtml = "";
    let warningsHtml = "";

    const countWarnings = config.get('warningsCountTowardMood');

    for (const [, diags] of diagnostics) {
        for (const d of diags) {
            if (d.severity === vscode.DiagnosticSeverity.Error) {
                errorCount++;

                errorsHtml += `
                    <li class="error">
                        <b>[Line ${d.range.start.line + 1}]</b>
                        ${d.message}
                    </li>`;
            }
            else if (
                countWarnings &&
                d.severity === vscode.DiagnosticSeverity.Warning
            ) {
                warningsHtml += `
                    <li class="warning">
                        <b>[Line ${d.range.start.line + 1}]</b>
                        ${d.message}
                    </li>`;
            }
        }
    }

    return {
        count: errorCount,
        errorsHtml: `<ul>${errorsHtml}${warningsHtml}</ul>`
    };
}
 


/**
 * Selects the mood message and image that best matches the current problem count.
 *
 * @param {number} count The total number of current problems.
 * @returns {{ message: string, image: string }} An object containing the mood text and associated image path.
 */
function getMood(count) {
    const thresholdIndex = getThreshold(count);

    if (thresholdIndex === -1) {
        return {
            message: config.get('defaultMessage'),
            image: path.join(resourcesDir, config.get('defaultImage'))
        };
    }

    const mood = MOODS[thresholdIndex];

    const message = mood.messages.length > 0
        ? mood.messages[Math.floor(Math.random() * mood.messages.length)]
        : config.get('defaultMessage');

    const image = mood.images.length > 0
        ? mood.images[Math.floor(Math.random() * mood.images.length)]
        : path.join(resourcesDir, config.get('defaultImage'));

    return {
        message,
        image
    };
}

/**
 * Finds the threshold index that matches the current problem count.
 *
 * @param {number} count The current number of detected problems.
 * @returns {number} The threshold index for the current count, or -1 if no thresholds are available.
 */
function getThreshold(count) {
    if (THRESHOLDS.length == 0) return -1;

    for (let i = 0; i < THRESHOLDS.length; i++) {
        if (count <= THRESHOLDS[i]) {
            return i;
        }
    }

    return THRESHOLDS.length - 1;
} 




/**
 * Loads all numeric threshold folders from the extension resources and sorts them in ascending order.
 *
 * @returns {number[]} A sorted array of threshold values, or an empty array if the folder is missing or invalid.
 */
function loadThresholds() {
  try {
    // The threshold folders are stored under resources/thresholds and are named with numeric levels.
    // Read those folders and sort them numerically so the mood logic can compare counts reliably.
    const thresholdsDir = path.join(
      context.extensionPath,
      'resources',
      'thresholds'
    );

    if (!fs.existsSync(thresholdsDir)) {
      vscode.window.showErrorMessage('Thresholds folder not found.');
      return [];
    }

    const entries = fs.readdirSync(thresholdsDir, { withFileTypes: true });

    const thresholds = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => /^\d+$/.test(name)) // integers only
      .map(name => Number(name))
      .sort((a, b) => a - b);

    return thresholds;

  } catch (err) {
    // If any filesystem issue occurs while loading the threshold configuration, fall back to an
    // empty list instead of crashing the extension.
    return [];
  }
}


/**
 * Loads each numeric threshold folder into a mood object containing its messages and image list.
 *
 * @returns {{ threshold: number, messages: string[], images: string[] }[]} A collection of mood groups for each threshold level.
 */
function loadMoods() {
    return THRESHOLDS.map(threshold => {
        const thresholdDir = path.join(
            resourcesDir,
            'thresholds',
            String(threshold)
        );

        return {
            threshold,
            messages: loadMessages(thresholdDir),
            images: loadImages(thresholdDir)
        };
    });
}

/**
 * Reads all non-empty lines from a threshold's messages file.
 *
 * @param {string} thresholdDir The directory containing the threshold's message file.
 * @returns {string[]} An array of valid message strings, or an empty array if no file is available.
 */
function loadMessages(thresholdDir) {
    const file = path.join(thresholdDir, 'messages.txt');

    try {
        return fs.readFileSync(file, 'utf8')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Lists the valid image files inside a threshold folder for mood display.
 *
 * @param {string} thresholdDir The directory containing the threshold's image folder.
 * @returns {string[]} A list of image file paths, or an empty array if no valid images are present.
 */
function loadImages(thresholdDir) {
    const dir = path.join(thresholdDir, 'images');

    try {
        return fs.readdirSync(dir)
            .filter(file => /\.(png|jpe?g|gif|webp)$/i.test(file))
            .map(file => path.join(dir, file));
    } catch {
        return [];
    }
}

module.exports = { activate, deactivate };

