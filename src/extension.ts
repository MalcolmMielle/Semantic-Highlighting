import * as vscode from 'vscode';

var window = vscode.window;
var workspace = vscode.workspace;

function activate(context: vscode.ExtensionContext) {

  var varNames = new Set();
  let styles = new Map();
  var countColor = 0;

  const configuration = vscode.workspace.getConfiguration('semantic-highlighting');
  let colors: Array<string> = configuration.get('colors') as string[];
  let timeout: NodeJS.Timer | undefined = undefined;
  var activeEditor = window.activeTextEditor;

  var possibleSymbolsBefore = '[,\\s\\=\\)\\(\\[\\]\\>\\-\\:\r\n{]';
  var possibleSymbolsAfter = '[,\\s\\.=\\)\\[\\]\\>\\-\\:\r\n}]';
  var selfKeyword = "self";
  var assignment = '[(->)\\.]';

  let tree: Array<vscode.DocumentSymbol> = [];
  var settings = workspace.getConfiguration('semantichighlights');


  const refreshTree = async (editor: vscode.TextEditor) => {
    tree = (await vscode.commands.executeCommand<(vscode.DocumentSymbol)[]>(
      "vscode.executeDocumentSymbolProvider",
      editor.document.uri
    ).then(results => {
      if (!results) {
        return [];
      }

      const flattenedSymbols: vscode.DocumentSymbol[] = [];
      const addSymbols = (flattenedSymbols: vscode.DocumentSymbol[], results: vscode.DocumentSymbol[]) => {
        results.forEach((symbol: vscode.DocumentSymbol) => {
          if (symbol.kind === vscode.SymbolKind.Variable) {
            flattenedSymbols.push(symbol);
          }
          if (symbol.children && symbol.children.length > 0) {
            addSymbols(flattenedSymbols, symbol.children);
          }
        });
      };

      addSymbols(flattenedSymbols, results);

      return flattenedSymbols.sort((x: vscode.DocumentSymbol, y: vscode.DocumentSymbol) => {
        const lineDiff = x.selectionRange.start.line - y.selectionRange.start.line;
        if (lineDiff === 0) {
          return x.selectionRange.start.character - y.selectionRange.start.character;
        }
        return lineDiff;
      });
    })) || [];
  };


  function init(settings: vscode.WorkspaceConfiguration) {
    var customDefaultStyle = settings.get('defaultStyle');
  }

  init(settings);

  async function updateDecorations() {
    colors = configuration.get('colors') as string[];

    if (!activeEditor || !activeEditor.document) {
      return;
    }

    await refreshTree(activeEditor);
    varNames.clear();
    for (let i = 0; i < tree.length; i++) {
      let name = tree[i].name;
      if (name.length > 3) {
        varNames.add(name);
      }
    }

    var text = activeEditor.document.getText();

    let a = Array.from(varNames).sort();
    let matches = new Map();
    for (let i = 0; i < a.length; i++) {
      let test = a[i];
      const regexVar = new RegExp(possibleSymbolsBefore + test + possibleSymbolsAfter, "g");
      let match;
      while (match = regexVar.exec(text)) {

        let assign = selfKeyword + assignment;
        const selfAssign = new RegExp(assign, "g");
        let maybeAssignString = text.substring(match.index + 1 - assign.length, match.index + 1);

        if (!selfAssign.test(maybeAssignString)) {
          let startPos = activeEditor.document.positionAt(match.index + 1);
          var endPos = activeEditor.document.positionAt(match.index + match[0].length - 1);
          var decoration = {
            range: new vscode.Range(startPos, endPos)
          };

          // Push range of decoration
          var matchedValue = match[0].substring(1, match[0].length - 1);
          if (matches.has(matchedValue)) {
            matches.get(matchedValue).push(decoration);
          } else {
            matches.set(matchedValue, [decoration]);
          }

          // Create decoration style if needed
          if (!styles.has(matchedValue)) {

            var varColor = colors[countColor];
            var variableDecorator = vscode.window.createTextEditorDecorationType({
              color: varColor
            });
            countColor = countColor + 1;
            if (countColor === colors.length) {
              countColor = 0;
            }
            styles.set(matchedValue, variableDecorator);
          }
        }
      }
    }

    // Add all decorations
    for (let [key, value] of matches) {
      activeEditor.setDecorations(styles.get(key), value);
    }

    // Remove decorations that are not used anymore.
    for (let [key, _] of styles) {
      if (matches.has(key) === false) {
        styles.get(key).dispose();
        styles.delete(key);
      }
    }

  }


  context.subscriptions.push(vscode.commands.registerCommand('semantichighlights.toggleSemanticHighlights', function () {
    settings.update('isEnable', !settings.get('isEnable'), true).then(function () {
      triggerUpdateDecorations();
    });
  }));

  function triggerUpdateDecorations() {
    timeout && clearTimeout(timeout);
    timeout = setTimeout(updateDecorations, 0);
  }

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  window.onDidChangeActiveTextEditor(function (editor) {
    activeEditor = editor;
    if (editor) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  workspace.onDidChangeTextDocument(function (event) {
    if (activeEditor && event.document === activeEditor.document) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  workspace.onDidChangeConfiguration(function () {
    settings = workspace.getConfiguration('todohighlight');

    //NOTE: if disabled, do not re-initialize the data or we will not be able to clear the style immediatly via 'toggle highlight' command
    if (!settings.get('isEnable')) { return; }

    triggerUpdateDecorations();
  }, null, context.subscriptions);


}

exports.activate = activate;