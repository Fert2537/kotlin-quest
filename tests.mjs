import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const window = {};
new Function('window', await readFile(new URL('./lessons.js', import.meta.url),'utf8'))(window);
const app = await readFile(new URL('./app.js', import.meta.url),'utf8');
new Function(app);
const html = await readFile(new URL('./index.html', import.meta.url),'utf8');
assert.equal(new Set(window.LESSONS.map(l=>l.id)).size,window.LESSONS.length);
for(const lesson of window.LESSONS){assert.equal(lesson.hints.length,3);assert.ok(lesson.testFile.includes('@Test'));assert.ok(lesson.theory.length>=3)}
async function exercise(app, lessons, html) {
const elements=new Map(), events={}, data=new Map(), report=[];
class El {
 constructor(tag="div"){this.tag=tag;this.children=[];this.listeners={};this.hidden=false;this.value="";this.attributes={};this.classList={add(){},remove(){},toggle(){return true}}}
 set id(v){this._id=v;elements.set(v,this)} get id(){return this._id}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){const remove=n=>{if(n.id && elements.get(n.id)===n)elements.delete(n.id);n.children.forEach(remove)};this.children.forEach(remove);this.children=[];this.append(...nodes)}
 setAttribute(k,v){this.attributes[k]=v}
 addEventListener(k,fn){this.listeners[k]=fn}
 focus(){} remove(){} click(){return this.listeners.click?.({})}
}
for(const m of html.matchAll(/id="([^"]+)"/g)){const el=new El();el.id=m[1]}
const document={getElementById:id=>elements.get(id),createElement:tag=>new El(tag),head:new El()};
let options,api,code="";
const window={LESSONS:lessons,addEventListener:(name,fn)=>events[name]=fn,
 KotlinPlayground(selector,opts){code=elements.get("kotlin-code").textContent;options=opts;api={getCode:()=>code,execute(){}};opts.getInstance(api)}
};
const location={hash:""},localStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
new Function("window","document","localStorage","location","history","confirm","setTimeout","clearTimeout","URL","Blob",app)(window,document,localStorage,location,{replaceState(){}},()=>true,()=>1,()=>{}, {},function(){});
const assert=(test,label)=>{if(!test)throw Error(label);report.push(label)};
assert(elements.get("lesson-title").textContent===lessons[0].title,"Initial lesson");
let plain=elements.get("plain-editor");plain.value="// draft";plain.listeners.input();
location.hash="#bill";events.hashchange();
location.hash="#welcome";events.hashchange();
assert(elements.get("plain-editor").value==="// draft","Draft survives lesson changes");
elements.get("tab-task").click();assert(elements.get("panel-theory").hidden&&!elements.get("panel-task").hidden,"Tabs switch");
for(let i=0;i<4;i++)elements.get("hint").click();
assert(elements.get("hint-count").textContent==="3 / 3","Hints bounded");
elements.get("reset").click();assert(elements.get("plain-editor").value===lessons[0].starter,"Reset draft");
elements.get("consent").click();await Promise.resolve();await Promise.resolve();
assert(!elements.get("run").disabled,"Playground ready");
code="val hotelName = \"Север\"";elements.get("run").click();options.onTestFailed();
assert(elements.get("xp").textContent==="0 XP","Failure awards no XP");
elements.get("run").click();options.onTestPassed();
assert(elements.get("xp").textContent==="40 XP","Success awards XP");
elements.get("run").click();options.onTestPassed();
assert(elements.get("xp").textContent==="40 XP","Repeat awards no extra XP");
const previous=options;location.hash="#bill";events.hashchange();await Promise.resolve();await Promise.resolve();
previous.onTestPassed();assert(elements.get("xp").textContent==="40 XP","Stale lesson callback ignored");
code="before";elements.get("run").click();code="after";options.onTestPassed();
assert(elements.get("xp").textContent==="40 XP","Changed submission not awarded");
assert(JSON.parse(data.get("kotlin-quest-v1")).completed.length===1,"Progress persisted");
return report;
}
console.log(await exercise(app,window.LESSONS,html));
