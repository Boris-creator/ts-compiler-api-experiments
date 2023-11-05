import * as fs from 'fs'
import {Project, type SourceFile} from 'ts-morph'

export function processSourceFile(filePath: string, process: (sourceFile: SourceFile) => void) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err)
            return
        }
        const project = new Project()
        const sourceFile = project.createSourceFile('example.ts', data)
        process(sourceFile)
    })
}
