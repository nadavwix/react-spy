/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import ts from 'typescript';
import { createMemoryFs } from '@file-services/memory';
import { createCjsModuleSystem } from '@file-services/commonjs';
import { reactDevTransformer } from '../src/dev-transformer';
import React from 'react';
global.React = React;
const transformers: ts.CustomTransformers = {
  before: [reactDevTransformer],
};
const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.React,
};
const fileName = '/src/test-file.tsx';
export const setup = (src: string) => {
  const { outputText } = ts.transpileModule(src, {
    compilerOptions,
    transformers,
    fileName,
  });
  const fs = createMemoryFs({
    [fileName]: outputText,
  });
  const moduleSys = createCjsModuleSystem({
    fs,
  });
  const { comp } = moduleSys.requireModule(fileName) as { comp: (props?: any) => any };
  return {
    src,
    outputText,
    comp,
  };
};

const getLineNumber = (fullText: string, index: number) => {
  const textTillPoint = fullText.slice(0, index);
  return textTillPoint.split(/\r\n|\n/).length;
};
export const getLocationFromText = (fullText: string, searchedText: string) => {
  const pos = fullText.indexOf(searchedText);
  return {
    pos,
    end: pos + searchedText.length,
    fileName,
    lineNumber: getLineNumber(fullText, pos),
  };
};
