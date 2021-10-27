import * as vscode from 'vscode';
import { rangesByName } from './rangesByName';

var window = vscode.window;
var workspace = vscode.workspace;

function activate(context: vscode.ExtensionContext) {

  let styles = new Map();
  var countColor = 0;

  let settings = workspace.getConfiguration('semantic-highlighting');
  let colors: Array<string> = settings.get('colors') as string[];
  var activeEditor = window.activeTextEditor;

  async function updateDecorations() {

    if (!activeEditor || !activeEditor.document) {
      return;
    }
    const uri = activeEditor.document.uri;
    const legend: vscode.SemanticTokensLegend | undefined = await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokensLegend', uri);
    const tokensData: vscode.SemanticTokens | undefined = await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', uri);

    if (!tokensData || !legend) { return; }
    const rangesBySymbolName = rangesByName(tokensData, legend, activeEditor);

    // Add all decorations
    for (let [key, value] of rangesBySymbolName) {
      // Create decoration style if needed
      if (!styles.has(key)) {

        var varColor = colors[countColor];
        var variableDecorator = vscode.window.createTextEditorDecorationType({
          color: varColor
        });
        countColor = countColor + 1;
        if (countColor === colors.length) {
          countColor = 0;
        }
        styles.set(key, variableDecorator);
      }
      activeEditor.setDecorations(styles.get(key), value);
    }

    // Remove decorations that are not used anymore.
    for (let [key, _] of styles) {
      if (rangesBySymbolName.has(key) === false) {
        styles.get(key).dispose();
        styles.delete(key);
      }
    }
  }

  async function removeAll() {
    for (let [key, _] of styles) {
      styles.get(key).dispose();
      styles.delete(key);
    }
  }

  context.subscriptions.push(vscode.commands.registerCommand('semantic-highlighting.toggleSemanticHighlights', function () {
    settings.update('isEnable', !settings.get('isEnable'), true).then(function () {
      if (settings.get('isEnable')) {
        updateDecorations();
      }
      else {
        removeAll();
      }

    });
  }));


  window.onDidChangeActiveTextEditor(function (editor) {
    activeEditor = editor;
    settings = workspace.getConfiguration('semantic-highlighting');
    if (editor && settings.get('isEnable')) {
      updateDecorations();
    }
  }, null, context.subscriptions);

  workspace.onDidChangeTextDocument(function (event) {
    settings = workspace.getConfiguration('semantic-highlighting');
    if (activeEditor && event.document === activeEditor.document && settings.get('isEnable')) {
      updateDecorations();
    }
  }, null, context.subscriptions);

}

exports.activate = activate;