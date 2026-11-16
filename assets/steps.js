const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./steps.css', import.meta.url).href;document.head.append(sheet);
const main=document.querySelector('main'), workspace=document.getElementById('workspace');
main.classList.add('stepped-layout');
const shell=document.createElement('section');shell.className='step-shell';
const rail=document.createElement('div');rail.className='step-rail';rail.setAttribute('aria-label','Analysis steps');
const titles=['Upload or paste the call','Review the conversation','Understand the results','Next steps','About Cue'];
const descriptions=['Choose a recording, paste a transcript, or explore an example.','Check the words, assign speakers, and explore highlighted warning signs.','See possible schemes and the evidence behind the assessment.','Decide what to do next and build your personal action checklist.','How the prototype works.'];
const pages=titles.map((title,i)=>{const page=document.createElement('section');page.className='step-page';page.id=`step-${i+1}`;const heading=document.createElement('h1');heading.tabIndex=-1;heading.textContent=`${i<4?'Step '+(i+1)+': ':''}${title}`;const intro=document.createElement('p');intro.className='step-description';intro.textContent=descriptions[i];page.append(heading,intro);shell.append(page);return page;});
const move=(selector,page)=>{const node=document.querySelector(selector);if(node)page.append(node);};
const inputGrid=document.createElement('div');inputGrid.className='step-columns';pages[0].append(inputGrid);
move('.upload-card',inputGrid);move('#transcriptCard',inputGrid);move('.samples',pages[0]);
const reviewGrid=document.createElement('div');reviewGrid.className='step-columns';pages[1].append(reviewGrid);move('.playback-card',reviewGrid);move('#inspector',reviewGrid);
const reviewNote=document.createElement('p');reviewNote.textContent='Analyze a call in Step 1 to see its transcript highlights here.';pages[1].append(reviewNote);
move('.results-column',pages[2]);
const actionGrid=document.createElement('div');actionGrid.className='step-columns';pages[3].append(actionGrid);
move('.next-step',actionGrid);move('.personal-plan',actionGrid);move('#safety',pages[3]);move('#method',pages[4]);
move('#reset',pages[0]);workspace.replaceWith(shell);main.prepend(rail);document.querySelector('.hero').hidden=true;document.querySelector('.demo-note').hidden=true;
let current=0,pending=false;
const buttons=titles.slice(0,4).map((title,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`0${i+1}  ${['Add call','Review','Results','Next steps'][i]}`;b.onclick=()=>show(i);rail.append(b);return b;});
const controls=document.createElement('div');controls.className='step-controls';const back=document.createElement('button'),next=document.createElement('button');back.className='button secondary';next.className='button primary';back.textContent='← Back';controls.append(back,next);shell.append(controls);
function ready(){return !document.getElementById('report').hidden;}
function sync(){buttons[2].disabled=!ready();next.disabled=(current===1||current===2)&&!ready();reviewNote.hidden=ready();actionGrid.hidden=!ready();}
function show(i,focus=true){current=i;pages.forEach((p,n)=>p.hidden=n!==i);buttons.forEach((b,n)=>b.setAttribute('aria-current',n===i?'step':'false'));back.hidden=i===0;next.hidden=i>=3;next.textContent=['Next: review call →','Next: see results →','Next: choose actions →'][i]||'';sync();history.replaceState(null,'',`#step-${i+1}`);if(focus)pages[i].querySelector('h1').focus();window.scrollTo(0,0);}
back.onclick=()=>show(Math.max(0,current-1));
next.onclick=()=>{if(current===0&&!ready()){pending=true;const audio=document.getElementById('player').getAttribute('src');const text=document.getElementById('transcript').value.trim();document.getElementById(audio&&!text?'analyze':'textAnalyze').click();if(!audio&&!text){pending=false;document.getElementById('transcript').focus();}return;}show(current+1);};
new MutationObserver(()=>{sync();if(pending&&ready()){pending=false;show(1);}}).observe(document.getElementById('report'),{attributes:true,attributeFilter:['hidden']});
document.querySelectorAll('header nav a').forEach(a=>{const destination=a.getAttribute('href');a.onclick=e=>{e.preventDefault();show(destination==='#workspace'?0:destination==='#safety'?3:4);};});
document.querySelector('header .brand').onclick=e=>{e.preventDefault();show(0);};
const initial=Number(location.hash.match(/^#step-(\d)$/)?.[1]||1)-1;show(initial>=0&&initial<5&&(initial!==2||ready())?initial:0,false);
