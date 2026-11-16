import {createFeatures} from './features-ui.js';
import './steps.js';
import {pyramidExample} from './insights.js';
import {checkAudioQuality} from './audio-quality.js';
import {recommendActions} from './guidance.js';
import {alignSegments, attachTimes, formatTime, revealAt, hasFullTimeline} from './timeline.js';
import {buildActionPlan} from './action-plan.js';

const $ = id => document.getElementById(id);
const player = $('player');
let audioData = null, duration = null, objectUrl = null, worker = null;
let busy = false, report = null, selection = 0, timing = null, liveMode = false;
let lastRevealed = null, sourceLabel = 'UPLOADED RECORDING';
const selectedSituations = new Set(), completedSteps = new Set();
const suspicious = "Hello, I'm calling from your bank fraud department. Your account will be frozen unless you act immediately. Do not hang up. Read me your verification code right now so I can secure your account. Then buy gift cards to complete the verification. Don't tell anyone about this call.";
const ordinary = "Hi, this is Maya from the community garden. I'm calling about the volunteer event on Saturday. We start at nine in the morning near the main gate. Bring some water and comfortable shoes. You can check the details on the notice board when you visit. Hope to see you there!";

const features=createFeatures({
  timestampButton, player,
  getPlayback:()=>({live:liveMode,duration,canLive:Boolean(timing&&hasFullTimeline(timing.text,timing.segments))}),
  play:()=>playAudio(),pause:()=>player.pause(),restart:()=>{player.pause();player.currentTime=0;lastRevealed=null;updateLive();},
  setMode:mode=>{if(mode==='live')$('viewLive').onclick();else $('viewFull').onclick();features.renderPresentation();},
  onReassess:()=>{
    if(!report)return;
    if(liveMode){lastRevealed=null;updateLive();return;}
    const {transcript,source,duration:reportDuration}=report;
    render(attachTimes(assess(transcript,reportDuration),timing?.segments||[]),source,transcript);
  }
});
function assess(text,duration=null){return features.analyze(text,duration);}

function element(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}
for (let n = 0; n < 35; n++) {
  const bar = element('b', '');
  bar.style.height = `${10 + Math.abs(Math.sin(n * 1.7)) * 70 * Math.sin(Math.PI * (n + 1) / 36)}px`;
  $('heroWave').append(bar);
}
function status(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
function setBusy(value) {
  busy = value;
  for (const id of ['analyze', 'textAnalyze', 'sampleRisk', 'sampleNormal', 'sampleAudio', 'samplePyramid', 'present', 'file']) $(id).disabled = value;
  $('transcript').disabled = value;
  $('cancel').hidden = !value;
  updateModes();
}
function updateModes() {
  const playable = timing && hasFullTimeline(timing.text, timing.segments);
  $('viewLive').disabled = busy || !playable;
  $('viewFull').disabled = busy;
  $('viewFull').setAttribute('aria-pressed', String(!liveMode));
  $('viewLive').setAttribute('aria-pressed', String(liveMode));
  $('livePanel').hidden = !liveMode;
  $('transcriptCard').hidden = liveMode;
  $('timingHelp').textContent = playable
    ? 'Warning timestamps jump to estimated segment starts. Switch to Live demo to reveal this call as it plays.'
    : timing ? 'Complete segment timing was unavailable. Full analysis still works; only aligned warnings have timestamps.'
    : 'Analyze a recording to unlock clickable timestamps and simulated live playback.';
}
function clearReport() {
  features.clearResult();
  $('emptyHeading').textContent = liveMode ? 'Listening as the call unfolds.' : 'Every call has a story.';
  $('emptyDescription').textContent = liveMode ? 'Start playback. The assessment will appear after the first spoken segment, without revealing the rest of the call.' : 'Add a recording to discover its signals. We’ll show what stands out, and why.';
  $('empty').hidden = false;
  $('report').hidden = true;
  report = null;
}
function clearPlan() {
  selectedSituations.clear(); completedSteps.clear();
  for (const input of document.querySelectorAll('[name="situation"]')) input.checked = false;
  renderPlan();
}
function invalidateTiming() {
  player.pause(); liveMode = false; timing = null; lastRevealed = null;
  $('liveTranscript').replaceChildren(); $('liveWarnings').replaceChildren();
  updateModes();
}
function disposeAudio() {
  invalidateTiming();
  features.reset();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null; audioData = null; duration = null;
  player.removeAttribute('src'); player.load();
  $('recording').hidden = true; $('dropzone').hidden = false; $('file').value = '';
}
function cancel() {
  worker?.terminate(); worker = null; selection++; setBusy(false);
  status('Analysis cancelled. Your recording and transcript are still available.');
}
$('cancel').onclick = cancel;
$('reset').onclick = () => {
  cancel(); disposeAudio(); clearPlan(); clearReport();
  $('transcript').value = ''; $('transcriptBadge').textContent = 'EDITABLE';
  status('English recordings supported. First analysis downloads a speech model; it may take a few minutes.');
};

async function loadFile(file, source = 'UPLOADED RECORDING') {
  if (busy || !file) return false;
  const ticket = ++selection;
  disposeAudio(); clearPlan(); clearReport();
  sourceLabel = source;
  $('transcript').value = ''; $('transcriptBadge').textContent = 'EDITABLE';
  if (file.size > 25 * 1024 * 1024) { status('This file exceeds 25 MB. Choose a smaller recording.', true); return false; }
  setBusy(true); status('Reading your recording…');
  let context;
  try {
    context = new AudioContext();
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (ticket !== selection) return false;
    if (buffer.duration > 300) throw new Error('This recording exceeds five minutes. Trim it before analyzing.');
    if (buffer.duration < 1) throw new Error('Choose a recording at least one second long.');
    const offline = new OfflineAudioContext(1, Math.ceil(buffer.duration * 16000), 16000);
    const source = offline.createBufferSource(); source.buffer = buffer; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering();
    if (ticket !== selection) return false;
    audioData = rendered.getChannelData(0).slice();
    const quality=checkAudioQuality(audioData,16000);features.setQuality(quality);
    if(quality.blocked){const error=new Error('This recording appears silent. Choose a call with audible speech.');error.qualityCheck=quality;throw error;}
    duration = buffer.duration; objectUrl = URL.createObjectURL(file); player.src = objectUrl;
    $('filename').textContent = file.name;
    $('filemeta').textContent = `${formatTime(duration)} · ${(file.size / 1024 / 1024).toFixed(1)} MB · Ready to analyze`;
    $('dropzone').hidden = true; $('recording').hidden = false; drawWave();
    status('Ready. Analyze recording to transcribe the call and unlock the live demo.');
    return true;
  } catch (error) {
    if (ticket === selection) {
      disposeAudio();
      if(error.qualityCheck)features.setQuality(error.qualityCheck);
      status(error.message.includes('decode') ? 'This audio could not be decoded. Try an MP3 or WAV recording.' : error.message, true);
    }
    return false;
  } finally { await context?.close(); if (ticket === selection) setBusy(false); }
}
function drawWave() {
  const canvas = $('waveform'); canvas.width = 900;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 900, 96); ctx.fillStyle = '#ff5b65';
  for (let n = 0; n < 140; n++) {
    let peak = 0;
    const start = Math.floor(n * audioData.length / 140), end = Math.floor((n + 1) * audioData.length / 140);
    for (let i = start; i < end; i += 8) peak = Math.max(peak, Math.abs(audioData[i]));
    const height = Math.max(3, Math.sqrt(peak) * 80);
    ctx.fillRect(n * 900 / 140, 48 - height / 2, 3, height);
  }
}
$('file').onchange = e => loadFile(e.target.files[0]);
for (const type of ['dragenter', 'dragover']) $('dropzone').addEventListener(type, e => { e.preventDefault(); $('dropzone').classList.add('drag'); });
for (const type of ['dragleave', 'drop']) $('dropzone').addEventListener(type, e => {
  e.preventDefault(); $('dropzone').classList.remove('drag'); if (type === 'drop') loadFile(e.dataTransfer.files[0]);
});
window.addEventListener('dragover', e => e.preventDefault()); window.addEventListener('drop', e => e.preventDefault());

function analyzeRecording() {
  if (!audioData) { status('Choose a recording first, or paste a transcript and select Analyze text.', true); return; }
  invalidateTiming(); features.clearAnalysis(); clearReport(); setBusy(true); status('Starting local speech recognition…');
  const ticket = selection;
  worker ??= new Worker(new URL('./transcriber.js', import.meta.url), {type:'module'});
  worker.onmessage = ({data}) => {
    if (ticket !== selection) return;
    if (data.type === 'status') status(data.text);
    if (data.type === 'done') {
      timing = alignSegments(data.result, duration);
      const text = timing.text;
      $('transcript').value = text; $('transcriptBadge').textContent = 'AUTO · REVIEW FOR ACCURACY'; setBusy(false);
      if (!text) { timing = null; updateModes(); status('No speech was recognized. Try a clearer recording or paste its transcript.', true); return; }
      render(attachTimes(assess(text, duration), timing.segments), sourceLabel, text);
      status('Analysis complete. Click a warning timestamp to listen, or switch to Live demo. Review the transcript for recognition mistakes.');
    }
    if (data.type === 'error') failTranscription('Speech recognition could not finish. Check your internet connection and retry, or paste a transcript.');
  };
  worker.onerror = () => { if (ticket === selection) failTranscription('The speech engine could not start. Check your connection, or paste a transcript.'); };
  worker.postMessage({audio:audioData.slice()});
}
function failTranscription(message) { worker?.terminate(); worker = null; setBusy(false); status(message, true); }
$('analyze').onclick = analyzeRecording;
$('textAnalyze').onclick = () => {
  const text = $('transcript').value.trim();
  if (!text) { status('Paste a transcript first, or choose a sample call below.', true); return; }
  invalidateTiming(); render(assess(text), 'TRANSCRIPT ONLY', text);
  status('Text assessment complete. Audio timestamps and pace are unavailable in text-only mode.');
};
$('transcript').addEventListener('input', () => {
  invalidateTiming(); features.clearAnalysis(); clearReport(); $('transcriptBadge').textContent = 'EDITED · REANALYZE TEXT';
});
function sample(text) {
  disposeAudio(); clearPlan(); $('transcript').value = text; $('transcriptBadge').textContent = 'ILLUSTRATIVE SAMPLE';
  render(assess(text), 'SAMPLE · TRANSCRIPT ONLY', text);
  status('Illustrative transcript loaded. Use Load audio demo to try timestamps and simulated live playback.');
}
$('sampleRisk').onclick = () => sample(suspicious);
$('sampleNormal').onclick = () => sample(ordinary);
$('samplePyramid').onclick = () => {sample(pyramidExample);$('transcriptBadge').textContent='PYRAMID SCHEME · FICTIONAL EXAMPLE';status('Fictional pyramid-scheme transcript loaded. Explore the highlighted cues, edit speaker labels, or select Present.');};
$('sampleAudio').onclick = async () => {
  const ticket = ++selection; setBusy(true); status('Loading the synthetic audio demo…');
  try {
    const response = await fetch(new URL('./example-suspicious-call.wav', import.meta.url));
    if (!response.ok) throw new Error('Could not load the audio demo.');
    const blob = await response.blob();
    if (ticket !== selection) return;
    setBusy(false);
    if (await loadFile(new File([blob], 'Synthetic demo call.wav', {type:'audio/wav'}), 'SYNTHETIC AUDIO DEMO')) analyzeRecording();
  } catch (error) { if (ticket === selection) { setBusy(false); status(error.message, true); } }
};

// The audio element is the single clock: pause, seek, and playback-rate changes
// all affect the simulation. A segment appears only once its end has been reached.
function updateLive() {
  if (!liveMode || !timing) return;
  const time = player.currentTime;
  $('liveClock').textContent = `${formatTime(time)} / ${formatTime(duration)}`;
  $('livePlay').textContent = player.paused ? (player.ended ? 'Replay demo' : 'Play demo') : 'Pause demo';
  $('liveState').textContent = player.ended ? 'Replay complete. All recognized segments have been revealed.' : player.paused ? 'Paused — use Play demo to continue.' : 'Playing — revealing the recording as it progresses.';
  const revealed = revealAt(timing.text, timing.segments, player.ended ? duration : time);
  if (revealed === lastRevealed && !player.ended) return;
  lastRevealed = revealed;
  $('liveTranscript').textContent = revealed || 'Waiting for the first spoken segment…';
  $('liveWarnings').replaceChildren();
  if (!revealed.trim()) {
    clearReport(); $('liveWarnings').append(element('p', 'No transcript segments have been reached yet.', 'muted')); return;
  }
  const result = attachTimes(assess(revealed, player.ended ? duration : time || null), timing.segments);
  render(result, 'SIMULATION · REVEALED AUDIO ONLY', revealed);
  for (const warning of result.evidence.filter(item => item.weight > 0)) {
    const card = element('div', '', 'live-warning');
    card.append(element('strong', warning.title));
    if (warning.timestamp !== null) card.append(timestampButton(warning));
    $('liveWarnings').append(card);
  }
  if (!$('liveWarnings').childElementCount) $('liveWarnings').append(element('p', 'No configured warning patterns in the audio revealed so far.', 'muted'));
}
async function playAudio() {
  try { await player.play(); }
  catch { if (liveMode) $('liveState').textContent = 'Playback could not start. Try the audio player’s play control.'; else status('Playback could not start. Try the audio player’s play control.', true); }
}
function seekTo(time) { player.currentTime = time; updateLive(); playAudio(); }
function timestampButton(warning) {
  const button = element('button', `▶ ~${formatTime(warning.timestamp)}`, 'timestamp');
  button.type = 'button';
  button.setAttribute('aria-label', `Play ${warning.title} at approximately ${formatTime(warning.timestamp)}`);
  button.title = 'Estimated start of the matching speech segment';
  button.onclick = () => seekTo(warning.timestamp);
  return button;
}
$('viewLive').onclick = () => {
  if (!timing || !hasFullTimeline(timing.text, timing.segments)) return;
  player.pause(); player.currentTime = 0; liveMode = true; lastRevealed = null; updateModes(); updateLive();
};
$('viewFull').onclick = () => {
  if (!liveMode) return;
  player.pause(); liveMode = false; updateModes();
  render(attachTimes(assess(timing.text, duration), timing.segments), sourceLabel, timing.text);
};
$('livePlay').onclick = () => { if (player.paused) { if (player.ended) player.currentTime = 0; playAudio(); } else player.pause(); };
$('liveRestart').onclick = () => { player.pause(); player.currentTime = 0; lastRevealed = null; updateLive(); };
for (const event of ['timeupdate', 'play', 'pause', 'seeked', 'ended']) player.addEventListener(event, updateLive);

function renderActions(guidance) {
  $('actionTips').replaceChildren();
  for (const action of guidance.actions) {
    const item = element('li', ''); item.append(element('strong', action.title), element('p', action.detail)); $('actionTips').append(item);
  }
  $('recoveryTips').replaceChildren();
  for (const tip of guidance.recovery) $('recoveryTips').append(element('li', tip));
  $('recovery').hidden = guidance.recovery.length === 0;
  if (!liveMode) $('recovery').open = false;
}
function planSnapshot() {
  return {selectedSituations:[...selectedSituations], steps:buildActionPlan([...selectedSituations]).map(step => ({...step, completed:completedSteps.has(step.id)}))};
}
function updatePlanProgress() {
  const plan = planSnapshot();
  $('planProgress').textContent = plan.steps.length ? `${plan.steps.filter(step => step.completed).length} of ${plan.steps.length} steps marked complete` : 'Select a situation to build your checklist.';
  if (report) report.actionPlan = plan;
}
function renderPlan() {
  const steps = buildActionPlan([...selectedSituations]);
  const activeIds = new Set(steps.map(step => step.id));
  for (const id of completedSteps) if (!activeIds.has(id)) completedSteps.delete(id);
  $('planSteps').replaceChildren();
  for (const step of steps) {
    const label = element('label', '', 'plan-step');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = completedSteps.has(step.id);
    checkbox.setAttribute('aria-label', `Mark complete: ${step.title}`);
    const content = element('span', ''); content.append(element('strong', step.title), element('span', step.detail, 'plan-detail'));
    checkbox.onchange = () => { checkbox.checked ? completedSteps.add(step.id) : completedSteps.delete(step.id); updatePlanProgress(); };
    label.append(checkbox, content); $('planSteps').append(label);
  }
  updatePlanProgress();
}
for (const input of document.querySelectorAll('[name="situation"]')) input.onchange = () => {
  input.checked ? selectedSituations.add(input.value) : selectedSituations.delete(input.value); renderPlan();
};
$('clearPlan').onclick = clearPlan;

function render(result, source, transcript) {
  features.render(result,source,transcript);
  const guidance = recommendActions(result);
  report = {...result, ...guidance, ...features.exportData(), source, transcript, actionPlan:planSnapshot(), simulation:liveMode, playbackPosition:liveMode ? player.currentTime : null, generatedAt:new Date().toISOString(), limitations:'Unvalidated English-language rules; score is not a probability. Timestamps are estimated speech-segment starts. Live demo is prerecorded playback, not live detection. No vocal emotion detection or caller identity verification. Speaker labels are manual. Scheme labels are language-pattern matches, not proof of fraud. Audio quality checks are signal heuristics. Feedback stays local and does not retrain detection. Checklist completion is self-reported. Rules can misread context, negation, and speaker attribution.'};
  $('empty').hidden = true; $('report').hidden = false;
  $('sourceLabel').textContent = source; $('score').textContent = result.score ?? '—';
  $('scoreRing').style.setProperty('--angle', `${(result.score ?? 0) * 3.6}deg`);
  $('scoreRing').style.setProperty('--risk-color', result.score >= 60 ? '#ff465a' : result.score >= 25 ? '#ee8894' : '#a799a2');
  $('verdict').textContent = result.verdict; $('summary').textContent = result.summary; $('nextStep').textContent = result.nextStep;
  renderActions(guidance); updatePlanProgress(); $('signals').replaceChildren();
  const tone = result.evidence.filter(e => e.group === 'tone'), requests = result.evidence.filter(e => e.group === 'requests' || e.group === 'scheme'), reliability = result.evidence.filter(e => e.group === 'reliability');
  const signalData = [
    ['LANGUAGE & TONE', tone.length ? 'Pressure cues found' : 'No configured cues', 'Transcript language only; vocal emotion is not measured.'],
    ['SPEAKING PACE', result.wpm ? `${result.wpm} words / min` : 'Not available', result.wpm ? liveMode ? 'Estimate from completed segments and elapsed playback. Not scored.' : 'Average over the recording, including pauses and both speakers. Not scored.' : 'Upload and analyze audio to estimate speaking pace.'],
    ['REQUESTED ACTIONS', requests.length ? `${requests.length} flagged pattern${requests.length === 1 ? '' : 's'}` : 'No configured flags', 'Language rules; review the quoted context below.'],
    ['RELIABILITY', 'Identity unverified', reliability.length ? 'Claims or verification barriers appear below. No identity lookup performed.' : 'No external verification. Absence of flags does not establish trust.']
  ];
  for (const [label, value, detail] of signalData) {
    const card = element('div', '', 'signal'); card.append(element('span', label), element('strong', value), element('p', detail)); $('signals').append(card);
  }
  $('evidenceCount').textContent = `${result.evidence.length} OBSERVATION${result.evidence.length === 1 ? '' : 'S'}`;
  $('evidence').replaceChildren();
  for (const e of result.evidence) {
    const card = element('div', '', 'evidence'); const heading = element('div', '', 'evidence-heading');
    heading.append(element('strong', e.title));
    if (Number.isFinite(e.timestamp) && objectUrl) heading.append(timestampButton(e));
    card.append(heading, element('p', e.why), element('q', e.quote), element('small', 'Speaker: '+e.speaker,'muted')); features.decorateEvidence(card,e); $('evidence').append(card);
  }
  if (!result.evidence.length) $('evidence').append(element('p', 'No configured patterns matched. These rules can miss scams and can flag innocent conversations.', 'muted'));
  $('evidence').append(element('p', 'Interpretation limit: rules may mistake quoted warnings or another speaker’s words for the caller’s requests. Review the context. Timestamps, when available, are approximate segment starts.', 'muted'));
}
$('download').onclick = () => {
  if (!report) return;
  const snapshot = {...report, ...features.exportData(), actionPlan:planSnapshot(), playbackPosition:liveMode ? player.currentTime : null};
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'cue-report.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
updateModes(); renderPlan();
