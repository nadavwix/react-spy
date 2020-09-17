/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { initialize } from 'react-devtools-inline/backend';
import type { FrameWorkSpy, DomFrameworkStructure, ComponentInfo } from '@react-spy/types/src/index';
import { sleep } from 'promise-assist';

export type ExpressionMap = Map<unknown, ExpressionLocation[]>;

initialize(window);
let activeRenderer = 1;
const reactListeners: Set<() => void> = new Set();
window.__REACT_DEVTOOLS_GLOBAL_HOOK__.on('renderer', async (ev) => {
  activeRenderer = ev.id;

  await sleep(1);
  ev.renderer.setRefreshHandler(() => {
    onReactUpdate().catch((err) => {
      throw err;
    });
  });
  [...reactListeners].forEach((l) => l());
});
const onReactUpdate = async () => {
  await sleep(0);
  [...reactListeners].forEach((l) => l());
};
export class ReactFrameWorkSpy implements FrameWorkSpy {
  getCurrentStructure(idx?: number): DomFrameworkStructure[] | undefined {
    const roots = [...window.__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots(activeRenderer)];
    const root = idx ? roots[idx] : roots[roots.length - 1];
    if (!root) {
      return;
    }
    const parsed = parseReactTree(root.current);
    if (!parsed) {
      return;
    }
    return [parsed.structure, ...parsed.siblings];
  }
  subscribe(cb: () => void): void {
    reactListeners.add(cb);
  }
  unsubscribe(cb: () => void): void {
    reactListeners.delete(cb);
  }
}

export interface ExpressionLocation {
  value: any;
  location: SourceLocation;
  isExpression: boolean;
}
export interface LocationWithExpressions extends SourceLocation {
  expressions: Array<ExpressionLocation>;
}

function asLocationWithExpressions(loc: SourceLocation): loc is LocationWithExpressions {
  return !!(loc as any).expressions;
}

function isRuntimeJsxElement(el: any): el is JSX.Element {
  return (
    !!(typeof el === 'object') &&
    !!(typeof el.props === 'object') &&
    !!(typeof el.type === 'object' || typeof el.type === 'string' || typeof el.type === 'function')
  );
}
export function addExpressionsToMap(node: FiberNode, map: ExpressionMap): void {
  const expressions = getChildExpressions(node);
  for (const exp of expressions) {
    addExpressionToMap(exp, map);
  }
}
export function getChildExpressions(node: FiberNode): ExpressionLocation[] {
  if (node._debugSource && asLocationWithExpressions(node._debugSource)) {
    return node._debugSource.expressions;
  }
  return [];
}

function addToArrayMap<K, V>(map: Map<K, V[]>, key: K, v: V): void {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key)!.push(v);
}

function isSupportedPrimitive(v: any): v is string | number {
  const t = typeof v;
  return t === 'number' || t === 'string';
}

function addExpressionToMap(exp: ExpressionLocation, map: ExpressionMap): void {
  const { value, location, isExpression } = exp;
  if (Array.isArray(value)) {
    for (const item of value) {
      addExpressionToMap({ location, value: item, isExpression }, map);
    }
  } else if (isRuntimeJsxElement(value)) {
    addToArrayMap(map, value, exp);
  } else if (isSupportedPrimitive(value)) {
    addToArrayMap(map, value, exp);
  }
}

export function parseComponentNode(node: FiberNode): ComponentInfo {
  return {
    component: node.elementType,
    location: node._debugSource
      ? node._debugSource
      : {
          pos: -1,
          end: -1,
          fileName: 'unknown',
        },
    props: node.pendingProps,
  };
}

function getExpressionComponents(
  children: any,
  expressions: ExpressionLocation[],
  map: ExpressionMap
): ComponentInfo[][] {
  if (!expressions.length) {
    return [];
  }
  if (children) {
    const childrenAsOneExpression = addExpression(children, expressions[0], map);
    if (childrenAsOneExpression.length) {
      return [childrenAsOneExpression];
    }
    if (Array.isArray(children)) {
      let useExpression = 0;
      const res: ComponentInfo[][] = [];
      for (let i = 0; i < children.length; i++) {
        res[i] = [];
        const child = children[i];
        if (!child) {
          continue;
        }
        if (expressions[useExpression]) {
          const expRes = addExpression(child, expressions[useExpression], map);
          if (expRes.length) {
            useExpression++;
          }
          res[i].push(...expRes);
        }
      }
      return res;
    }
  }
  return [];
}
const expressionNode = 'expression-node';
const textNode = 'text-node';
export function addExpression(children: unknown, expression: ExpressionLocation, map: ExpressionMap): ComponentInfo[] {
  if (expression.value === children) {
    const expComp: ComponentInfo = {
      component: expression.isExpression ? expressionNode : textNode,
      location: expression.location,
      props: {value: expression.value},
    };
    if (expression.isExpression) {
      return [...getFromMap(map, children), expComp];
    }
    return [expComp];
  }
  return [];
}

export function getFromMap(map: ExpressionMap, child: unknown): ComponentInfo[] {
  if (Array.isArray(child)) {
    return child.flatMap((c) => getFromMap(map, c));
  }
  if (map.has(child)) {
    const locations = map.get(child)!;
    return [
      ...locations.map((loc) => ({
        component: loc.isExpression ? expressionNode : textNode,
        location: loc.location,
        props: {
          value: child,
        },
      })),
    ];
  }
  return [];
}

export function parseReactTree(
  node: FiberNode,
  parentMap: ExpressionMap = new Map()
): { structure: DomFrameworkStructure; siblings: DomFrameworkStructure[] } {
  const map = new Map(parentMap.entries());
  let res: { structure: DomFrameworkStructure; siblings: DomFrameworkStructure[] } = {
    structure: {
      children: [],
      components: [],
    },
    siblings: [],
  };

  if ((node.stateNode && node.stateNode instanceof Element) || node.stateNode instanceof Text) {
    res.structure = {
      components: [parseComponentNode(node)],
      children: node.child ? parseReactChildren(node.child, map) : [],
      node: node.stateNode,
    };

    const childrenProp = node.pendingProps.children;
    const expressions = getChildExpressions(node);
    if (childrenProp) {
      const childExpressionComponents = getExpressionComponents(childrenProp, expressions, map);
      for (let i = 0; i < childExpressionComponents.length; i++) {
        if (res.structure.children[i]) {
          res.structure.children[i].components.push(...childExpressionComponents[i]);
        } else if (node.stateNode.childNodes[i]) {
          res.structure.children.push({
            children: [],
            components: [...childExpressionComponents[i]],
            node: node.stateNode.childNodes[i] as any,
          });
        }
      }
    }
  } else if (node.child) {
    addExpressionsToMap(node, map);

    res = parseReactTree(node.child, map);
    res.structure.components.push(parseComponentNode(node));
  }
  if (node.sibling) {
    res.siblings.push(...parseReactChildren(node.sibling, parentMap));
  }
  return res;
}

export function parseReactChildren(node: FiberNode, map: ExpressionMap): DomFrameworkStructure[] {
  const res = parseReactTree(node, map);
  return [res.structure, ...res.siblings];
}
