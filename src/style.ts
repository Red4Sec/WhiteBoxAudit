'use strict';

// Imports

import { workspace , window , OverviewRulerLane } from 'vscode';

const config = workspace.getConfiguration();

// Create a decorator type that we use to decorate good reviewed

export const goodReviewedDecorationType = window.createTextEditorDecorationType
({
    borderWidth: '0px',
    borderStyle: 'solid',
    overviewRulerColor: 'lime',
    overviewRulerLane: OverviewRulerLane.Right,
    light: 
    {
        // This color will be used in light color themes

        borderColor: 'darklime',
        backgroundColor: config.has('goodColor') ? config.get('goodColor') : '#00FF0019'
    },
    dark: 
    {
        // This color will be used in dark color themes

        borderColor: 'lightlime',
        backgroundColor: config.has('goodColor') ? config.get('goodColor') : '#00FF0019'
    }
});

// Create a decorator type that we use to decorate something found

export const somethingFoudDecorationType = window.createTextEditorDecorationType
({
    borderWidth: '0px',
    borderStyle: 'solid',
    overviewRulerColor: 'red',
    overviewRulerLane: OverviewRulerLane.Right,
    light: 
    {
        // This color will be used in light color themes

        borderColor: 'darkred',
        backgroundColor: config.has('somethingColor') ? config.get('somethingColor') : '#FF000059'
    },
    dark: 
    {
        // This color will be used in dark color themes

        borderColor: 'lightred',
        backgroundColor: config.has('somethingColor') ? config.get('somethingColor') : '#FF000059'
    }
});