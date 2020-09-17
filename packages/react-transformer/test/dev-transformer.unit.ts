/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { expect } from 'chai';
import { getLocationFromText, setup } from '../test-kit/transformer-test-kit';
describe('ReactDevTransformer', () => {
  it('adds __self and __source attributes to jsx elements', () => {
    const span = `<span />`;
    const div = `<div>${span}</div>`;
    const { comp, src } = setup(`
                export const comp = ()=>(${div})
        `);

    const res = comp();
    expect(res._source).to.eql(getLocationFromText(src, div));
    expect(res.props.children._source).to.eql(getLocationFromText(src, span));
  });

  it('adds attributes to jsx elements inside jsx attributes', () => {
    const p = `<p />`;
    const div = `<div icon={${p}}/>`;
    const { comp, src } = setup(`
             export const comp = ()=>(${div})
          `);

    const res = comp();
    expect(res.props.icon._source).to.eql(getLocationFromText(src, p));
  });

  it('does not override existing __source attribute set by user', () => {
    const code = `<div __source="custom value" />`;
    const { comp } = setup(`
      export const comp = ()=>(${code})
   `);
    const res = comp();
    expect(res._source).to.eql('custom value');
  });

  it('does not override existing __self attribute set by user', () => {
    const code = `<div __self="custom value" />`;
    const { comp } = setup(`
          export const comp = ()=>(${code})
       `);
    const res = comp();
    expect(res._self).to.eql('custom value');
  });

  it('wraps expressions, saving their values on parent node', () => {
    const exp = '{props.exp}';
    const exp2 = '{props.exp2}';
    const exp3 = '{props.exp3}';
    const innerdiv = `<div>${exp2}${exp3}</div>`;
    const div = `<div>${exp}${innerdiv}</div>`;
    const { comp, src } = setup(`
                export const comp = (props)=>(${div})
        `);

    const res = comp({ exp: 'hello', exp2: 'goodbye', exp3: 'hello again' });
    expect(res._source).to.eql({
      ...getLocationFromText(src, div),
      expressions: [{ location: getLocationFromText(src, exp), value: 'hello', isExpression: true }],
    });
    expect(res.props.children[1]._source).to.eql({
      ...getLocationFromText(src, innerdiv),
      expressions: [
        { location: getLocationFromText(src, exp2), value: 'goodbye', isExpression: true },
        { location: getLocationFromText(src, exp3), value: 'hello again', isExpression: true },
      ],
    });
  });

  it('wraps non empty text nodes saving them in parent node', () => {
    const text = 'hello world';
    const div = `<div>${text}</div>`;
    const { comp, src } = setup(`
                export const comp = (props)=>(${div})
        `);

    const res = comp();
    expect(res._source).to.eql({
      ...getLocationFromText(src, div),
      expressions: [{ location: getLocationFromText(src, text), value: 'hello world', isExpression: false }],
    });
  });

  //   it('wrap text nodes', () => {
  //     const { outputText, locs } = setup(`(${mark('div')}<div>${mark('text')}Text${mark('text')}</div>${mark('div')})`);

  //     expect(outputText).to.matchCode(`
  //             ${jsxFileNameDef}
  //             ${JsxEditWrapper}
  //             (<div __self={this} ${srcAttribute(locs['div'])}>${editWrapperNode('Text', 'text', locs['text'])}</div>)
  //         `);
  //   });

  //   it('does not wrap expressions inside non native nodes', () => {
  //     const { outputText, locs } = setup(
  //       `(${mark('comp')}<Comp>${mark('exp')}{1+1}${mark('exp')}</Comp>${mark('comp')})`
  //     );

  //     expect(outputText).to.matchCode(`
  //             ${jsxFileNameDef}
  //             (<Comp __self={this} ${srcAttribute(locs['comp'])}>{1+1}</Comp>)
  //         `);
  //   });

  //   it('discards comment nodes instead of wrapping them', () => {
  //     const { outputText, locs } = setup(`(${mark('div')}<div>{/* comment */}</div>${mark('div')})`);

  //     expect(outputText).to.matchCode(`
  //             ${jsxFileNameDef}
  //             (<div __self={this} ${srcAttribute(locs['div'])}></div>)
  //         `);
  //   });
});
