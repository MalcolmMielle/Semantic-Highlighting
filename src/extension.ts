import * as vscode from 'vscode';


// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {

  // console.log('decorator sample is activated');
  
  let variableNames: Set<string>;

  let colors: Array<string> = ["#529D52", "#BE7070", "#3D7676", "#BE9970", "#9D527C"]

  let tree: Array<vscode.DocumentSymbol> = [];
  let timeout: NodeJS.Timer | undefined = undefined;

    const refreshTree = async (editor: vscode.TextEditor) => {
    tree = (await vscode.commands.executeCommand<(vscode.DocumentSymbol)[]>(
      "vscode.executeDocumentSymbolProvider",
      editor.document.uri
    ).then(results => {
      if(!results) {
        return [];
      }

      const flattenedSymbols: vscode.DocumentSymbol[] = [];
      const addSymbols = (flattenedSymbols: vscode.DocumentSymbol[], results: vscode.DocumentSymbol[]) => {
        results.forEach((symbol: vscode.DocumentSymbol) => {
          if(symbol.kind == vscode.SymbolKind.Variable ) {
            flattenedSymbols.push(symbol);
          }
          if(symbol.children && symbol.children.length > 0) {
            addSymbols(flattenedSymbols, symbol.children);
          }
        });
      };

      addSymbols(flattenedSymbols, results);

      return flattenedSymbols.sort((x: vscode.DocumentSymbol, y: vscode.DocumentSymbol) => {
        const lineDiff = x.selectionRange.start.line - y.selectionRange.start.line;
        if(lineDiff === 0) {
          return x.selectionRange.start.character - y.selectionRange.start.character;
        }
        return lineDiff;
      });
    })) || [];
  };

	let activeEditor = vscode.window.activeTextEditor;

	function updateDecorations() {
		if (!activeEditor) {
			return;
    }
    
    refreshTree(activeEditor);
    console.log(tree.length);

		const text = activeEditor.document.getText();
    
    const variableDecoration: vscode.DecorationOptions[] = [];

    var varNames = new Set();
    // variableNames.clear();
    for (let i = 0; i < tree.length; i++) {
      var line = activeEditor.document.lineAt(tree[i].selectionRange.start.line);
      var word = line.text.substring(tree[i].selectionRange.start.character, tree[i].selectionRange.end.character);
      console.log(word);
      varNames.add(word);
    }
    console.log(tree.length);
    var a = Array.from(varNames);
    var countColor = 0;
    for (let i = 0; i < a.length; i++) {
      
      var VarColor = colors[countColor];
      countColor = countColor + 1;
      if (countColor == 5){
        countColor = 0;
      }
      var variableDecorator = vscode.window.createTextEditorDecorationType({
        // cursor: 'crosshair',
        // use a themable color. See package.json for the declaration and default values.
        color: VarColor
      });
      var test = a[i];
      if (typeof test === "string") {
        // console.log("regex");
        // console.log(test);
        // console.log(VarColor);
        const varregEx = new RegExp(test, "g")
        let matchVar; 
        while ((matchVar = varregEx.exec(text))) {
            // console.log(" test regex");
            // console.log(test);
          const startPos = activeEditor.document.positionAt(matchVar.index);
          const endPos = activeEditor.document.positionAt(matchVar.index + matchVar[0].length);
          const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'Variable **' + matchVar[0] + '**' };
          variableDecoration.push(decoration);
        }
        activeEditor.setDecorations(variableDecorator, variableDecoration);
      }
      
    }
	}

	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		timeout = setTimeout(updateDecorations, 500);
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

}

