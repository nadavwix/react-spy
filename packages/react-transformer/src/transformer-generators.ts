/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import ts from 'typescript';

export function createReactTextWrap({
    createSourceAttributes,
}: {
    createSourceAttributes: (node: ts.JsxText | ts.JsxExpression) => ts.JsxAttributes;
}) {
    return function reactTextWrap(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
        return (sourceFile) => {
            let shouldAddTextComp = false;
            const jsxTextCompIdentifier = ts.createFileLevelUniqueName('JsxEditWrapper');
            sourceFile = ts.visitEachChild(sourceFile, wrapJsxElements, context);
            if (shouldAddTextComp) {
                sourceFile = addComp(sourceFile, jsxTextCompIdentifier);
            }
            return sourceFile;
            function wrapJsxElements(node: ts.Node): ts.Node | ts.Node[] {
                if (!ts.isJsxText(node)) {
                    return ts.visitEachChild(node, wrapJsxElements, context);
                }
                shouldAddTextComp = true;
                return ts.createJsxElement(
                    ts.createJsxOpeningElement(jsxTextCompIdentifier, undefined, createSourceAttributes(node)),
                    [node],
                    ts.createJsxClosingElement(jsxTextCompIdentifier)
                );
            }
        };
    };
}

export function addExpressionWrapFunctions(
    sourceFile: ts.SourceFile,
    stackIdentifier: ts.Identifier,
    sourceWrapIdentifier: ts.Identifier,
    expWrapIdentifier: ts.Identifier
) {
    sourceFile = addStack(sourceFile, stackIdentifier);
    sourceFile = addWrapSource(sourceFile, sourceWrapIdentifier, stackIdentifier);
    return addWrapExpression(sourceFile, expWrapIdentifier, stackIdentifier);
}

export function addVar(
    sourceFile: ts.SourceFile,
    varIdentifier: ts.Identifier,
    varInitializer: ts.Expression
): ts.SourceFile {
    const variableDecls = [ts.createVariableDeclaration(varIdentifier, undefined /* type */, varInitializer)];
    return insertStatementAfterImports(
        sourceFile,
        ts.createVariableStatement(
            undefined /* modifiers */,
            ts.createVariableDeclarationList(variableDecls, ts.NodeFlags.Const)
        )
    );
}
// const wrapSourceAttr = (source)=>{
// stack.unshift(source);
// return source
//};
export function addWrapSource(
    sourceFile: ts.SourceFile,
    funcIdentifier: ts.Identifier,
    stackIdentifier: ts.Identifier
): ts.SourceFile {
    const sourceParam = ts.createIdentifier('source');
    const funcNode = ts.createArrowFunction(
        undefined,
        undefined,
        [ts.createParameter(undefined, undefined, undefined, sourceParam, undefined, undefined, undefined)],
        undefined,
        ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        ts.createBlock([
            ts.createStatement(
                ts.createCall(ts.createPropertyAccess(stackIdentifier, 'unshift'), undefined, [sourceParam])
            ),
            ts.createReturn(sourceParam),
        ])
    );
    return addVar(sourceFile, funcIdentifier, funcNode);
}
// const wrapExpression = (loc, value, lastExp)=>{
// const currParent = stack[0]
// if(currParent){
//   if(!currParent.expressions){
//      currParent.expressions = [];
//   }
//   currParent.expressions.push({ loc, value})
//    if(lastExp){
//       stack.shift();
//    }
// }
// return expressionRes
//};
export function addWrapExpression(
    sourceFile: ts.SourceFile,
    funcIdentifier: ts.Identifier,
    stackIdentifier: ts.Identifier
): ts.SourceFile {
    const locParam = ts.createIdentifier('location');
    const isExpParam = ts.createIdentifier('isExp');
    const valueParam = ts.createIdentifier('value');
    const isLastExpression = ts.createIdentifier('lastExp');
    const currParentConst = ts.createIdentifier('currParent');
    const funcNode = ts.createArrowFunction(
        undefined,
        undefined,
        [
            ts.createParameter(undefined, undefined, undefined, locParam, undefined, undefined, undefined),
            ts.createParameter(undefined, undefined, undefined, valueParam, undefined, undefined, undefined),
            ts.createParameter(undefined, undefined, undefined, isExpParam, undefined, undefined, undefined),
            ts.createParameter(undefined, undefined, undefined, isLastExpression, undefined, undefined, undefined),
        ],
        undefined,
        ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        ts.createBlock([
            ts.createVariableStatement(undefined, [
                ts.createVariableDeclaration(currParentConst, undefined, ts.createElementAccess(stackIdentifier, 0)),
            ]),
            ts.createIf(
                currParentConst,
                ts.createBlock([
                    ts.createIf(
                        ts.createPrefix(
                            ts.SyntaxKind.ExclamationToken,
                            ts.createPropertyAccess(currParentConst, 'expressions')
                        ),
                        ts.createBlock([
                            ts.createExpressionStatement(
                                ts.createBinary(
                                    ts.createPropertyAccess(currParentConst, 'expressions'),
                                    ts.SyntaxKind.EqualsToken,
                                    ts.createArrayLiteral()
                                )
                            ),
                        ])
                    ),
                    ts.createExpressionStatement(
                        ts.createCall(
                            ts.createPropertyAccess(ts.createPropertyAccess(currParentConst, 'expressions'), 'push'),
                            undefined,
                            [
                                ts.createObjectLiteral([
                                    ts.createPropertyAssignment('value', valueParam),
                                    ts.createPropertyAssignment('location', locParam),
                                    ts.createPropertyAssignment('isExpression', isExpParam),
                                ]),
                            ]
                        )
                    ),
                    ts.createIf(
                        isLastExpression,
                        ts.createBlock([
                            ts.createExpressionStatement(
                                ts.createCall(ts.createPropertyAccess(stackIdentifier, 'shift'), undefined, undefined)
                            ),
                        ])
                    ),
                ])
            ),

            ts.createReturn(valueParam),
        ])
    );
    return addVar(sourceFile, funcIdentifier, funcNode);
}
// const stack = [];
export function addStack(sourceFile: ts.SourceFile, stackIdentifier: ts.Identifier): ts.SourceFile {
    const stack = ts.createArrayLiteral();
    return addVar(sourceFile, stackIdentifier, stack);
}

export function addComp(sourceFile: ts.SourceFile, compIdentifier: ts.Identifier): ts.SourceFile {
    const compNode = ts.createArrowFunction(
        undefined,
        undefined,
        [
            ts.createParameter(
                undefined,
                undefined,
                undefined,
                ts.createObjectBindingPattern([
                    ts.createBindingElement(undefined, undefined, ts.createIdentifier('children'), undefined),
                ]),
                undefined,
                undefined,
                undefined
            ),
        ],
        undefined,
        ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        ts.createConditional(
            ts.createStrictEquality(ts.createIdentifier('children'), ts.createIdentifier('undefined')),
            ts.createStringLiteral(''),
            ts.createIdentifier('children')
        )
    );
    return addVar(sourceFile, compIdentifier, compNode);
}
// insert a new statement above the first non-import statement
function insertStatementAfterImports(sourceFile: ts.SourceFile, statement: ts.Statement): ts.SourceFile {
    const { statements } = sourceFile;
    const nonImportIdx = statements.findIndex((s) => !ts.isImportDeclaration(s));
    const newStatements =
        nonImportIdx === -1
            ? [statement, ...statements]
            : [...statements.slice(0, nonImportIdx), statement, ...statements.slice(nonImportIdx)];
    return ts.updateSourceFileNode(sourceFile, newStatements);
}
