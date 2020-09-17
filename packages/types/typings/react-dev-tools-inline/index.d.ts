/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
declare module 'react-devtools-inline/backend' {
  function initialize(target: any): void;
  function activate(target: any): void;
}
declare module 'react-devtools-inline/frontend' {
  function initialize(target: any): React.Component;
}

type DevToolsEvents = 'operations' | 'traceUpdates' | 'renderer' | 'renderer-attached' | 'react-devtools';

interface FiberRootNode {
  current: FiberNode;
}
interface SourceLocation {
  fileName: string;
  pos: number;
  end: number;
  lineNumber?: number;
}
interface FiberNode {
  alternate?: FiberNode;
  child?: FiberNode;
  sibling?: FiberNode;
  return?: FiberNode;
  elementType: string | null | {};
  stateNode: HTMLElement | {};
  pendingProps: Record<string, any>;
  _debugSource?: SourceLocation;
}

interface ReactRenderer {
  setRefreshHandler(cb: () => void): void;
}

type DevToolsListener<EV extends DevToolsEvents> = (
  params: EV extends keyof EventDataMap ? EventDataMap[EV] : any
) => any;

type EventDataMap = {
  renderer: {
    renderer: ReactRenderer;
    id: number;
  };
};

interface Window {
  __REACT_DEVTOOLS_GLOBAL_HOOK__: {
    on<EV extends DevToolsEvents>(ev: EV, listener: DevToolsListener<EV>): void;
    sub<EV extends DevToolsEvents>(ev: EV, listener: DevToolsListener<EV>): void;
    off<EV extends DevToolsEvents>(ev: EV, listener: DevToolsListener<EV>): void;
    emit(ev: DevToolsEvents, params: any): void;
    getFiberRoots(rendererId: number): Set<FiberRootNode>;
  };
}
