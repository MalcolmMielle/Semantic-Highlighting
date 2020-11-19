/**
 * vscode plugin for highlighting TODOs and FIXMEs within your code
 *
 * NOTE: each decoration type has a unique key, the highlight and clear highight functionality are based on it
 */
import * as vscode from 'vscode';

// var vscode = require('vscode');
// var util = require('./util');
var window = vscode.window;
var workspace = vscode.workspace;

function activate(context: vscode.ExtensionContext) {

  var varNames = new Set();
  let styles = new Map();
  var countColor = 0;

  let colors: Array<string> = ["#529D52", "#BE7070", "#3D7676", "#BE9970", "#9D527C"]
  let timeout: NodeJS.Timer | undefined = undefined;
  var activeEditor = window.activeTextEditor;
  // var isCaseSensitive, assembledData, decorationTypes, pattern, styleForRegExp, keywordsPattern;
  var workspaceState = context.workspaceState;

  var possibleSymbolsBeforeFunc = '((def\\s*))';
  var selfSymbol = '(self\.)';
  var possibleSymbolsBefore = '[,\\s\\.=\\)\\(\\[\\]\\>\\-\\:\r\n{]';
  var possibleSymbolsAfter = '[,\\s\\.=\\)\\[\\]\\>\\-\\:\r\n}]';

  let tree: Array<vscode.DocumentSymbol> = [];
  var settings = workspace.getConfiguration('semantichighlights');


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


  function init(settings: vscode.WorkspaceConfiguration) {
    var customDefaultStyle = settings.get('defaultStyle');

    // decorationTypes = {};

    // if (keywordsPattern.trim()) {
    //     styleForRegExp = Object.assign({}, util.DEFAULT_STYLE, customDefaultStyle, {
    //         overviewRulerLane: vscode.OverviewRulerLane.Right
    //     });
    //     pattern = keywordsPattern;
    // } else {
    //     assembledData = util.getAssembledData(settings.get('keywords'), customDefaultStyle, isCaseSensitive);
    //     Object.keys(assembledData).forEach((v) => {
    //         if (!isCaseSensitive) {
    //             v = v.toUpperCase()
    //         }

    //         var mergedStyle = Object.assign({}, {
    //             overviewRulerLane: vscode.OverviewRulerLane.Right
    //         }, assembledData[v]);

    //         if (!mergedStyle.overviewRulerColor) {
    //             // use backgroundColor as the default overviewRulerColor if not specified by the user setting
    //             mergedStyle.overviewRulerColor = mergedStyle.backgroundColor;
    //         }

    //         decorationTypes[v] = window.createTextEditorDecorationType(mergedStyle);
    //     });

    //     pattern = Object.keys(assembledData).map((v) => {
    //         return util.escapeRegExp(v);
    //     }).join('|');
    // }

    // pattern = new RegExp(pattern, 'gi');
    // if (isCaseSensitive) {
    //     pattern = new RegExp(pattern, 'g');
    // }

  }


  // context.subscriptions.push(vscode.commands.registerCommand('semantichighlights.listAnnotations', function () {
  //     if (keywordsPattern.trim()) {
  //         util.searchAnnotations(workspaceState, pattern, util.annotationsFound);
  //     } else {
  //         if (!assembledData) return;
  //         var availableAnnotationTypes = Object.keys(assembledData);
  //         availableAnnotationTypes.unshift('ALL');
  //         util.chooseAnnotationType(availableAnnotationTypes).then(function (annotationType) {
  //             if (!annotationType) return;
  //             var searchPattern = pattern;
  //             if (annotationType != 'ALL') {
  //                 annotationType = util.escapeRegExp(annotationType);
  //                 searchPattern = new RegExp(annotationType, isCaseSensitive ? 'g' : 'gi');
  //             }
  //             util.searchAnnotations(workspaceState, searchPattern, util.annotationsFound);
  //         });
  //     }
  // }));

  // context.subscriptions.push(vscode.commands.registerCommand('todohighlight.showOutputChannel', function () {
  //     var annotationList = workspaceState.get('annotationList', []);
  //     util.showOutputChannel(annotationList);
  // }));

  init(settings);

  function updateDecorations() {

    if (!activeEditor || !activeEditor.document) {
        return;
    }

    refreshTree(activeEditor);
    varNames.clear();
    for (let i = 0; i < tree.length; i++) {
      var line = activeEditor.document.lineAt(tree[i].selectionRange.start.line);
      var word = line.text.substring(tree[i].selectionRange.start.character, tree[i].selectionRange.end.character);
      // console.log(word.split(/[:=]/)[0]);
      varNames.add(word.split(/[:=]/)[0]);
    }

    var text = activeEditor.document.getText();

    var a = Array.from(varNames).sort();
    let mathes = new Map()
    // console.log(a.length);
    for (let i = 0; i < a.length; i++) {
      // console.log(a[i]);
      
      
      var test = a[i];
      if (typeof test === "string" && test != "self" && test.length > 3) {
        const variableDecoration: vscode.DecorationOptions[] = [];

        const regexVar = new RegExp(possibleSymbolsBefore + test + possibleSymbolsAfter, "g");
        const regexNotFunc = new RegExp(possibleSymbolsBeforeFunc)
        const regexNotSelf = new RegExp(selfSymbol)
        var match;
        while (match = regexVar.exec(text)) {

          var isDef = text.substring(match.index - 3, match.index + 1)
          var isSelf = text.substring(match.index - 4, match.index + 1)
          if(!regexNotFunc.test(isDef) && !(regexNotSelf.test(isSelf))){
            var startPos = activeEditor.document.positionAt(match.index + 1);
            var endPos = activeEditor.document.positionAt(match.index + match[0].length - 1);
            var decoration = {
                range: new vscode.Range(startPos, endPos)
            };
            var matchedValue = match[0].substring(1, match[0].length-1);
            // console.log(matchedValue);
            if (mathes.has(matchedValue)) {
              // console.log("has");
                mathes.get(matchedValue).push(decoration);
            } else {
              // console.log("set");
                mathes.set(matchedValue, [decoration]);
            }

            if(!styles.has(matchedValue)){
              
              var VarColor = colors[countColor];
              var variableDecorator = vscode.window.createTextEditorDecorationType({
                color: VarColor
              });
              countColor = countColor + 1;
              if (countColor == 5){
                countColor = 0;
              }
              styles.set(matchedValue, variableDecorator);
            }
          // }
          // else{
          //   var matchedValue = match[0];
          //   console.log("mot matchedvalue");
          //   console.log(matchedValue);
          }
        }
      }
    }
    console.log("Finished")

    for (let [key, value] of mathes) {
      // console.log(key + ' = ' + value)
      activeEditor.setDecorations(styles.get(key), value);
    }

  }


  context.subscriptions.push(vscode.commands.registerCommand('semantichighlights.toggleSemanticHighlights', function () {
      settings.update('isEnable', !settings.get('isEnable'), true).then(function () {
          triggerUpdateDecorations();
      });
  }))

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
      if (!settings.get('isEnable')) return;

      init(settings);
      triggerUpdateDecorations();
  }, null, context.subscriptions);

    
}

exports.activate = activate;










// import * as vscode from 'vscode';


// // this method is called when vs code is activated
// export function activate(context: vscode.ExtensionContext) {

//   // console.log('decorator sample is activated');
  
//   // let variableNames: Set<string>;

//   var varNames = new Set();
//   let colors: Array<string> = ["#529D52", "#BE7070", "#3D7676", "#BE9970", "#9D527C"]

//   let tree: Array<vscode.DocumentSymbol> = [];
//   let timeout: NodeJS.Timer | undefined = undefined;

//     const refreshTree = async (editor: vscode.TextEditor) => {
//     tree = (await vscode.commands.executeCommand<(vscode.DocumentSymbol)[]>(
//       "vscode.executeDocumentSymbolProvider",
//       editor.document.uri
//     ).then(results => {
//       if(!results) {
//         return [];
//       }

//       const flattenedSymbols: vscode.DocumentSymbol[] = [];
//       const addSymbols = (flattenedSymbols: vscode.DocumentSymbol[], results: vscode.DocumentSymbol[]) => {
//         results.forEach((symbol: vscode.DocumentSymbol) => {
//           if(symbol.kind == vscode.SymbolKind.Variable ) {
            
//             flattenedSymbols.push(symbol);
//           }
//           if(symbol.children && symbol.children.length > 0) {
//             addSymbols(flattenedSymbols, symbol.children);
//           }
//         });
//       };

//       addSymbols(flattenedSymbols, results);

//       return flattenedSymbols.sort((x: vscode.DocumentSymbol, y: vscode.DocumentSymbol) => {
//         const lineDiff = x.selectionRange.start.line - y.selectionRange.start.line;
//         if(lineDiff === 0) {
//           return x.selectionRange.start.character - y.selectionRange.start.character;
//         }
//         return lineDiff;
//       });
//     })) || [];
//   };

// 	let activeEditor = vscode.window.activeTextEditor;

// 	function updateDecorations() {
// 		if (!activeEditor) {
// 			return;
//     }
    
    
//     console.log(tree.length);

// 		const text = activeEditor.document.getText();
    
//     const variableDecoration: vscode.DecorationOptions[] = [];

//     console.log(tree.length);
//     var a = Array.from(varNames).sort();
//     var countColor = 0;
//     for (let i = 0; i < a.length; i++) {
//       console.log(a[i]);
      
//       var VarColor = colors[countColor];
//       countColor = countColor + 1;
//       if (countColor == 5){
//         countColor = 0;
//       }
//       var variableDecorator = vscode.window.createTextEditorDecorationType({
//         // cursor: 'crosshair',
//         // use a themable color. See package.json for the declaration and default values.
//         color: VarColor
//       });
//       var test = a[i];
//       if (typeof test === "string" && test != "self" && test.length > 3) {
//         var possibleSymbolsBeforeFunc = '(?<!(def\\s))';
//         var possibleSymbolsBefore = '[,\\s\\.=\\)\\(\\[\\]\\>\\-\\:\r\n{]';
//         var possibleSymbolsAfter = '[,\\s\\.=\\)\\[\\]\\>\\-\\:\r\n}]';
//         const notyperegex = new RegExp(possibleSymbolsBefore + test + possibleSymbolsAfter, "g");
//         const varregEx = new RegExp(possibleSymbolsBeforeFunc + test, "g")
//         let matchVar; 
//         while ((matchVar = notyperegex.exec(text))) {
//           var texttmp = text.substring(matchVar.index - 4, matchVar.index)
//           // console.log(texttmp);
//           if(!varregEx.test(texttmp)){
//             console.log(matchVar.index)
//             const startPos = activeEditor.document.positionAt(matchVar.index + 1);
//             const endPos = activeEditor.document.positionAt(matchVar.index + matchVar[0].length - 1);
//             const decoration = { range: new vscode.Range(startPos, endPos)
//               , hoverMessage: 'Variable **' + matchVar[0] + '**' 
//             };
//             variableDecoration.push(decoration);
//           }
//         }
//       }
//       activeEditor.setDecorations(variableDecorator, variableDecoration);
      
//     }
    
    
//     console.log("DONE");
// 	}

  
// 	function triggerUpdateDecorations() {
// 		if (timeout) {
// 			clearTimeout(timeout);
// 			timeout = undefined;
// 		}
// 		timeout = setTimeout(updateDecorations, 0);
// 	}

// 	if (activeEditor) {
// 		triggerUpdateDecorations();
// 	}


// 	vscode.window.onDidChangeActiveTextEditor(editor => {
// 		activeEditor = editor;
// 		if (editor) {
//       triggerUpdateDecorations();
// 		}
// 	}, null, context.subscriptions);

// 	vscode.workspace.onDidChangeTextDocument(event => {
// 		if (activeEditor && event.document === activeEditor.document) {
//       triggerUpdateDecorations();
// 		}
//   }, null, context.subscriptions);
  


//   vscode.workspace.onDidSaveTextDocument(event => {
// 		if (activeEditor && event === activeEditor.document) {
//       console.log("REFRESH");
//       refreshTree(activeEditor);
//       varNames.clear();
//       for (let i = 0; i < tree.length; i++) {
//         var line = activeEditor.document.lineAt(tree[i].selectionRange.start.line);
//         var word = line.text.substring(tree[i].selectionRange.start.character, tree[i].selectionRange.end.character);
//         // console.log(word.split(/[:=]/)[0]);
//         varNames.add(word.split(/[:=]/)[0]);
//       }
//       // This line can make it so that Enter doesn't work anymore on the editor
//       // triggerUpdateDecorations();
//       // updateDecorations();
// 		}
//   }, null, context.subscriptions);
  
//   // vscode.workspace.onDidOpenTextDocument(event => {
// 	// 	if (activeEditor && event === activeEditor.document) {
//   //     console.log("OPen document");
//   //     refreshTree(activeEditor);
//   //      // variableNames.clear();
//   //     for (let i = 0; i < tree.length; i++) {
//   //       var line = activeEditor.document.lineAt(tree[i].selectionRange.start.line);
//   //       var word = line.text.substring(tree[i].selectionRange.start.character, tree[i].selectionRange.end.character);
//   //       // console.log(word.split(/[:=]/)[0]);
//   //       varNames.add(word.split(/[:=]/)[0]);

//   //     }
// 	// 	}
// 	// }, null, context.subscriptions);

// }

