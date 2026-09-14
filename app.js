"use strict";
(() => {
const lessons=window.LESSONS, $=id=>document.getElementById(id), KEY="kotlin-quest-v1";
const empty=()=>({version:1,completed:[],drafts:{},hints:{},current:"welcome"});
function validate(data){
 if(!data||data.version!==1||!Array.isArray(data.completed)||!data.drafts||typeof data.drafts!=="object"||!data.hints||typeof data.hints!=="object")throw Error("Неверный формат копии.");
 const result=empty(),ids=new Set(lessons.map(l=>l.id));
 result.completed=[...new Set(data.completed.filter(id=>ids.has(id)))];
 for(const l of lessons){
  if(typeof data.drafts[l.id]==="string"){if(data.drafts[l.id].length>100000)throw Error("Слишком большой черновик.");result.drafts[l.id]=data.drafts[l.id]}
  if(Number.isInteger(data.hints[l.id]))result.hints[l.id]=Math.max(0,Math.min(3,data.hints[l.id]));
 }
 result.current=ids.has(data.current)?data.current:"welcome";return result;
}
let state=empty(),warning="";
try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw))}
catch{warning="Не удалось прочитать сохранение. Скачивай резервные копии."}
let current=null,instance=null,generation=0,loading=null,consent=false,timer=null,running=false,runCode=null;
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(state));$("draft-status").textContent="Сохранено"}
 catch{$("storage-status").textContent="Браузер не сохраняет данные. Скачай копию перед закрытием.";$("draft-status").textContent="Только в памяти"}
}
function persistEditor(){
 if(!current)return;
 const plain=$("plain-editor");
 if(instance)state.drafts[current.id]=instance.getCode();
 else if(plain)state.drafts[current.id]=plain.value;
 save();
}
function feedback(message,kind=""){$("feedback").textContent=message;$("result").className="result "+kind}
function updateProgress(){
 const xp=lessons.filter(l=>state.completed.includes(l.id)).reduce((s,l)=>s+l.xp,0);
 $("xp").textContent=xp+" XP";$("rank").textContent=xp>=900?"Разработчик":xp>=400?"Практик":"Ученик";
 $("count").textContent=state.completed.length+" / "+lessons.length;$("progress").value=state.completed.length;
 $("lesson-list").replaceChildren();
 lessons.forEach((l,i)=>{
  const a=document.createElement("a");a.href="#"+l.id;a.className="lesson-link"+(state.completed.includes(l.id)?" done":"");
  if(current?.id===l.id)a.setAttribute("aria-current","step");
  const n=document.createElement("span");n.className="num";n.textContent=state.completed.includes(l.id)?"✓":String(i+1).padStart(2,"0");
  const label=document.createElement("span");label.textContent=l.title;
  const small=document.createElement("small");small.textContent=l.topic;label.append(small);a.append(n,label);$("lesson-list").append(a);
 });
}
function tab(name,focus=false){
 for(const key of ["theory","task","resources"]){const active=key===name;$("tab-"+key).setAttribute("aria-selected",String(active));$("tab-"+key).tabIndex=active?0:-1;$("panel-"+key).hidden=!active}
 if(focus)$("tab-"+name).focus();
}
function hints(){
 const n=state.hints[current.id]||0;$("hints").replaceChildren();
 current.hints.slice(0,n).forEach(h=>{const li=document.createElement("li");li.textContent=h;$("hints").append(li)});
 $("hint-count").textContent=n+" / 3";$("hint").disabled=n>=3;$("hint").textContent=n>=3?"Все подсказки открыты":"Открыть подсказку";
}
function plainEditor(source){
 instance=null;$("run").disabled=true;
 const el=document.createElement("textarea");el.id="plain-editor";el.value=source;el.spellcheck=false;el.setAttribute("aria-label","Твоё решение на Kotlin");
 el.addEventListener("input",()=>{state.drafts[current.id]=el.value;save()});$("editor").replaceChildren(el);
}
function loadPlayground(){
 if(window.KotlinPlayground)return Promise.resolve();if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://unpkg.com/kotlin-playground@1";
  const timeout=setTimeout(()=>{script.remove();loading=null;reject(Error("Сервис редактора не ответил."))},20000);
  script.onload=()=>{clearTimeout(timeout);if(window.KotlinPlayground)resolve();else{loading=null;reject(Error("Редактор не загрузился."))}};
  script.onerror=()=>{clearTimeout(timeout);script.remove();loading=null;reject(Error("Не удалось загрузить редактор."))};
  document.head.append(script);
 });return loading;
}
function finish(){clearTimeout(timer);running=false;runCode=null;$("run").disabled=!instance;$("run").textContent="▶ Проверить решение"}
async function mount(){
 const token=generation,l=current;if(!consent)return;
 $("consent-box").hidden=false;$("consent").disabled=true;$("consent").textContent="Загрузка редактора…";
 try{
  await loadPlayground();if(token!==generation)return;persistEditor();
  const code=document.createElement("code");code.id="kotlin-code";code.textContent=state.drafts[l.id]??l.starter;
  for(const [k,v] of Object.entries({"data-target-platform":"junit",theme:"darcula",lines:"true","auto-indent":"true","data-autocomplete":"false","highlight-on-fly":"false"}))code.setAttribute(k,v);
  const dep=document.createElement("textarea");dep.className="hidden-dependency";dep.value=l.testFile;dep.textContent=l.testFile;code.append(dep);$("editor").replaceChildren(code);
  window.KotlinPlayground("#kotlin-code",{
   getInstance(api){if(token!==generation)return;instance=api;$("run").disabled=false},
   onChange(source){if(token!==generation)return;state.drafts[l.id]=source;save()},
   onTestPassed(){
    if(token!==generation)return;
    if(running&&instance&&instance.getCode()!==runCode){finish();feedback("Код изменился во время проверки. Запусти тесты ещё раз.");return}
    finish();const first=!state.completed.includes(l.id);if(first)state.completed.push(l.id);save();updateProgress();
    feedback("Все тесты пройдены. Решение выполняет условия задания.","good");$("success").hidden=false;
    $("success-text").textContent=first?"Получено "+l.xp+" XP. Объясни себе, почему решение работает.":"Повторная проверка успешна. Опыт уже получен.";
   },
   onTestFailed(){if(token!==generation)return;finish();feedback("Проверка не пройдена. Сравни ожидаемый и полученный результат в выводе. Проверь границы и используй подсказку.","bad")}
  });
  $("consent-box").hidden=true;
 }catch(e){
  if(token!==generation)return;plainEditor(state.drafts[l.id]??l.starter);
  feedback(e.message+" Черновик сохранён. Можно продолжать писать и повторить подключение.","bad");$("consent-box").hidden=false;
 }finally{if(token===generation){$("consent").disabled=false;$("consent").textContent="Повторить подключение"}}
}
function render(id){
 persistEditor();generation++;finish();instance=null;
 current=lessons.find(l=>l.id===id)||lessons.find(l=>l.id===state.current)||lessons[0];state.current=current.id;save();
 const index=lessons.indexOf(current);$("world").textContent=current.world;$("topic").textContent=current.topic;
 $("lesson-number").textContent="ЗАДАНИЕ "+String(index+1).padStart(2,"0")+" · ОКОЛО "+current.minutes+" МИН";
 $("lesson-title").textContent=current.title;$("reward").textContent="+"+current.xp+" XP";
 $("theory").replaceChildren();current.theory.forEach(t=>{const p=document.createElement("p");p.textContent=t;$("theory").append(p)});
 $("task").textContent=current.task;$("use").textContent=current.use;
 $("docs").href="https://kotlinlang.org/docs/"+current.doc;$("youtube").href="https://www.youtube.com/results?search_query="+encodeURIComponent("Kotlin "+current.topic+" на русском");
 $("success").hidden=true;$("next").textContent=index===lessons.length-1?"Вернуться к первому заданию":"Следующее задание →";
 feedback(state.completed.includes(current.id)?"Это задание уже пройдено. Можно повторить без дополнительного опыта.":"Прочитай теорию, затем открой задание и напиши своё решение.");
 tab("theory");hints();updateProgress();plainEditor(state.drafts[current.id]??current.starter);
 $("consent-box").hidden=consent;$("sidebar").classList.remove("open");$("menu-toggle").setAttribute("aria-expanded","false");if(consent)mount();
}
$("consent").addEventListener("click",()=>{consent=true;mount()});
$("run").addEventListener("click",()=>{
 if(!instance||running)return;persistEditor();runCode=instance.getCode();running=true;
 $("run").disabled=true;$("run").textContent="Проверяем…";$("success").hidden=true;feedback("Компиляция Kotlin и запуск тестов…");
 const token=generation;
 timer=setTimeout(()=>{if(token!==generation)return;finish();feedback("Проверка не завершилась. Посмотри ошибки компиляции под редактором или проверь соединение. Успех не засчитан.")},45000);
 try{instance.execute()}catch{finish();feedback("Не удалось запустить проверку. Обнови страницу и попробуй ещё раз.","bad")}
});
$("reset").addEventListener("click",()=>{
 if(!confirm("Удалить черновик этого задания? Полученный опыт сохранится."))return;
 const id=current.id;generation++;instance=null;$("editor").replaceChildren();state.drafts[id]=current.starter;save();render(id);
});
$("hint").addEventListener("click",()=>{state.hints[current.id]=Math.min(3,(state.hints[current.id]||0)+1);save();hints()});
$("to-task").addEventListener("click",()=>tab("task",true));
const tabs=["theory","task","resources"];
tabs.forEach((key,index)=>{
 $("tab-"+key).addEventListener("click",()=>tab(key));
 $("tab-"+key).addEventListener("keydown",e=>{
  let next=null;if(e.key==="ArrowRight")next=(index+1)%3;if(e.key==="ArrowLeft")next=(index+2)%3;if(e.key==="Home")next=0;if(e.key==="End")next=2;
  if(next!==null){e.preventDefault();tab(tabs[next],true)}
 });
});
$("next").addEventListener("click",()=>{location.hash=lessons[(lessons.indexOf(current)+1)%lessons.length].id});
$("menu-toggle").addEventListener("click",()=>{const open=$("sidebar").classList.toggle("open");$("menu-toggle").setAttribute("aria-expanded",String(open))});
$("export").addEventListener("click",()=>{
 persistEditor();const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="kotlin-quest-progress.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("import").addEventListener("change",async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>1500000)throw Error("Файл слишком большой.");const imported=validate(JSON.parse(await file.text()));
  if(!confirm("Заменить текущие черновики и прогресс данными из файла?"))return;
  generation++;instance=null;current=null;$("editor").replaceChildren();state=imported;
  history.replaceState(null,"","#"+state.current);render(state.current);$("storage-status").textContent="Копия загружена.";save();
 }catch(error){$("storage-status").textContent="Не удалось загрузить копию: "+error.message}finally{e.target.value=""}
});
window.addEventListener("hashchange",()=>render(location.hash.slice(1)));window.addEventListener("pagehide",persistEditor);
$("storage-status").textContent=warning;render(location.hash.slice(1)||state.current);
})();