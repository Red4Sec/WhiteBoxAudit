'use strict';

// Imports

import { commands , ExtensionContext , window , workspace , Range, Position , QuickInput } from 'vscode';

import { goodReviewedDecorationType , somethingFoudDecorationType } from './style';
import { ExplorerProvider } from './explorerProvider';
import { refreshEntries , dataSource, saveDataSource , dataSourcePath } from './dataSource';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

export function activate(context: ExtensionContext) 
{
	// This line of code will only be executed once when your extension is activated

	refreshEntries();
	
	var explorer : ExplorerProvider = new ExplorerProvider(context, dataSourcePath);
	window.registerTreeDataProvider('whiteboxexplorer', explorer);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	
	let disposable = commands.registerCommand('extension.WhiteBoxAudit.ReviewSomething', function () 
	{
		review(false);
	});

	context.subscriptions.push(disposable);

	disposable = commands.registerCommand('extension.WhiteBoxAudit.ReviewGood', function () 
	{
		review(true);
	});

	context.subscriptions.push(disposable);

	let activeEditor = window.activeTextEditor;

	if (activeEditor) 
	{
		triggerUpdateDecorations();
	}

	window.onDidChangeActiveTextEditor
	(
		editor => 
		{
			activeEditor = editor;
			if (editor) 
			{
				triggerUpdateDecorations();
			}
		}
	, null, context.subscriptions);

	workspace.onDidChangeTextDocument
	(
		event => 
		{
			if (activeEditor && event.document === activeEditor.document) 
			{
				triggerUpdateDecorations();
			}
		}
	, null, context.subscriptions);

	var timeout : any = undefined;
	function triggerUpdateDecorations() 
	{
		if (timeout !== undefined) 
		{
			clearTimeout(timeout);
		}

		timeout = setTimeout(updateDecorations, 500);
	}

	function updateDecorations() 
	{
		if (!activeEditor || workspace.rootPath === undefined)
		{
			return;
		}

		var currentEntry = dataSource === undefined ? undefined :  
			dataSource['files'][activeEditor.document.fileName.substr(dataSourcePath.length+1)];

		const goodReviewed = [] , somethingFound = [];

		if (currentEntry !== undefined) 
		{
			for (let entry of currentEntry.audit)
			{
				// Compute line index
				
				var from   : Position = activeEditor.document.lineAt(entry.from).range.start;
				var length : Position = activeEditor.document.lineAt(entry.from + entry.length -1).range.end;

				const decoration = 
				{ 
					range: new Range(from, length),
					hoverMessage: entry.message,
				};
		
				switch (entry.style)
				{
					case undefined : break;

					case 'good' : goodReviewed.push(decoration); break;
					case 'something' : somethingFound.push(decoration); break;
				}
			}
		}

		activeEditor.setDecorations(goodReviewedDecorationType, goodReviewed);
		activeEditor.setDecorations(somethingFoudDecorationType, somethingFound);
	}
	
	async function review(isGood = true)
	{
		if (!activeEditor || workspace.rootPath === undefined || dataSource === undefined)
		{
			return;
		}

		// The code you place here will be executed every time your command is executed
		// Display a message box to the user

		window.showInformationMessage(isGood ? 'Try harder!' : 'Nice catch!');

		var file = activeEditor.document.fileName.substr(dataSourcePath.length + 1);
		var entry = dataSource['files'][file];

		if (entry === undefined)
		{
			entry = { 'audit' : [] };
		}

		var selection = activeEditor.selection;
		var from = selection.start.line;
		var length = selection.end.line - selection.start.line + 1;
		var style = isGood ? 'good' : 'something';
		var messageHint = isGood ? 'Reviewed' : 'Something was found!';

		// Try to find the message

		for (let audit of entry.audit)
		{
			if (audit.style !== style)
			{
				continue;
			}

			if (audit.from <= from &&
				audit.from + audit.length >= from + length)
				{
					messageHint = audit.message;
					break;
				}
		}

		// Set values

		var message = await window.showInputBox
		({
			value: messageHint,
			placeHolder: 'Please describe your review'
		});

		var joined : boolean = false;
		entry.lines =  activeEditor.document.lineCount;

		// Try to join

		for (let audit of entry.audit)
		{
			if (audit.style !== style)
			{
				continue;
			}

			// End with

			if (audit.from + audit.length === from)
			{
				audit.length += length;
				audit.message = message;
				joined = true;
				break;
			}

			// Start with

			if (audit.from === from + length)
			{
				audit.from -= length;
				audit.length += length;
				audit.message = message;
				joined = true;
				break;
			}
		}

		if (!joined)
		{
			entry.audit.push
			({ 
				'from'    : from,
				'length'  : length,
				'message' : message,
				'style'   : style
			});
		}

		dataSource['files'][file] = entry;
		
		saveDataSource();
		updateDecorations();
		explorer.refresh();
	}
}

// This method is called when your extension is deactivated

export function deactivate() {}