'use strict';

import 
{ 
    workspace , commands , window , Uri , Command , TreeDataProvider , 
    Event , EventEmitter , ExtensionContext, TreeItem , TreeItemCollapsibleState 
} 
from 'vscode';

import { readdirSync , Stats , statSync, readFileSync } from 'fs';
import { basename , join } from 'path';
import { refreshEntries , dataSource , isExcluded } from './dataSource';

type WhiteBoxFileEntryInfo = { percentage: number , something : boolean };
type WhiteBoxFileEntryInfoRaw = { length: number , audited: number , something : boolean };

export class ExplorerProvider implements TreeDataProvider<FileEntry> 
{
    private _showAllItems: boolean = true;
	private _onDidChangeTreeData: EventEmitter<FileEntry | undefined> = new EventEmitter<FileEntry | undefined>();
	readonly onDidChangeTreeData: Event<FileEntry | undefined> = this._onDidChangeTreeData.event;

    constructor(context: ExtensionContext, private workspaceRoot: string) 
    {
        commands.registerCommand('whiteboxauditExplorer.openFile', (resource) => this.openResource(resource));
        commands.registerCommand('whiteboxauditExplorer.refresh', (resource) => this.refresh());
    }
    
    private openResource(resource: Uri) : void 
    {
        workspace.openTextDocument(resource)
            .then(doc=> { window.showTextDocument(doc); });
	}

    public refresh() : void 
    {
        refreshEntries();
        this._onDidChangeTreeData.fire(); 
    }

    public tongleView() : void 
    {
        this._showAllItems = !this._showAllItems;

        refreshEntries();
        this._onDidChangeTreeData.fire(); 
    }

    getTreeItem(element: FileEntry): TreeItem { return element; }

    getChildren(element?: FileEntry): Thenable<FileEntry[]> 
    {
        if (!this.workspaceRoot) 
        {
			window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
        }
        
        if (element !== undefined && element.isFile)
        {
			return Promise.resolve([]);
        }

        var wpath = this.workspaceRoot;

        if (element !== undefined)
        {
			wpath = element.fullPath;
        }

        return Promise.resolve(this.getRawChildren(wpath, -1));
    }

    private getRawChildren(fullPath : string | undefined , maxItems : number) : FileEntry[]
    {
        if (!this.workspaceRoot) 
        {
			return [];
        }
        
        var wpath = this.workspaceRoot;

        if (fullPath !== undefined)
        {
			wpath = fullPath;
        }

        let tree: Array<FileEntry> = [];
        var files = readdirSync(wpath);

        for (var x : number = 0; x < files.length; x++)
        {
            var file = join(wpath, files[x]);

            if (isExcluded(file.substr(this.workspaceRoot.length + 1))) { continue; }

            var stat : Stats = statSync(file);
            var entry : FileEntry;

            if (stat.isFile())
            {
                entry = new FileEntry(true,file,basename(file), this.computeFilePercentage(file) ,
                    TreeItemCollapsibleState.None, 
                    { command: 'whiteboxauditExplorer.openFile', title: "Open File", arguments: [file], });
                entry.contextValue = 'file';
            }
            else
            {
                entry = new FileEntry(false,file,basename(file), this.computeDirPercentage(file) ,
                    TreeItemCollapsibleState.Collapsed,undefined);

                // Remove empty folders

                if (this.getRawChildren(entry.fullPath, 1).length <= 0)
                {
                    continue;
                }
            }

            // Remove items without nothing if is requested

            if (!this._showAllItems && !entry.info.something && entry.info.percentage >=100)
            {
                continue;
            }

            tree.push(entry);

            // Limit

            if (maxItems >= 0)
            {
                if (maxItems === 0) { break; }
                maxItems--;
            }
        }

        // Sort

        tree = tree.sort
        (
            (a,b) => 
            { 
                if (a.isFile === b.isFile)
                {
                    return a.fullPath.localeCompare(b.fullPath);
                }

                // First directories

                return !a.isFile ? -1 : 1;
            }
        );

        return tree;
    }
    
    private computeDirPercentage(path : string) : WhiteBoxFileEntryInfo
    {
        var ret = this.computeDirPercentageRaw(path);

        if (ret.audited <= 0) { return { percentage: 0, something: false }; }
        if (ret.audited >= ret.length) { return { percentage: 100, something: ret.something}; }

        return { percentage: ((ret.audited * 100) / ret.length) , something: ret.something};
    }

    private computeFilePercentage(file : string) : WhiteBoxFileEntryInfo
    {
        var ret = this.computeFilePercentageRaw(file);

        if (ret.audited <= 0) { return { percentage: 0, something: false }; }
        if (ret.audited >= ret.length) { return { percentage: 100, something: ret.something}; }

        return { percentage: ((ret.audited * 100) / ret.length) , something: ret.something};
    }

    private computeDirPercentageRaw(fullpath : string) : WhiteBoxFileEntryInfoRaw
    {
        if (dataSource === undefined || dataSource.files === undefined ||
            isExcluded(fullpath.substr(this.workspaceRoot.length + 1))) 
        {
            return { length: 0, audited: 0 , something: false}; 
        }

        var files = readdirSync(fullpath);
        var length = 0, audited = 0, something = false;

        for (let entry of files) 
        {
            var file = join(fullpath, entry);

            if (isExcluded(file.substr(this.workspaceRoot.length + 1))) { continue; }
            
            var ret;
            var stat : Stats = statSync(file);

            if (stat.isFile())
            {
                ret = this.computeFilePercentageRaw(join(fullpath, entry));
            }
            else
            {
                ret = this.computeDirPercentageRaw(join(fullpath, entry));
            }

            length += ret.length;
            audited += ret.audited;
            
            if (ret.something) 
            {
                something = true;
            }
        }

        return { length: length, audited: audited , something: something};
    }

    private computeFilePercentageRaw(file : string) : WhiteBoxFileEntryInfoRaw
    {
        var lines = readFileSync(file).toString().split('\n').length;

        if (dataSource ===  undefined || dataSource.files === undefined) 
        { 
            return { length: lines, audited: 0 , something: false }; 
        }

        var smallfile = file.substr(this.workspaceRoot.length + 1);
        var files = Object.getOwnPropertyNames(dataSource.files);

        for (let entry of files) 
        {
            if (smallfile === entry)
            {
                var audited = 0;
                var something = false;
                
                for (let audit of dataSource.files[entry].audit) 
                {
                    if (audit.length !== undefined && audit.length > 0) 
                    {
                        audited += audit.length;
                    }
                    if (audit.style === "something")
                    {
                        something = true;
                    }
                }
                
                return { length: lines, audited: audited > lines ? lines : audited , something: something};
            }
        }

        return { length: lines, audited: 0 , something: false};
    }
}

export class FileEntry extends TreeItem 
{
    constructor
    (
        public readonly isFile: boolean,
        public readonly fullPath: string,
		public readonly label: string,
        public readonly info: WhiteBoxFileEntryInfo,
        
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly command?: Command
    ) 
    {
		super(label, collapsibleState);
	}

	get tooltip(): string { return `${this.label} - ${this.info.percentage.toFixed(2)} %`; }

	get description(): string { return this.info.percentage <=0 ? '' : '('+ this.info.percentage.toFixed(2) + '%)'; }

    iconPath = 
    {
		light: join(__filename, '..', '..', 'resources', 'light', this.ColorFileName() + '.svg'),
		dark : join(__filename, '..', '..', 'resources', 'dark' , this.ColorFileName() + '.svg')
    };

    private ColorFileName() : string
    {
        if (this.info.percentage > 0 )
        {
            if (this.info.something)
            {
                if (this.info.percentage >= 100) { return 'red_hat_100'; }    
                if (this.info.percentage >= 80) { return 'red_hat_80'; }
                if (this.info.percentage >= 60) { return 'red_hat_60'; }
                if (this.info.percentage >= 40) { return 'red_hat_40'; }
                
                return 'red_hat_20';
            }
            else
            {
                if (this.info.percentage >= 100) { return 'green_hat_100'; }    
                if (this.info.percentage >= 80) { return 'green_hat_80'; }
                if (this.info.percentage >= 60) { return 'green_hat_60'; }
                if (this.info.percentage >= 40) { return 'green_hat_40'; }
                
                return 'green_hat_20';
            }
        }

        return 'white_hat';
    }
    
	contextValue = 'dependency';
}