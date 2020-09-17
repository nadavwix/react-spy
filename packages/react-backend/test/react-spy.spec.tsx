/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ReactFrameWorkSpy } from '../src/react-spy';
import { setup, getLocationFromText } from '@react-spy/transformer/test-kit/transformer-test-kit';
const rS = new ReactFrameWorkSpy();
import { expect } from 'chai';
import React from 'react';

function withoutExpressions(loc: SourceLocation): SourceLocation {
  return {
    pos: loc.pos,
    end: loc.end,
    fileName: loc.fileName,
    lineNumber: loc.lineNumber,
  };
}

describe('react-spy', () => {
  let root: HTMLElement | undefined;

  beforeEach(() => {
    root = window.document.createElement('div');
    window.document.body.appendChild(root);
  });
  afterEach(() => {
    if (root) {
      window.document.body.removeChild(root);
    }
  });
  const render = async (content: React.ReactElement) => {
    const ReactDOM = await import('react-dom');
    ReactDOM.render(content, root!);
  };

  it('should get last render result', async () => {
    const span = `<span />`;
    const div = `<div>${span}</div>`;
    const { comp, src } = setup(`
                export const comp = ()=>(${div})
        `);
    const Comp = comp;

    await render(<Comp />);
    const struct = rS.getCurrentStructure()!;
    expect(struct.length).to.eql(1);
    expect(struct[0].node).to.equal(root!.firstElementChild);
    expect(struct[0].components[0].location).to.eql(getLocationFromText(src, div));
    expect(struct[0].children[0].components[0].location).to.eql(getLocationFromText(src, span));
  });
  it('should add virtual components for expressions and texts', async () => {
    const exp = `{props.t}`;
    const txt = `title`;
    const div = `<div>${txt}${exp}</div>`;
    const { comp, src } = setup(`
                export const comp = (props)=>(${div})
        `);
    const Comp = comp;

    await render(<Comp t="title" />);
    const struct = rS.getCurrentStructure()!;
    expect(struct.length).to.eql(1);
    expect(struct[0].node).to.equal(root!.firstElementChild);
    expect(withoutExpressions(struct[0].components[0].location)).to.eql(getLocationFromText(src, div));
    expect(struct[0].children[0].components[1].location).to.eql(getLocationFromText(src, txt));
    expect(struct[0].children[1].components[1].location).to.eql(getLocationFromText(src, exp));
  });
  it('static texts and expressions that return text should not mix locations', async () => {
    const exp = `{props.children}`;
    const outerExp = `{props.title}`;
    const txt = `title`;
    const div = `<div>${txt}${exp}</div>`;
    const externalComp = `<InternalComp>${outerExp}</InternalComp>`;
    const { comp, src } = setup(`
                export const InternalComp = (props)=>(${div})
                export const comp = (props)=>(${externalComp})
        `);
    const Comp = comp;

    await render(<Comp title="title" />);
    const struct = rS.getCurrentStructure()!;
    expect(struct.length).to.eql(1);
    expect(struct[0].node).to.equal(root!.firstElementChild);
    expect(withoutExpressions(struct[0].components[0].location)).to.eql(getLocationFromText(src, div));
    expect(withoutExpressions(struct[0].components[1].location)).to.eql(getLocationFromText(src, externalComp));
    expect(struct[0].children[0].components[1].location).to.eql(getLocationFromText(src, txt));
    expect(struct[0].children[1].components[1].location).to.eql(getLocationFromText(src, outerExp));
    expect(struct[0].children[1].components[2].location).to.eql(getLocationFromText(src, exp));
  });
});
