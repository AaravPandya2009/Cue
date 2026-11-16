import {analyzeCall,splitTurns,highlightRanges} from './insights.js';
import {formatTime} from './timeline.js';

export function createFeatures({onReassess,timestampButton,player,getPlayback,play,pause,restart,setMode}) {
  const $=id=>document.getElementById(id);
  const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
  let speakerSource='',turns=[],current=null,quality=null;
  const feedback=new Map();
  const feedbackKey=e=>`${e.id}:${e.matchStart}:${speakerSource.slice(e.matchStart,e.matchEnd)}`;

  function analyze(text,duration){
    if(!speakerSource || !speakerSource.startsWith(text)){speakerSource=text;turns=splitTurns(text);feedback.clear();}
    return analyzeCall(text,duration,turns);
  }
  function clearAnalysis(){
    speakerSource='';turns=[];current=null;feedback.clear();
    $('inspector').hidden=true;$('speakerTranscript').replaceChildren();
    $('highlightDetail').textContent='Select a highlighted phrase to see why it was flagged.';
    renderPresentation();
  }
  function reset(){clearAnalysis();setQuality(null);}
  function clearResult(){current=null;$('inspector').hidden=true;renderPresentation();}
  function setQuality(value){
    quality=value;const panel=$('qualityPanel');panel.hidden=!value;panel.replaceChildren();
    if(!value){renderPresentation();return;}
    panel.append(el('h3',value.status),el('p',`${value.rmsDb} dBFS average · ${value.clippedPercent}% at maximum level · ${value.quietPercent}% quiet frames`,'quality-metrics'));
    for(const issue of value.issues){const row=el('div','','quality-issue');row.append(el('strong',issue.title),el('p',issue.tip));panel.append(row);}
    panel.append(el('p',value.limitation,'muted'));renderPresentation();
  }
  function classification(container,result,compact=false){
    container.replaceChildren();
    if(!result){container.append(el('p','Analyze a recording or load a sample to see its call type.','muted'));return;}
    container.append(el('span','CALL TYPE','eyebrow'),el('h3',result.classification.type));
    const schemes=result.classification.schemes;
    if(!schemes.length) container.append(el('p','No specific scheme pattern matched. This does not establish that the call is safe.','muted'));
    for(const scheme of schemes){
      const card=el('article','','scheme-card');card.append(el('h4',scheme.label),el('p',scheme.description));
      if(!compact){
        card.append(el('p',scheme.why,'muted'));const cues=el('ul','','scheme-cues');
        for(const cue of scheme.cues){const item=el('li');item.append(el('strong',cue.title+': '),el('q',current.text.slice(cue.start,cue.end)));cues.append(item);}card.append(cues);
        const source=el('a','Learn about this pattern ↗','guidance-source');source.href=scheme.source;source.target='_blank';source.rel='noopener noreferrer';card.append(source);
      }
      container.append(card);
    }
    if(!compact)container.append(el('p','Prototype pattern matching, not a legal finding or a complete scam detector. Labels can overlap. Check the transcript and speaker labels.','muted'));
  }
  function explain(ids){
    const detail=$('highlightDetail');detail.replaceChildren();
    for(const item of current.result.evidence.filter(e=>ids.includes(e.id))){const row=el('div');row.append(el('strong',item.title),el('p',item.why));if(Number.isFinite(item.timestamp)&&player.getAttribute('src'))row.append(timestampButton(item));detail.append(row);}
  }
  function markedText(container,text,start,end,ranges,interactive=true){
    let cursor=start;
    for(const range of ranges.filter(r=>r.start<end&&r.end>start)){
      const a=Math.max(start,range.start),b=Math.min(end,range.end);
      if(a>cursor)container.append(document.createTextNode(text.slice(cursor,a)));
      const mark=el(interactive?'button':'mark',text.slice(a,b),`phrase ${range.group}`);
      if(interactive){mark.type='button';mark.title='Explain this highlighted phrase';mark.setAttribute('aria-label',`Explain: ${text.slice(a,b)}`);mark.onclick=()=>explain(range.ids);}
      container.append(mark);cursor=b;
    }
    if(cursor<end)container.append(document.createTextNode(text.slice(cursor,end)));
  }
  function highlightedTranscript(){
    const {result,text}=current,root=$('speakerTranscript');root.replaceChildren();$('inspector').hidden=false;
    const visibleTurns=turns.filter(t=>t.start<text.length),ranges=highlightRanges(result.evidence,text.length);
    const unassigned=visibleTurns.filter(t=>t.speaker==='unknown').length;
    $('speakerSummary').textContent=`${result.excludedRecipientTurns} recipient excerpts excluded · ${unassigned} unknown excerpts included. Changing a label updates the assessment.`;
    $('highlightDetail').textContent='Select a highlighted phrase to see why it was flagged.';
    visibleTurns.forEach((turn,index)=>{
      const row=el('div','',`speaker-row ${turn.speaker}`),header=el('div','','speaker-row-top');
      header.append(el('span',`EXCERPT ${index+1}`,'mini-label'));
      const label=el('label','Speaker '),select=el('select');
      select.setAttribute('aria-label',`Speaker for excerpt ${index+1}`);select.id=`speaker-${turn.id}`;
      for(const [value,name] of [['unknown','Unknown'],['caller','Caller'],['recipient','Recipient']]){const option=el('option',name);option.value=value;select.append(option);}
      select.value=turn.speaker;select.onchange=()=>{turn.speaker=select.value;const id=select.id;onReassess();document.getElementById(id)?.focus();};label.append(select);header.append(label);row.append(header);
      const body=el('p');markedText(body,text,turn.start,Math.min(turn.end,text.length),ranges);row.append(body);
      if(turn.speaker==='recipient')row.append(el('small','Recipient · excluded from caller assessment','recipient-note'));
      root.append(row);
    });
  }
  function decorateEvidence(card,item){
    const key=feedbackKey(item),saved=feedback.get(key)||{vote:null,note:''};
    const controls=el('div','','warning-feedback');controls.append(el('span','Was this warning helpful?'));
    const votes=el('div','','feedback-votes'),buttons=[];
    const savedLabel=el('p',saved.vote||saved.note?'Saved in this tab. Included in downloaded reports.':'Feedback stays in this tab; it does not retrain the detector.','feedback-status');
    function save(value){const previous=feedback.get(key)||{vote:null,note:''};feedback.set(key,{...previous,...value,warningId:item.id,warningTitle:item.title,matchedText:speakerSource.slice(item.matchStart,item.matchEnd)});savedLabel.textContent='Saved in this tab. Included in downloaded reports.';}
    for(const [value,title] of [['helpful','Helpful'],['incorrect','Seems incorrect']]){
      const button=el('button',title);button.type='button';button.setAttribute('aria-pressed',String(saved.vote===value));
      button.setAttribute('aria-label',`${title}: ${item.title}`);
      button.onclick=()=>{const currentVote=feedback.get(key)?.vote;save({vote:currentVote===value?null:value});for(const b of buttons)b.node.setAttribute('aria-pressed',String(feedback.get(key)?.vote===b.value));};
      buttons.push({node:button,value});votes.append(button);
    }
    const details=el('details'),summary=el('summary','Explain your feedback (optional)'),note=el('textarea');note.rows=2;note.maxLength=600;note.value=saved.note;note.placeholder='What did the detector miss or misunderstand?';note.setAttribute('aria-label',`Feedback notes for ${item.title}`);note.oninput=()=>save({note:note.value});details.open=Boolean(saved.note);details.append(summary,note);
    controls.append(votes,details,savedLabel);card.append(controls);
  }
  function exportData(){
    const visibleText=current?.text||'',ids=new Set((current?.result.evidence||[]).map(feedbackKey));
    return {speakerLabels:turns.filter(t=>t.start<visibleText.length).map(t=>({...t,end:Math.min(t.end,visibleText.length)})),audioQuality:quality,warningFeedback:[...feedback].filter(([key])=>ids.has(key)).map(([,value])=>({...value})),speakerLabelMethod:'Manual labels; explicit Caller:/Recipient: text prefixes are recognized. Unknown speech is included.'};
  }
  function render(result,source,text){current={result,source,text};classification($('classification'),result);highlightedTranscript();renderPresentation();}

  const dialog=$('presentation');
  $('present').onclick=()=>{renderPresentation();dialog.showModal();};
  $('presentClose').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});});
  $('presentFullscreen').onclick=async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(dialog.requestFullscreen)await dialog.requestFullscreen();else throw new Error('unavailable');}
    catch{$('presentModeNote').textContent+=' Browser fullscreen is unavailable; presentation view is still active.';}
  };
  document.addEventListener('fullscreenchange',()=>{$('presentFullscreen').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';});
  $('presentMode').onchange=()=>setMode($('presentMode').value);
  $('presentPlay').onclick=()=>{player.paused?play():pause();};
  $('presentRestart').onclick=restart;
  function updatePresenterClock(){
    const state=getPlayback(),hasAudio=Boolean(player.getAttribute('src'));
    $('presentPlay').disabled=!hasAudio;$('presentRestart').disabled=!hasAudio;
    $('presentPlay').textContent=player.paused?'Play recording':'Pause recording';
    $('presentClock').textContent=hasAudio?`${formatTime(player.currentTime)} / ${formatTime(state.duration)}`:'Transcript example · no audio';
    $('presentMode').value=state.live?'live':'full';$('presentMode').options[1].disabled=!state.canLive;
    $('presentModeNote').textContent=state.live?'SIMULATION — previously analyzed audio. Only completed segments are revealed as the recording plays.':'Full assessment — all analyzed text is visible. Switch to simulated live playback when a timed recording is available.';
  }
  function renderPresentation(){
    updatePresenterClock();
    $('presentSource').textContent=current?.source||'READY TO DEMONSTRATE';
    $('presentationTitle').textContent=current?.result.classification.schemes[0]?.label||current?.result.verdict||'A clearer view of the call.';
    $('presentSummary').textContent=current?.result.summary||'Load an example or analyze a recording. Its transcript, scheme labels, and warnings will appear here.';
    $('presentScore').textContent=current?.result.score??'—';
    $('presentQuality').textContent=quality?quality.status:'Transcript only';
    const transcript=$('presentTranscript');transcript.replaceChildren();
    if(current){const ranges=highlightRanges(current.result.evidence,current.text.length);for(const turn of turns.filter(t=>t.start<current.text.length)){const row=el('div','','present-turn');row.append(el('span',turn.speaker.toUpperCase(),'mini-label'));const words=el('p');markedText(words,current.text,turn.start,Math.min(turn.end,current.text.length),ranges,false);row.append(words);transcript.append(row);}}
    else transcript.append(el('p','Waiting for analyzed or revealed speech.','muted'));
    classification($('presentSchemes'),current?.result,true);
    const warnings=$('presentWarnings');warnings.replaceChildren();
    for(const item of (current?.result.evidence||[]).slice(0,6)){const card=el('article','','present-warning');card.append(el('h3',item.title),el('p',item.why));if(Number.isFinite(item.timestamp)&&player.getAttribute('src'))card.append(timestampButton(item));warnings.append(card);}
    if(!warnings.childElementCount)warnings.append(el('p','No warning patterns to display.','muted'));
  }
  for(const event of ['timeupdate','play','pause','ended'])player.addEventListener(event,()=>{if(dialog.open)updatePresenterClock();});
  return {analyze,render,decorateEvidence,exportData,reset,clearAnalysis,clearResult,setQuality,renderPresentation};
}
