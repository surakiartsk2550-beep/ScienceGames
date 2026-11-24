import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
test('index uses classic deferred scripts, in dependency order, without ES modules',()=>{
  const scripts=[...html.matchAll(/<script\b([^>]*)src="([^"]+)"([^>]*)>/g)];
  assert.deepEqual(scripts.map(s=>s[2]),['game.js','questions.js','app.js']);
  for(const s of scripts){assert.match(s[1]+s[3],/\bdefer\b/);assert.doesNotMatch(s[0],/type="module"/);}
  for(const file of ['game.js','questions.js','app.js'])assert.doesNotMatch(readFileSync(new URL(file,root),'utf8'),/^\s*(import|export)\s/m);
});
test('every local HTML and CSS resource exists, and dynamic gameplay images are bundled',()=>{
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const ref=match[1];if(/^(https?:|data:|#)/.test(ref))continue;
    assert.ok(!ref.startsWith('/'),'Use relative paths for project GitHub Pages');
    assert.ok(existsSync(new URL(ref,root)),ref);
  }
  const css=readFileSync(new URL('styles.css',root),'utf8');
  for(const match of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g))if(!match[1].startsWith('data:'))assert.ok(existsSync(new URL(match[1],root)),match[1]);
  for(const image of ['board-open.png','board-closed.png','question.png','characters.png'])assert.ok(existsSync(new URL('assets/'+image,root)));
});
test('both offline fonts are embedded exactly, avoiding file-origin font requests',()=>{
  const css=readFileSync(new URL('styles.css',root),'utf8');
  const fonts=[...css.matchAll(/data:font\/ttf;base64,([A-Za-z0-9+/=]+)/g)].map(m=>Buffer.from(m[1],'base64'));
  assert.equal(fonts.length,2);
  for(const [i,name]of ['Nunito.ttf','NotoSansThai.ttf'].entries())assert.ok(fonts[i].equals(readFileSync(new URL('assets/'+name,root))));
});
