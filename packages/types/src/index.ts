
export interface ComponentInfo {
    component: unknown;
    props: Record<string,unknown>;
    location: SourceLocation;
}

export interface DomFrameworkStructure {
    node?: Element | Text;
    components: ComponentInfo[];
    children: DomFrameworkStructure[];
}

export interface DomComponentStructure {
    components: SourceLocation[];
    children: DomComponentStructure[];
}

export interface FrameWorkSpy {
    getCurrentStructure(): DomFrameworkStructure[] | undefined;
    subscribe(cb: () => void): void;
    unsubscribe(cb: () => void): void;
}
