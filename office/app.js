import { createOfficeScene } from './scene.js';
import { personalities, summarizeBrief } from './life.js';

const $ = id => document.getElementById(id);
const icons = {
  floor: '<path d="m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
  history: '<path d="M4 7a8.5 8.5 0 1 1-1 8 M4 3v5h5 M12 7v6l3 2"/>',
  plus: '<path d="M5 12h14 M12 5v14"/>',
  chat: '<path d="M4 4h16v12H9l-5 4z M8 8h8 M8 12h5"/>',
  compose: '<path d="M13 4H5v15h15v-8 M11 13l1-4 7-7 3 3-7 7z"/>',
  chev: '<path d="m7 10 5 5 5-5"/>', send: '<path d="m3 11 17-8-5 18-4-7z M11 14l9-11"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14a5 5 0 0 1 3 5"/>',
  pointer: '<path d="m4 3 5 16 3-6 6-3z"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6 M12 7h.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5"/>',
  moon: '<path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z"/>'
};
const iconMarkup = name => '<svg viewBox="0 0 24 24">' + icons[name] + '</svg>';
for (const icon of document.querySelectorAll('[data-icon]')) {
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconMarkup(icon.dataset.icon);
}
function el(tag, className, value) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value != null) item.textContent = value;
  return item;
}
function pixelArt(canvas, rows, palette) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  rows.forEach((row,y) => [...row].forEach((p,x) => {
    if (palette[p]) { ctx.fillStyle = palette[p]; ctx.fillRect(x,y,1,1); }
  }));
}
pixelArt($('brand-goose'), [
  '................','.......KKKK.....','......KWWWKK....','......KWWWKWK...','......KWWKYYK...','......KWWKYY....','......KWWK......','...KKKKWWK......','..KWWWWWWK......','.KWWWWWWWWK.....','..KWWWSSWWK.....','...KSSWWWK......','....KKKKK.......','.....Y.Y........','....YY.YY.......'
], {K:'#354433',W:'#fff7da',S:'#c5c6a7',Y:'#d69246'});
const statusNames = {idle:'待命',unknown:'未連線',unavailable:'待登入',queued:'排隊中',planning:'規劃中',working:'處理中',delegated:'已分派',reviewing:'審閱中',done:'已完成',failed:'失敗'};
const active = new Set(['planning','working','delegated','reviewing']);
const identities = [
  {id:'claude',manager:'claude',name:'Claude',role:'主管',kind:'manager'},
  {id:'claude-research',manager:'claude',name:'Mira',role:'研究員',kind:'worker'},
  {id:'claude-review',manager:'claude',name:'Theo',role:'審閱員',kind:'worker'},
  {id:'codex',manager:'codex',name:'Codex',role:'主管',kind:'manager'},
  {id:'codex-build',manager:'codex',name:'Finn',role:'工程師',kind:'worker'},
  {id:'codex-test',manager:'codex',name:'Nova',role:'測試員',kind:'worker'}
];
const state = {tasks:[],messages:[],employees:[],activities:[],drafts:[],slackThreads:[],backend:{ready:false},modelCatalog:null};
let transport = 'loading', received = false, view = 'floor', source = 'office', choice = 'both', targetTouched = false;
let selected = '', threadId = '', slackId = '', sending = false, scene, previousChat = '', previousTeams = '', previousList = '', previousScene = '';
let lastSequence = 0, issuedSequence = 0;
const chatBox = $('chat-body'), field = $('message'), newChatMarkup = chatBox.innerHTML;
const titleFor = key => ({claude:'Claude',codex:'Codex',both:'兩位主管'}[key] || key);
const targetsFor = target => target==='both' ? ['claude','codex'] : [target];
const teamReady = id => state.backend.managers?.[id] ?? state.backend.ready;
const targetReady = target => state.backend.ready===true && targetsFor(target).every(teamReady);
const defaultTarget = () => targetReady('both')?'both':['claude','codex'].find(targetReady)||'both';
const workers = () => state.employees.length ? state.employees.map(person =>
  person.status==='idle' && !teamReady(person.manager) ? {...person,status:'unavailable'} : person
) : identities.map(e=>({...e,status:'unknown'}));
const readable = value => statusNames[value] || value || '待命';
function when(value, date = false) {
  const stamp = new Date(value);
  return Number.isNaN(+stamp) ? '' : stamp.toLocaleString('zh-TW',date ? {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false} : {hour:'2-digit',minute:'2-digit',hour12:false});
}
function getStore(key) { try {return JSON.parse(localStorage.getItem('goose-office:' + key));} catch{return null;} }
function putStore(key, value) { try {if(value == null) localStorage.removeItem('goose-office:'+key); else localStorage.setItem('goose-office:'+key,JSON.stringify(value));} catch { /* Storage can be disabled. */ } }
let lifeEnabled = getStore('office-life') !== false;
let lifeFrame = null;
const savedModels = {...getStore('models')};
const effortLabels = {none:'關閉',low:'低',medium:'中',high:'高',xhigh:'極高',max:'最高'};
let previousModelMenu = '';
const themeToggle = $('theme-toggle');
const themeIcon = themeToggle.querySelector('[data-icon]');
const themeColor = document.querySelector('meta[name="theme-color"]');
function setTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.title = light ? '切換至深色模式' : '切換至亮色模式';
  themeIcon.dataset.icon = light ? 'moon' : 'sun';
  themeIcon.innerHTML = iconMarkup(themeIcon.dataset.icon);
  themeColor.content = light ? '#f8fbf7' : '#11191e';
}
setTheme(getStore('theme'));
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  setTheme(theme);
  putStore('theme', theme);
});
const draftKey = () => 'draft:' + (threadId || 'new');
function saveDraft() { if(!slackId) putStore(draftKey(),field.value ? {text:field.value,choice} : null); }
function restoreDraft() {
  const stored = getStore(draftKey());
  field.value = typeof stored?.text === 'string' ? stored.text : '';
  if (['claude','codex','both'].includes(stored?.choice)) choice = stored.choice;
}
function teamOf(id) {return id === 'codex' || id?.startsWith('codex-') ? 'codex' : 'claude';}
function avatar(id) {
  const team = teamOf(id), span = el('span','avatar ' + team);
  span.setAttribute('aria-hidden','true');
  const canvas = document.createElement('canvas'); canvas.width=14;canvas.height=14;
  const palette = {h:team==='claude'?'#a85e43':'#273b4c',H:team==='claude'?'#d68a58':'#536c77',s:'#efbc95',S:'#d39979',e:'#354049',j:team==='claude'?'#c37c56':'#668db7',J:team==='claude'?'#e6a875':'#9bbbd3',w:'#f5e4ca',g:'#283b49'};
  if(id==='user'){palette.h='#5d5344';palette.j='#8baf77';palette.J='#c5d798';}
  const rows = team==='codex' && id!=='user' ? [
    '..............','....hhhhh.....','...hHHHHhh....','..hHHhhHHhh...','..hhhhssshh...','..hsssssssh...','..sgeeggees...','..sgeeSSges...','...sssssss....','....sSSss.....','...jjssjjj....','..jjJwwJjjj...','.jjjjJJjjjjj..','.jjjjjjjjjjj..'
  ]:[
    '..............','.....HHhh.....','...hHHhHHh....','..hhHhHhhHh...','..hHhsshhHh...','..hhssssssh...','..ssessesss...','..sssSSsss....','...sssssss....','....sSSss.....','...jjssjjj....','..jjJwwJjjj...','.jjjjJJjjjjj..','.jjjjjjjjjjj..'
  ];
  pixelArt(canvas,rows,palette); span.append(canvas); return span;
}
function statusNode(value) {
  return el('span','status '+(active.has(value)?'busy':value==='failed'?'problem':''),readable(value));
}
function routineLabel(frame) {
  if (frame.phase==='back') return '回座位';
  if (frame.kind==='recap') return '聊聊剛結束的交辦';
  if (frame.kind==='social') return frame.phase==='out'?'走向休息角':'在休息角聊天';
  return frame.phase==='out'?'起身走動':frame.action;
}
function renderPersonality(staff = workers()) {
  const person=staff.find(member=>member.id===selected);
  const personality=person&&personalities[person.id];
  $('member-profile').hidden=!personality;
  if(!personality)return;
  $('profile-name').textContent=person.name;
  $('profile-trait').textContent=personality.trait;
  $('profile-bio').textContent=personality.bio;
  const isParticipant=lifeFrame?.actors.includes(person.id);
  $('profile-routine').textContent=isParticipant?'日常 · '+routineLabel(lifeFrame):
    '常做的事 · '+personality.habits.map(habit=>habit.action).join('、');
}
function positionOfficeDialogue(speech) {
  if(!speech)return;
  const bubble=$('office-dialogue');
  const room=bubble.parentElement;
  const width=room.clientWidth, height=room.clientHeight;
  if(!width||!height)return;
  const x=width*speech.x, y=height*speech.y;
  const headY=y-.13*height;
  const left=Math.max(6,Math.min(width-bubble.offsetWidth-6,x-bubble.offsetWidth/2));
  const above=headY-bubble.offsetHeight-7;
  const below=above<6;
  const top=Math.max(6,Math.min(height-bubble.offsetHeight-6,below?y+7:above));
  bubble.dataset.edge=below?'below':'above';
  bubble.style.left=left+'px';
  bubble.style.top=top+'px';
  bubble.style.setProperty('--tail-x',Math.max(10,Math.min(bubble.offsetWidth-12,x-left))+'px');
}
function renderOfficeLife(frame) {
  lifeFrame=frame;
  const bubble=$('office-dialogue');
  const speech=frame?.speech;
  bubble.hidden=!speech;
  if(speech){
    const actor=workers().find(person=>person.id===speech.actor);
    bubble.dataset.team=actor?.manager||'claude';
    $('dialogue-speaker').textContent=actor?.name||'';
    $('dialogue-text').textContent=speech.text;
    const recap=$('dialogue-thread');
    recap.hidden=!speech.threadId;
    recap.onclick=speech.threadId?()=>openThread(speech.threadId):null;
    positionOfficeDialogue(speech);
  }
  renderPersonality();
}
function renderLifeToggle() {
  const button=$('office-life-toggle');
  button.setAttribute('aria-pressed',String(lifeEnabled));
  button.title=lifeEnabled?'暫停辦公室日常動畫':'恢復辦公室日常動畫';
}
function renderTeams() {
  const staff = workers(), sig=JSON.stringify([staff,selected]);
  if(sig!==previousTeams){
    previousTeams=sig;
    const cards = ['claude','codex'].map(id=>{
      const manager=staff.find(person=>person.id===id);
      const card=el('article','team-card '+id);
      if(!manager)return card;
      const lead=el('button','manager'+(selected===id?' chosen':''));lead.dataset.employee=id;
      lead.setAttribute('aria-pressed',String(selected===id));
      const name=el('span','manager-name');name.append(el('strong','',manager.name),el('em','','主管'));
      lead.title=personalities[id].trait;
      lead.append(avatar(id),name,statusNode(manager.status));card.append(lead);
      const list=el('div','worker-list');
      staff.filter(p=>p.manager===id && p.id!==id).forEach(person=>{
        const b=el('button','worker'+(selected===person.id?' chosen':''));
        b.dataset.employee=person.id;b.title=[person.name,person.role,personalities[person.id]?.trait,readable(person.status)].filter(Boolean).join(' · ');
        b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(selected===person.id));
        b.append(el('i','worker-dot'+(active.has(person.status)?' busy':'')),el('span','',person.name),el('span','worker-role',person.role));list.append(b);
      });
      card.append(list);return card;
    });
    $('teams').replaceChildren(...cards);
    $('team-count').textContent=staff.filter(person=>person.kind==='manager').length+' 位主管 · '+staff.filter(person=>person.kind==='worker').length+' 位員工';
  }
  const person=staff.find(p=>p.id===selected);
  $('selection-hint').textContent=person ? person.name+' · '+(person.kind==='manager'?'主管':titleFor(person.manager)+' 組 / '+person.role)+' · '+readable(person.status) : '點選角色查看成員';
  renderPersonality(staff);
  const data={agents:staff,selected,lifeEnabled,tasks:state.tasks.map(({threadId,manager,workerId,status,createdAt,updatedAt,text})=>
    ({threadId,manager,workerId,status,createdAt,updatedAt,brief:summarizeBrief(text)}))};
  const sceneKey=JSON.stringify(data);
  if(scene && previousScene!==sceneKey){
    if(scene.update)scene.update(data);else scene.setState({...data,selectedId:selected});
    previousScene=sceneKey;
  }
}
function groupedThreads() {
  const threads=new Map();
  for(const task of state.tasks){
    let group=threads.get(task.threadId);
    if(!group){group={id:task.threadId,tasks:[],updatedAt:'',text:'',managers:[]};threads.set(group.id,group);}
    group.tasks.push(task);
    if(task.updatedAt>group.updatedAt) group.updatedAt=task.updatedAt;
    if(!group.managers.includes(task.manager))group.managers.push(task.manager);
  }
  for(const group of threads.values()){
    group.tasks.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    group.text=group.tasks[0].text;
    const latest=new Map(group.tasks.map(task=>[task.manager,task]));
    const states=Array.from(latest.values(),t=>t.status);
    group.status=states.find(s=>active.has(s))??states.find(s=>s==='queued')??states.find(s=>s==='failed')??'done';
  }
  return [...threads.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
function renderList() {
  if(view!=='history')return;
  const query=$('search').value.toLowerCase().trim(),filter=$('hist-filter').value;
  $('hist-filter').hidden=source==='slack';
  document.querySelectorAll('[data-source]').forEach(b=>{b.classList.toggle('on',b.dataset.source===source);b.setAttribute('aria-pressed',b.dataset.source===source);});
  let rows=source==='slack' ? [...state.slackThreads].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))) : groupedThreads();
  rows=rows.filter(row=>{
    const matched=!query||String(row.text||'').toLowerCase().includes(query)||(row.messages||state.messages.filter(m=>m.threadId===row.id)).some(m=>m.text.toLowerCase().includes(query));
    return matched && (source==='slack'||filter==='all'||(filter==='active'?(active.has(row.status)||row.status==='queued'):row.status===filter));
  });
  const sig=JSON.stringify([source,rows,threadId,slackId,query,filter,transport]);if(sig===previousList)return;previousList=sig;
  if(!rows.length){$('threads').replaceChildren(el('p','history-empty',transport==='loading'?'正在讀取紀錄…':query||filter!=='all'&&source!=='slack'?'沒有符合條件的任務':source==='slack'?'尚無同步的 Slack 對話':'尚無網頁交辦紀錄'));return;}
  $('threads').replaceChildren(...rows.map(row=>{
    const isSlack=source==='slack', b=el('button','thread-row'+((isSlack?slackId:threadId)===row.id?' on':''));
    b.dataset.thread=row.id;
    const name=el('span','thread-text');
    name.append(el('strong','',row.text||row.messages?.[0]?.text||'Slack 對話'),el('small','',(isSlack?'Slack':row.managers.map(titleFor).join('、'))+' · '+when(row.updatedAt,true)));
    b.append(name,isSlack?el('span','meta','唯讀'):statusNode(row.status));return b;
  }));
}
function effortOptions(manager, model) {
  const catalog=state.modelCatalog?.[manager];
  return catalog?.models.find(item=>item.id===model)?.efforts ?? catalog?.defaultEfforts ?? [];
}
function modelSelection(manager) {
  const catalog=state.modelCatalog?.[manager];
  const saved=savedModels[manager];
  const model=catalog?.models.some(item=>item.id===saved?.model)?saved.model:'';
  const effort=effortOptions(manager,model).includes(saved?.effort)?saved.effort:'';
  return {model,effort};
}
function modelOption(value,label) {
  const option=el('option','',label);
  option.value=value;
  return option;
}
function createEffortSlider(manager) {
  const wrapper=el('span','effort-control');
  const track=el('span','effort-track');
  const scale=el('span','effort-scale');
  const label=el('span','effort-value');
  scale.setAttribute('aria-hidden','true');
  label.setAttribute('aria-hidden','true');
  const input=el('input','effort-slider');
  input.type='range';
  input.min='0';
  input.step='1';
  input.setAttribute('aria-label',titleFor(manager)+' 推理強度');
  track.append(scale,input);
  wrapper.append(track,label);

  let choices=[];
  function update() {
    const index=input.valueAsNumber;
    const effort=choices[index];
    const text=effort ? effortLabels[effort] ?? effort : '預設';
    label.textContent=text;
    input.setAttribute('aria-valuetext',text);
    const progress=100*index/Math.max(1,choices.length-1);
    scale.style.setProperty('--effort-progress',`${progress}%`);
    return effort;
  }
  function fill(model, effort) {
    choices=['',...effortOptions(manager,model)];
    input.max=String(choices.length-1);
    input.value=String(Math.max(0,choices.indexOf(effort)));
    scale.replaceChildren(...choices.map(()=>el('span','effort-tick')));
    return update();
  }
  return {wrapper,input,fill,update};
}
function renderModelSettings() {
  const container=$('model-settings');
  const catalog=state.modelCatalog;
  container.hidden=!!slackId||!catalog;
  if(container.hidden)return;
  const targets=targetsFor(choice);
  const key=JSON.stringify(targets.map(manager=>[manager,catalog[manager]]));
  if(key!==previousModelMenu) {
    previousModelMenu=key;
    const header=el('div','model-row model-head');
    header.setAttribute('aria-hidden','true');
    header.append(el('span'),el('span','','模型'),el('span','','Effort'));
    const rows=targets.filter(manager=>catalog[manager]).map(manager=>{
      const row=el('div','model-row');
      row.dataset.modelManager=manager;
      const info=catalog[manager];
      const selection=modelSelection(manager);
      const model=el('select');
      model.setAttribute('aria-label',titleFor(manager)+' 模型');
      model.append(modelOption('','預設 · '+info.defaultLabel),...info.models.map(item=>modelOption(item.id,item.label)));
      model.value=selection.model;
      const effort=createEffortSlider(manager);
      effort.fill(selection.model,selection.effort);
      function save(effortValue) {
        savedModels[manager]={model:model.value,effort:effortValue};
        putStore('models',savedModels);
      }
      model.onchange=()=>{
        save(effort.fill(model.value,savedModels[manager]?.effort));
        effort.input.disabled=effort.input.max==='0';
      };
      effort.input.oninput=()=>save(effort.update());
      const portrait=el('span','model-manager');
      portrait.title=titleFor(manager);
      portrait.setAttribute('role','img');
      portrait.setAttribute('aria-label',portrait.title);
      portrait.append(avatar(manager));
      const modelWrap=el('span','model-select');
      modelWrap.append(model);
      row.append(portrait,modelWrap,effort.wrapper);
      return row;
    });
    container.replaceChildren(header,...rows);
  }
  for(const row of container.querySelectorAll('[data-model-manager]')) {
    const model=row.querySelector('select');
    const effort=row.querySelector('.effort-slider');
    model.disabled=sending;
    effort.disabled=sending||effort.max==='0';
  }
}
function renderControls(){
  document.querySelectorAll('[data-target]').forEach(b=>{
    const target=b.dataset.target;
    b.classList.toggle('on',target===choice);
    b.setAttribute('aria-pressed',target===choice);
    b.disabled=!!slackId||sending;
  });
  const unavailable=targetsFor(choice).filter(id=>!teamReady(id)).map(titleFor);
  const readinessNote=!slackId&&transport==='ok'&&unavailable.length
    ? unavailable.join('、')+' 尚未就緒。請展開右上角的連線狀態查看設定。' : '';
  const targetStatus=$('target-status');
  if(targetStatus.textContent!==readinessNote)targetStatus.textContent=readinessNote;
  targetStatus.hidden=!readinessNote;
  $('chat-new').disabled=sending;$('history-new').disabled=sending;
  $('chat-heading').textContent=slackId?'Slack 對話紀錄':threadId?'任務對話':'任務交辦台';
  document.querySelector('.recipients').hidden=!!slackId;
  $('composer').hidden=!!slackId;$('execution-help').hidden=!!slackId;
  renderModelSettings();
  field.placeholder=(threadId?'追問':'交辦給')+titleFor(choice)+'…';
  $('send').disabled=!field.value.trim()||sending||transport!=='ok'||!targetReady(choice);
  const sendHint=sending?'正在送出':transport!=='ok'?'等待本機服務連線':readinessNote||'送出任務';
  $('send').title=sendHint;field.readOnly=sending;
  $('send').querySelector('span').textContent=sending?'送出中':'送出';
}
const markdown = window.markdownit?.({ html: false, breaks: true });
const previewTypes = {
  png:'img',jpg:'img',jpeg:'img',gif:'img',webp:'img',
  mp4:'video',webm:'video',mp3:'audio',wav:'audio',ogg:'audio'
};
function officeFile(reference, taskId) {
  if (!taskId || !reference?.startsWith('office-file:')) return null;
  let name;
  try { name = decodeURIComponent(reference.slice('office-file:'.length)); }
  catch { return null; }
  if(!name || name.startsWith('.') || /[\\/:*?"<>|]/.test(name)) return null;
  return { name, url: '/api/tasks/'+encodeURIComponent(taskId)+'/files/'+encodeURIComponent(name),
    type: previewTypes[name.split('.').at(-1).toLowerCase()] };
}
function externalLink(link) {
  link.target='_blank';
  link.rel='noopener noreferrer';
}
function messageText(content, text, {taskId, raw = false, preview = false} = {}) {
  if (!markdown || raw) {
    content.append(el('p','plain-reply',text));
    return;
  }
  const block=el('div','markdown');
  block.innerHTML=markdown.render(text || '');
  const files=new Map();
  for (const node of block.querySelectorAll('a, img')) {
    const isImage=node.tagName==='IMG';
    const ref=node.getAttribute(isImage?'src':'href');
    const file=officeFile(ref,taskId);
    if (file && !preview) {
      const link=isImage?el('a','',node.alt||file.name):node;
      link.href=file.url+'?download=1';
      if(isImage)node.replaceWith(link);
      files.set(file.url,file);
    } else if (ref?.startsWith('office-file:')) {
      node.replaceWith(document.createTextNode(isImage?node.alt:node.textContent));
    } else if (isImage) {
      const link=el('a','',node.alt||'開啟圖片');
      if(/^https?:\/\//i.test(ref||'')){link.href=ref;externalLink(link);}
      node.replaceWith(link.href?link:document.createTextNode(link.textContent));
    } else if (/^https?:\/\//i.test(ref||'')) {
      externalLink(node);
    }
  }
  content.append(block);
  for (const file of files.values()) {
    if(!Object.hasOwn(previewTypes,file.name.split('.').at(-1).toLowerCase()))continue;
    const media=el(file.type,'reply-media');
    media.src=file.url;
    if(file.type==='img'){media.alt=file.name;media.loading='lazy';}
    else {media.controls=true;media.preload='metadata';media.setAttribute('aria-label',file.name);}
    content.append(media);
  }
}
const activityKinds={stage:'',command:'執行指令',file:'檔案操作',web:'瀏覽網頁',screenshot:'截圖',video:'處理影片',task:'執行子任務',tool:'使用工具'};
const activityStates={running:'進行中',done:'完成',failed:'失敗',unconfirmed:'未回報結果'};
const expandedActivities=new Map();
function activityAge(start,end) {
  const elapsed=Math.max(0,Math.floor(((end?Date.parse(end):Date.now())-Date.parse(start))/1000));
  if(!Number.isFinite(elapsed))return '';
  return elapsed<60?elapsed+' 秒':Math.floor(elapsed/60)+' 分 '+elapsed%60+' 秒';
}
function refreshTimers() {
  for(const timer of chatBox.querySelectorAll('[data-active-since]'))timer.textContent=activityAge(timer.dataset.activeSince);
}
function renderActivity(task,rows,staff) {
  const open=active.has(task.status)||task.status==='queued';
  const details=el('details','activity-group');
  details.open=expandedActivities.get(task.id) ?? open;
  const headline=el('summary');
  const running=rows.filter(row=>row.status==='running');
  const latest=running.at(-1) || rows.at(-1);
  const actor=staff.find(p=>p.id===latest?.actor)?.name || titleFor(task.manager);
  const current=open?(latest?(activityKinds[latest.kind] || latest.label):readable(task.status)):'工作紀錄';
  headline.append(el('span','activity-indicator '+(open?'running':'')),el('strong','',actor),el('span','activity-current',current));
  if(rows.length) {
    const timer=el('time','',activityAge(rows[0].startedAt,open?null:task.updatedAt));
    if(open)timer.dataset.activeSince=rows[0].startedAt;
    headline.append(timer);
  }
  headline.onclick=()=>expandedActivities.set(task.id,!details.open);
  details.append(headline);
  const list=el('ol','activity-list');
  for(const row of rows) {
    const item=el('li','activity-item');
    const label=activityKinds[row.kind]?activityKinds[row.kind]+' · '+row.label:row.label;
    const name=staff.find(p=>p.id===row.actor)?.name||row.actor;
    const heading=el('div','activity-line');
    const badge=el('span','activity-state',activityStates[row.status]||row.status);
    badge.dataset.status=row.status;
    heading.append(el('span','',name+' · '+label),badge);
    item.append(heading);
    if(row.detail)item.append(el(row.kind==='command'?'code':'span','activity-detail',row.detail));
    if(row.note)item.append(el('span','activity-note',row.note));
    list.append(item);
  }
  if(!rows.length)list.append(el('li','activity-item','等候主管接手。'));
  details.append(list);
  return details;
}
function renderMessage(message, staff) {
  if(message.author==='system'){
    const notice=el('div','system-msg',message.text);
    notice.append(el('time','',when(message.createdAt)));
    return notice;
  }
  const author=staff.find(p=>p.id===message.author);
  const row=el('div','msg'),body=el('div','msg-content'),head=el('header');
  head.append(el('b','',message.author==='user'?'你':author?.name||message.author),
    message.preview?el('span','writing-label','撰寫中'):el('time','',when(message.createdAt)));
  body.append(head);
  messageText(body,message.text,{taskId:message.taskId,raw:message.author==='user',preview:message.preview});
  row.append(avatar(message.author),body);
  if(message.preview)row.setAttribute('aria-live','off');
  return row;
}
function renderChat(force=false) {
  const item=slackId?state.slackThreads.find(s=>s.id===slackId):null;
  const relevant=slackId?(item?.messages||[]):threadId?state.messages.filter(m=>m.threadId===threadId):[];
  const taskGroup=slackId?[]:state.tasks.filter(t=>t.threadId===threadId).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  const taskIds=new Set(taskGroup.map(task=>task.id));
  const histories=new Map();
  for(const event of state.activities){
    if(!taskIds.has(event.taskId))continue;
    if(!histories.has(event.taskId))histories.set(event.taskId,[]);
    histories.get(event.taskId).push(event);
  }
  const drafts=state.drafts.filter(draft=>taskIds.has(draft.taskId));
  const sig=JSON.stringify([slackId,threadId,relevant,taskGroup,[...histories],drafts]);
  refreshTimers();
  if(!force&&sig===previousChat)return;previousChat=sig;
  const nearEnd=chatBox.scrollHeight-chatBox.scrollTop-chatBox.clientHeight<90;
  if(!slackId&&!threadId){chatBox.innerHTML=newChatMarkup;return;}
  const messages=el('div','messages');
  if(slackId)messages.append(el('p','system-msg','從本機 Slack 紀錄同步 · 唯讀'));
  const staff=workers();
  const timeline=relevant.map(message=>({at:message.createdAt, node:()=>renderMessage(message,staff)}));
  for(const task of taskGroup) {
    const rows=histories.get(task.id)||[];
    if(rows.length||active.has(task.status)||task.status==='queued') {
      timeline.push({at:rows[0]?.startedAt||task.createdAt,node:()=>renderActivity(task,rows,staff)});
    }
  }
  for(const draft of drafts)timeline.push({at:draft.startedAt,node:()=>renderMessage({
    author:draft.actor,text:draft.text,createdAt:draft.startedAt,preview:true
  },staff)});
  for(const entry of timeline.sort((a,b)=>String(a.at).localeCompare(String(b.at))))messages.append(entry.node());
  const nodes=[];
  if(taskGroup.length){
    const summary=el('div','thread-summary');
    for(const task of new Map(taskGroup.map(t=>[t.manager,t])).values()){
      const status=el('span','',titleFor(task.manager)+' · '+readable(task.status));
      if(task.model)status.title=task.model+(task.effort?' · Effort '+(effortLabels[task.effort]||task.effort):'');
      summary.append(status);
    }
    nodes.push(summary);
  }
  if(!timeline.length)messages.append(el('p','meta',slackId?'此對話暫無訊息。':'正在載入對話…'));
  nodes.push(messages); chatBox.replaceChildren(...nodes);
  if(force||nearEnd)chatBox.scrollTop=chatBox.scrollHeight;
}
function showView(next) {
  view=next;
  $('floor-view').hidden=next!=='floor';$('history-view').hidden=next!=='history';
  $('history-page-head').hidden=next!=='history';
  for(const [key,id] of [['floor','floor-nav'],['history','history-nav']]){
    const b=$(id); b.classList.toggle('selected',key===next);
    if(key===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  }
  renderList();
}
function note(text){$('form-note').textContent=text;$('form-note').hidden=!text;}
function goChatMobile(){if(matchMedia('(max-width:840px)').matches)$('dispatch').scrollIntoView({block:'start',behavior:'instant'});}
function openThread(id,isSlack=false){
  if(sending)return;
  saveDraft();slackId=isSlack?id:'';threadId=isSlack?'':id;note('');
  const group=groupedThreads().find(t=>t.id===id);
  choice=group?.managers.length===1?group.managers[0]:defaultTarget();
  if(!isSlack)restoreDraft();
  renderControls();renderChat(true);renderList();goChatMobile();
}
function openNew(target){
  if(sending)return;
  saveDraft();slackId='';threadId='';choice=defaultTarget();restoreDraft();if(target)choice=target;
  note('');renderControls();renderChat(true);renderList();
}
function selectEmployee(id) {
  if(sending)return;
  const person=workers().find(p=>p.id===id);if(!person)return;
  selected=id; const activeTask=state.tasks.find(t=>t.id===person.taskId);
  if(activeTask)openThread(activeTask.threadId);
  else openNew(person.manager||id);
  renderTeams();
}
function renderState() {
  const ok=transport==='ok',ready=ok&&targetReady('both');
  const offline=['claude','codex'].filter(id=>!teamReady(id));
  $('service').dataset.health=ready?'ready':transport==='loading'?'loading':'warn';
  $('service-label').textContent=ready?'已連線':transport==='loading'?'連線中':ok&&offline.length===1?titleFor(offline[0])+' 待登入':ok?'引擎未就緒':'離線';
  $('backend-name').textContent=state.backend.label||'本機工作區';
  $('backend-detail').textContent=ok?(state.backend.detail||(ready?'本機服務已連線。':'請檢查代理引擎設定。')):transport==='loading'?'正在取得服務狀態。':'無法連線至本機服務，會自動重試。';
  $('active-count').textContent=received?state.tasks.filter(t=>active.has(t.status)).length:'—';
  $('queue-count').textContent=received?state.tasks.filter(t=>t.status==='queued').length:'—';
  const count=new Set(state.tasks.map(t=>t.threadId)).size+state.slackThreads.length;
  $('nav-count').textContent=count>0?count:'';
  renderTeams();renderList();renderControls();renderChat();
}
async function refresh() {
  const seq=++issuedSequence;
  try{
    const res=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(7500)});
    if(!res.ok)throw Error('state '+res.status);
    const next=await res.json();
    if(!Array.isArray(next.tasks)||!Array.isArray(next.messages)||!Array.isArray(next.employees))throw Error('state');
    if(seq<lastSequence)return;lastSequence=seq;
    Object.assign(state,{...next,activities:next.activities||[],drafts:next.drafts||[],slackThreads:next.slackThreads||[],backend:next.backend||{ready:false},modelCatalog:next.modelCatalog||null});
    if(!received&&!targetTouched&&!getStore(draftKey())&&!targetReady(choice))choice=defaultTarget();
    transport='ok';received=true;
  }catch{if(seq<lastSequence)return;lastSequence=seq;transport='error';}
  renderState();
}
$('brand').onclick=$('floor-nav').onclick=()=>showView('floor');$('history-nav').onclick=()=>showView('history');
for(const b of document.querySelectorAll('[data-source]'))b.onclick=()=>{source=b.dataset.source;renderList();};
$('threads').onclick=e=>{const b=e.target.closest('[data-thread]');if(b)openThread(b.dataset.thread,source==='slack');};
$('teams').onclick=e=>{const b=e.target.closest('[data-employee]');if(b)selectEmployee(b.dataset.employee);};
$('search').oninput=$('hist-filter').onchange=renderList;
for(const b of document.querySelectorAll('[data-target]'))b.onclick=()=>{targetTouched=true;choice=b.dataset.target;saveDraft();note('');renderControls();};
$('chat-new').onclick=$('history-new').onclick=()=>{openNew();goChatMobile();field.focus({preventScroll:true});};
field.oninput=()=>{saveDraft();renderControls();};
field.onkeydown=e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){
    e.preventDefault();if(!$('send').disabled)$('composer').requestSubmit();
  }
};
$('composer').onsubmit=async e=>{
  e.preventDefault();const text=field.value.trim();
  if(!text||$('send').disabled||slackId)return;
  const managers=targetsFor(choice);
  const modelSettings=Object.fromEntries(managers.map(manager=>[manager,modelSelection(manager)])
    .filter(([,setting])=>setting.model||setting.effort));
  const existing=state.tasks.find(t=>t.threadId===threadId);
  if(threadId&&!existing){note('這個任務串已無法取得，請新增交辦。');return;}
  const endpoint=existing?'/api/tasks/'+encodeURIComponent(existing.id)+'/messages':'/api/tasks';
  const pendingKey='pending:'+draftKey(),stored=getStore(pendingKey);
  const fingerprint=JSON.stringify(Object.keys(modelSettings).length ? [endpoint,managers,text,modelSettings] : [endpoint,managers,text]);
  const clientId=stored?.fingerprint===fingerprint?stored.clientId:crypto.randomUUID();
  putStore(pendingKey,{fingerprint,clientId});
  sending=true;renderControls();note('');
  try{
    const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({managers,text,clientId,modelSettings}),signal:AbortSignal.timeout(12000)});
    const answer=await res.json().catch(()=>null);
    if(!res.ok)throw Error(typeof answer?.error==='string'?answer.error:'服務回應 HTTP '+res.status);
    if(!answer?.threadId)throw Error('服務未回傳任務編號');
    putStore(draftKey(),null);putStore(pendingKey,null);threadId=answer.threadId;
    field.value='';await refresh();renderChat(true);
  }catch(error){note('送出未確認，草稿已保留。'+error.message);}
  finally{sending=false;renderControls();}
};
try{scene=createOfficeScene($('office-canvas'),{onSelect:selectEmployee,onLife:renderOfficeLife});}catch(error){console.error('Office scene',error);$('selection-hint').textContent='可在下方選取團隊成員';}
if('ResizeObserver' in window){
  new ResizeObserver(()=>positionOfficeDialogue(lifeFrame?.speech)).observe($('office-canvas'));
}
$('office-life-toggle').onclick=()=>{
  lifeEnabled=!lifeEnabled;
  putStore('office-life',lifeEnabled);
  renderLifeToggle();
  renderTeams();
};
renderLifeToggle();
restoreDraft();renderState();
async function poll(){
  await refresh();
  const running=state.tasks.some(task=>active.has(task.status)||task.status==='queued');
  setTimeout(poll,document.hidden?7000:running?650:2200);
}
poll();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
