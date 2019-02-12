'use strict';

import { workspace } from 'vscode';
import { existsSync , readFileSync , createWriteStream } from 'fs';
import { join } from 'path';

export var dataSource : any;
export var dataSourcePath : string;

var excludeExpressions : string[] = [];

/*
entries =
{
    "exclude": [ ".git" ]
    "files":
    {
        "main.go":
        {
            "lines": 10,
            "audit":
            [
                {
                    "from": 0,
                    "length": 2,
                    "message":"Reviewed",
                    "style":"good"
                },
                {
                    "from": 3,
                    "length": 4,
                    "message":"There are one vuln",
                    "style":"something"
                }
            ]
        }
    }
};
*/
            
export function refreshEntries() : void
{
    dataSourcePath = '';
	if (workspace.rootPath !== undefined)
	{
		dataSourcePath = workspace.rootPath;
    }
    
    var file = join(dataSourcePath, '.whiteboxaudit.json');

    if (existsSync(file)) 
    { 
        var reader = readFileSync(file);
    
        try{ dataSource = JSON.parse(reader.toString('utf8')); }
        catch (err) { /* Wrong json */ }     
    }

    if (dataSource === undefined)
    {
        dataSource = { };
    }

    if (dataSource.files === undefined)
    {
        dataSource['files'] = { }; 
    }

    if (dataSource.exclude === undefined)
    {
        dataSource['exclude'] =  [ '.git' , '.vscode' , '.whiteboxaudit.json' ];
    }

    excludeExpressions = [];
    var excludes = dataSource !== undefined ? dataSource['exclude'] : undefined;

    if (excludes !== undefined)
    {
        for (let exclude of excludes)
        {
            excludeExpressions.push(exclude);
        }
    }
}

function wildCompare(a : string, b : string) 
{
    var startIndex = 0, array = b.split('*');
    
    for (var i = 0; i < array.length; i++) 
    {
        var index = a.indexOf(array[i], startIndex);

        if (index === -1) { return false; }
        else { startIndex = index; }
    }

    return true;
}

export function isExcluded(file : string) : boolean
{
    if (excludeExpressions !== undefined)
    {
        for (let exclude of excludeExpressions)
        {
            if (wildCompare(file, exclude))
            {
                return true;
            }
        }
    }

    return false;
}

export function saveDataSource() : void
{
    var writer = createWriteStream(join(dataSourcePath , '.whiteboxaudit.json'));
    writer.write(JSON.stringify(dataSource, null, 4));
    writer.close();
}