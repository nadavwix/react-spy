/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import ts from 'typescript';
import { addExpressionWrapFunctions } from './transformer-generators';

const SELF = '__self';
const SOURCE = '__source';
const JSX_FILENAME = '__jsxFileName';

// file-wide unique identifier that would point to the fileName string literal
const jsxFileNameIdentifier = ts.createFileLevelUniqueName(JSX_FILENAME);
const stackIdentifier = ts.createFileLevelUniqueName('wcs_expression_stack');
const wrapSourceIdentifier = ts.createFileLevelUniqueName('wcs_wrap_source');
const wrapExpIndentifier = ts.createFileLevelUniqueName('wcs_wrap_expression');

export const isNativeTag = (node: ts.JsxElement) => {
  const tag = node.openingElement.tagName;
  if (ts.isIdentifier(tag) && tag.text.charAt(0) === tag.text.charAt(0).toLowerCase()) {
    return true;
  }
  return false;
};
export function shouldWrapText(node: ts.Node): node is ts.JsxText {
  return ts.isJsxText(node) && !!node.text.trim().length;
}
export function shouldWrapExp(node: ts.Node): node is ts.JsxExpression {
  return ts.isJsxExpression(node) && node.parent && ts.isJsxElement(node.parent);
}

export function reactDevTransformer(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
  return (sourceFile) => {
    // we want to add the __jsxFileName const only if it is used in any added attribute
    let shouldAddFileNameConst = false;

    // fist run the visitor, so it will mark whether we need to add fileName const declaration
    sourceFile = ts.visitEachChild(sourceFile, addJSXMetadata, context);

    if (shouldAddFileNameConst) {
      sourceFile = addFileNameConst(sourceFile, jsxFileNameIdentifier, sourceFile.fileName);
      sourceFile = addExpressionWrapFunctions(sourceFile, stackIdentifier, wrapSourceIdentifier, wrapExpIndentifier);
    }

    return sourceFile;

    function addJSXMetadata(node: ts.Node): ts.Node | ts.Node[] {
      // wrap text and attributes with components
      if (ts.isJsxAttributes(node) && node.parent) {
        const { userDefinedSelf, userDefinedSource } = findUserDefinedAttributes(node);

        const newAttributes: ts.JsxAttribute[] = [];

        if (!userDefinedSelf) {
          newAttributes.push(createSelfAttribute());
        }

        if (!userDefinedSource) {
          shouldAddFileNameConst = true;
          const parentJsx = ts.isJsxSelfClosingElement(node.parent) ? node.parent : node.parent.parent;
          const { pos, line, end } = getFixedPos(sourceFile, parentJsx);
          const hasWrapped =
            ts.isJsxElement(parentJsx) &&
            !!parentJsx.children.find((child) => ts.isJsxExpression(child) || shouldWrapText(child));
          newAttributes.push(
            createSourceAttribute(createLocationObject(jsxFileNameIdentifier, line, pos, end), hasWrapped)
          );
        }

        if (newAttributes.length) {
          // we actually created new attributes, so append them
          node = ts.updateJsxAttributes(node, node.properties.concat(newAttributes));
        }
      } else if (shouldWrapExp(node)) {
        node = ts.createJsxExpression(
          undefined,
          ts.createCall(wrapExpIndentifier, undefined, [
            createLocObject(sourceFile, jsxFileNameIdentifier, node),
            node.expression || ts.createNull(),
            ts.createTrue(),
            isLastExpression(node, context) ? ts.createTrue() : ts.createFalse(),
          ])
        );
      } else if (shouldWrapText(node)) {
        node = ts.createJsxExpression(
          undefined,
          ts.createCall(wrapExpIndentifier, undefined, [
            createLocObject(sourceFile, jsxFileNameIdentifier, node),
            ts.createStringLiteral(node.text) || ts.createNull(),
            ts.createFalse(),
            isLastExpression(node, context) ? ts.createTrue() : ts.createFalse(),
          ])
        );
      }

      return ts.visitEachChild(node, addJSXMetadata, context);
    }
  };
}

function isLastExpression(node: ts.Node, context: ts.TransformationContext) {
  if (!node.parent) {
    return false;
  }
  let exp: ts.Node | undefined;
  ts.visitEachChild(
    node.parent,
    (child) => {
      if (ts.isJsxExpression(child) || shouldWrapText(child)) {
        exp = child;
      }
      return child;
    },
    context
  );
  return exp === node;
}

function getFixedPos(sourceFile: ts.SourceFile, node: ts.Node) {
  const pos = node.getStart();
  const end = node.getEnd();
  const { line } = ts.getLineAndCharacterOfPosition(sourceFile, pos);
  const textTillStart = sourceFile.getFullText().slice(0, pos);
  const textTillEnd = sourceFile.getFullText().slice(0, end);
  const windowsLineBreaksTillStart = textTillStart.split('\r\n').length - 1;
  const windowsLineBreaksTillEnd = textTillEnd.split('\r\n').length - 1;
  return {
    pos: pos - windowsLineBreaksTillStart,
    end: end - windowsLineBreaksTillEnd,
    line,
  };
}
function createLocObject(sourceFile: ts.SourceFile, jsxFileNameIdentifier: ts.Identifier, parentJsx: ts.Node) {
  const { end, pos, line } = getFixedPos(sourceFile, parentJsx);
  return createLocationObject(jsxFileNameIdentifier, line, pos, end);
}

// iterate over existing properties to check whether user already defined one of the props
function findUserDefinedAttributes(node: ts.JsxAttributes) {
  let userDefinedSelf = false;
  let userDefinedSource = false;

  for (const prop of node.properties) {
    const { name: propName } = prop;
    if (propName && (ts.isIdentifier(propName) || ts.isStringLiteral(propName))) {
      if (propName.text === SELF) {
        userDefinedSelf = true;
      } else if (propName.text === SOURCE) {
        userDefinedSource = true;
      }
    }
  }
  return { userDefinedSelf, userDefinedSource };
}

// __self={this}
function createSelfAttribute(): ts.JsxAttribute {
  return ts.createJsxAttribute(ts.createIdentifier(SELF), ts.createJsxExpression(undefined, ts.createThis()));
}

// __source={ [location-object] }
function createSourceAttribute(locationObj: ts.ObjectLiteralExpression, hasExpressions: boolean): ts.JsxAttribute {
  return ts.createJsxAttribute(
    ts.createIdentifier(SOURCE),
    ts.createJsxExpression(
      undefined,
      hasExpressions ? ts.createCall(wrapSourceIdentifier, undefined, [locationObj]) : locationObj
    )
  );
}

// { fileName: [path-to-file], lineNumber: [element-line-number] }
function createLocationObject(jsxFileNameIdentifier: ts.Identifier, line: number, pos: number, end: number) {
  const assignments = [
    ts.createPropertyAssignment(
      'fileName',
      jsxFileNameIdentifier // use the file-wide identifier for fileName value
    ),
    ts.createPropertyAssignment('lineNumber', ts.createNumericLiteral(String(line + 1))),
    ts.createPropertyAssignment('pos', ts.createNumericLiteral(String(pos))),
    ts.createPropertyAssignment('end', ts.createNumericLiteral(String(end))),
  ];
  // if (id) {
  //     assignments.push(ts.createPropertyAssignment('id', ts.createStringLiteral(id)));
  // }
  return ts.createObjectLiteral(assignments);
}

// const __jsxFileName = "/path/to/file.ts"
function addFileNameConst(
  sourceFile: ts.SourceFile,
  jsxFileNameIdentifier: ts.Identifier,
  fileName: string
): ts.SourceFile {
  const variableDecls = [
    ts.createVariableDeclaration(jsxFileNameIdentifier, undefined /* type */, ts.createStringLiteral(fileName)),
  ];

  return insertStatementAfterImports(
    sourceFile,
    ts.createVariableStatement(
      undefined /* modifiers */,
      ts.createVariableDeclarationList(variableDecls, ts.NodeFlags.Const)
    )
  );
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
