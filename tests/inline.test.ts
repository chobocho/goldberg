import { describe, expect, it } from 'vitest';
import { CSS_PLACEHOLDER, JS_PLACEHOLDER, inlineHtml } from '../scripts/inline.mjs';

const TEMPLATE = `<!doctype html><html><head>${CSS_PLACEHOLDER}</head><body>${JS_PLACEHOLDER}</body></html>`;

describe('inlineHtml', () => {
  // 정상 케이스
  it('CSS는 <style>, JS는 <script>로 감싸 자리표시자를 치환한다', () => {
    const html = inlineHtml(TEMPLATE, { js: 'console.log(1);', css: 'body{margin:0}' });
    expect(html).toContain('<style>body{margin:0}</style>');
    expect(html).toContain('<script>console.log(1);</script>');
    expect(html).not.toContain(CSS_PLACEHOLDER);
    expect(html).not.toContain(JS_PLACEHOLDER);
  });

  it('한글 문자열을 손상 없이 보존한다', () => {
    const html = inlineHtml(TEMPLATE, { js: 'const t="골드버그 머신";', css: '' });
    expect(html).toContain('골드버그 머신');
  });

  // 엣지 케이스
  it('빈 JS/CSS도 허용한다', () => {
    const html = inlineHtml(TEMPLATE, { js: '', css: '' });
    expect(html).toContain('<style></style>');
    expect(html).toContain('<script></script>');
  });

  it('JS 안의 </script 를 이스케이프해 태그가 조기 종료되지 않게 한다 (대소문자 무관)', () => {
    const html = inlineHtml(TEMPLATE, { js: 'a="</script>";b="</SCRIPT >";', css: '' });
    expect(html).toContain('a="<\\/script>";b="<\\/SCRIPT >";');
    // 닫는 태그는 우리가 넣은 것 하나뿐이어야 한다
    expect(html.match(/<\/script/gi)).toHaveLength(1);
  });

  it('CSS 안의 </style 을 이스케이프한다', () => {
    const html = inlineHtml(TEMPLATE, { js: '', css: 'a::after{content:"</style>"}' });
    expect(html.match(/<\/style/gi)).toHaveLength(1);
  });

  it('String.replace 특수 패턴($&, $\', $`, $$)을 문자 그대로 보존한다', () => {
    const js = "x='$&';y='$\\'';z='$`';w='$$';";
    const html = inlineHtml(TEMPLATE, { js, css: '' });
    expect(html).toContain(`<script>${js}</script>`);
  });

  it('자리표시자가 없으면 예외를 던진다', () => {
    expect(() => inlineHtml(`<html>${JS_PLACEHOLDER}</html>`, { js: '', css: '' })).toThrow(/css/i);
    expect(() => inlineHtml(`<html>${CSS_PLACEHOLDER}</html>`, { js: '', css: '' })).toThrow(/js/i);
  });

  it('자리표시자가 중복되면 예외를 던진다', () => {
    const dup = TEMPLATE + JS_PLACEHOLDER;
    expect(() => inlineHtml(dup, { js: '', css: '' })).toThrow(/js/i);
  });
});
