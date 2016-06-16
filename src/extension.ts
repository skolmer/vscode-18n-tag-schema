"use strict";

import * as vscode from 'vscode';
import * as path from 'path';
import i18nTagSchema from 'i18n-tag-schema'

const config = vscode.workspace.getConfiguration('i18nTag')
const filter = config['filter'] || '\\.jsx?'
const srcPath = path.resolve(vscode.workspace.rootPath, config['src'] || '.')
const schema = path.resolve(vscode.workspace.rootPath, config['schema'] || './translation.schema.json')
const spinner = ['🌍 ',	'🌎 ', '🌏 ']
const spinnerInterval = 180
const spinnerLength = spinner.length
const spinnerMessage = 'Generating i18n translation schema'
let info = ''
let spinnerInstance: vscode.StatusBarItem
let spinnerIndex = 0
let showSpinner = false
let outputChannel: vscode.OutputChannel
let oldSchema: string

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('i18nTag')
    context.subscriptions.push(outputChannel)

    var updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        updateSchema(context)
    })

    var showTranslationSchema = vscode.commands.registerCommand('i18nTag.showTranslationSchema', (context) => {
        vscode.workspace.openTextDocument(schema).then((file) => { 
            vscode.window.showTextDocument(file)
        }, (reason) => {
            vscode.window.showErrorMessage(reason)
        });
    })

    var showTranslationSchemaChanges = vscode.commands.registerCommand('i18nTag.showTranslationSchemaChanges', (context) => {
        if(oldSchema) {
            vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('i18n-schema:old.json'), vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)) 
        } else {
            vscode.window.showInformationMessage(`Schema has no local changes`)
        }
    })    

    let registration = vscode.workspace.registerTextDocumentContentProvider('i18n-schema', {
        provideTextDocumentContent(uri) {
            switch(uri.path) {
                case 'old.json':
                    return oldSchema
                default:
                    return new Promise((fulfill, reject) => {
                        vscode.workspace.openTextDocument(schema).then((file) => {        
                            fulfill(file.getText())
                        }, (reason) => {
                            reject(reason)
                        });
                    })
            }
        }
    })

    context.subscriptions.push(updateSchemaCommand, showTranslationSchema, showTranslationSchemaChanges, registration)
}

function spin(start) {
    showSpinner = start
    if(!showSpinner && spinnerInstance) {        
        spinnerInstance.dispose()
        spinnerInstance = undefined
        spinnerIndex = 0
        info = ''
    }
    if(showSpinner) {
        let char = spinner[spinnerIndex]      
        if(!spinnerInstance) {
            spinnerInstance = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, Number.MIN_SAFE_INTEGER)
            spinnerInstance.show()
        } 
        if(info) {
            spinnerInstance.text = `${char} ${spinnerMessage}: ${info}`
        } else {
            spinnerInstance.text = `${char} ${spinnerMessage}...`
        }
        
        if(spinnerIndex < spinnerLength-1) {
            spinnerIndex++
        } else {
            spinnerIndex = 0
        }   
        setTimeout(() => {
            spin(showSpinner)
        }, spinnerInterval);
    }
}

function updateSchema(context: vscode.ExtensionContext) {   
    spin(true)
    const callback = (message: string, type: string = 'success') => {
        info = ''
        switch (type) {
            case 'success':
                spin(false)
                if(message.indexOf('i18nTag json schema has been updated') > -1) {
                    var items = (oldSchema) ? ['Show Diff'] : []
                    vscode.window.showInformationMessage(message, ...items).then((value) => {
                        if(value === 'Show Diff') {
                            vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('i18n-schema:old.json'), vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)) 
                        }
                    })
                } else {
                    vscode.window.showInformationMessage(message, 'Show File').then((value) => {
                        if(value === 'Show File') {
                            vscode.workspace.openTextDocument(schema).then((file) => { 
                                vscode.window.showTextDocument(file)
                            }, (reason) => {
                                vscode.window.showErrorMessage(reason)
                            });
                        }
                    })
                }
                break
            case 'warn':
                vscode.window.showWarningMessage(message)
                break
            case 'error':
                spin(false)
                vscode.window.showErrorMessage(message)
                break
            case 'info':
                info = message
                outputChannel.appendLine(message)
                break
            default:
                outputChannel.appendLine(message)
                outputChannel.show(true)
                break
        }
    }
    vscode.workspace.openTextDocument(schema).then((file) => {        
        oldSchema = file.getText()
        i18nTagSchema(srcPath, filter, schema, callback)
    }, (reason) => {
        oldSchema = null
        i18nTagSchema(srcPath, filter, schema, callback)
    });
}

export function deactivate() {
}