import {EmitHint, type Node, NodeFlags, ParameterDeclaration, SyntaxKind, ts} from 'ts-morph'
import {processSourceFile} from './runner'


const tsF = ts.factory

const DEFAULT_ELEMENT_NAME = '_el'
const DEFAULT_ITERABLE_NAME = '_i'
const DEFAULT_ARRAY_NAME = '_arr'

function isForEach(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) && node.expression.getChildren()[2]?.getText() === 'forEach'
}

function removeReturnStatements(node: Node) {
    node.forEachChild(childNode => {
        try {
            if (ts.isFunctionDeclaration(childNode.compilerNode)) {
                return
            }
            if (ts.isReturnStatement(childNode.compilerNode)) {
                node.replaceWithText(ts.createPrinter().printNode(EmitHint.Unspecified, ts.factory.createContinueStatement(), node.compilerNode.getSourceFile()))
                return
            }
            removeReturnStatements(childNode)
        } catch (err) {
            //
        }
    })
}

processSourceFile('./examples/forEach.ts', (sourceFile) => {
    const functionsReference = new Map<number, number>()

    sourceFile.forEachDescendant(node => {
        if (isForEach(node.compilerNode)) {
            removeReturnStatements(node)

            const func = node.compilerNode.arguments[0]
            let requiredParams: Array<ParameterDeclaration> = []
            // @ts-ignore
            if (!func.body) {
                try {
                    const funcDeclaration = sourceFile.getFunctionOrThrow(func.getText())
                    requiredParams = funcDeclaration?.getParameters()
                } catch (err) {
                    //
                }
                functionsReference.set(node.getStart(), requiredParams.length)
            }
        }
    })

    const result = sourceFile.copy('')

    result.transform(traversal => {
        const node = traversal.visitChildren()

        if (isForEach(node)) {
            const func = node.arguments[0]
            const array = node.expression.getChildren()[0]
            let funcBody: ts.FunctionBody | null = null
            let funcParams: Array<ts.ParameterDeclaration> = []

            if (ts.isFunctionDeclaration(func) || ts.isArrowFunction(func)) {
                funcBody = func.body as ts.FunctionBody
                funcParams = [...func.parameters]
            }

            let paramsCount = funcBody ? funcParams.length : 0
            if (functionsReference.has(node.getStart())) {
                paramsCount = functionsReference.get(node.getStart()) as number
            }

            const elementIdentifierName = funcParams[0] ? funcParams[0].name.getText() : tsF.createUniqueName(DEFAULT_ELEMENT_NAME).text
            const elementIdentifier = tsF.createIdentifier(elementIdentifierName)
            const indexIdentifier = tsF.createIdentifier(funcParams[1]?.name.getText() ?? DEFAULT_ITERABLE_NAME)

            const getLoopBody = () => {
                const argumentsArray: Array<ts.Expression> = [elementIdentifier]
                if (paramsCount >= 2) {
                    argumentsArray.push(indexIdentifier)
                }
                if (paramsCount >= 3) {
                    argumentsArray.push(tsF.createIdentifier(funcParams[2]?.name.getText() ?? DEFAULT_ARRAY_NAME))
                }
                return tsF.createBlock(funcBody?.statements ?? [
                    tsF.createExpressionStatement(tsF.createCallExpression(
                        func, [], argumentsArray
                    ))
                ])
            }

            if (paramsCount <= 1) {
                return tsF.createForOfStatement(
                    undefined,
                    tsF.createVariableDeclarationList(
                        [tsF.createVariableDeclaration(elementIdentifierName)],
                        NodeFlags.Let
                    ),
                    array as ts.Expression,
                    getLoopBody()
                )
            }

            const initDeclarations = [
                tsF.createVariableDeclaration(indexIdentifier.text, undefined, undefined, tsF.createNumericLiteral(0)),
                tsF.createVariableDeclaration(
                    funcParams[0]?.name ?? DEFAULT_ELEMENT_NAME, undefined, undefined, tsF.createElementAccessExpression(
                        array as ts.Expression, indexIdentifier
                    )
                )
            ]

            if (paramsCount >= 3 && funcParams[2]?.name.getText() !== array.getText()) {
                initDeclarations.push(tsF.createVariableDeclaration(funcParams[2]?.name ?? DEFAULT_ARRAY_NAME, undefined, undefined, array as ts.Expression))
            }

            const initializer = tsF.createVariableDeclarationList(
                initDeclarations,
                NodeFlags.Let
            )

            return tsF.createForStatement(
                initializer,
                tsF.createLessThan(indexIdentifier, tsF.createPropertyAccessExpression(tsF.createIdentifier(array.getText()), 'length')),
                tsF.createCommaListExpression([
                    tsF.createPostfixIncrement(indexIdentifier),
                    tsF.createBinaryExpression((funcParams[0]?.name ?? elementIdentifier) as ts.Expression, SyntaxKind.EqualsToken, tsF.createElementAccessExpression(
                        array as ts.Expression, indexIdentifier
                    ))]
                ),
                getLoopBody()
            )
        }

        return node
    })

    console.log(result.getFullText())
})
