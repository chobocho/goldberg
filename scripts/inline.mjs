// 단일 HTML 산출물을 만들기 위해 번들된 JS/CSS를 템플릿에 직접 끼워 넣는다.
export const CSS_PLACEHOLDER = '<!--@inline-css-->';
export const JS_PLACEHOLDER = '<!--@inline-js-->';

/**
 * 자리표시자가 정확히 한 번만 있어야 한다. 0회면 산출물에 코드가 빠지고, 2회 이상이면 중복 실행된다.
 * @param {string} template
 * @param {string} placeholder
 * @param {string} label
 */
function assertSinglePlaceholder(template, placeholder, label) {
  const count = template.split(placeholder).length - 1;
  if (count !== 1) {
    throw new Error(`${label} placeholder ${placeholder} must appear exactly once (found ${count})`);
  }
}

/**
 * @param {string} template
 * @param {{ js: string, css: string }} assets
 * @returns {string}
 */
export function inlineHtml(template, assets) {
  assertSinglePlaceholder(template, CSS_PLACEHOLDER, 'CSS');
  assertSinglePlaceholder(template, JS_PLACEHOLDER, 'JS');

  // 인라인 코드 안의 닫는 태그가 HTML 파서를 조기 종료시키지 않도록 '<\/' 로 바꾼다.
  // JS 문자열/정규식 안에서 '\/' 는 '/' 와 동일하게 해석되므로 의미가 바뀌지 않는다.
  const js = assets.js.replace(/<\/(script)/gi, '<\\/$1');
  const css = assets.css.replace(/<\/(style)/gi, '<\\/$1');

  // String.replace 의 $&, $' 같은 특수 패턴이 번들 코드에 섞여 있을 수 있으므로 split/join 으로 치환한다.
  return template
    .split(CSS_PLACEHOLDER).join(`<style>${css}</style>`)
    .split(JS_PLACEHOLDER).join(`<script>${js}</script>`);
}
