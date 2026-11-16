export function checkAudioQuality(samples,sampleRate=16000) {
  const duration=samples.length/sampleRate, frame=Math.max(1,Math.round(sampleRate*.025));
  let energy=0,peak=0,clipped=0;const rmsFrames=[];
  for(let offset=0;offset<samples.length;offset+=frame){let sum=0;const end=Math.min(samples.length,offset+frame);for(let i=offset;i<end;i++){const a=Math.abs(samples[i]);energy+=a*a;sum+=a*a;peak=Math.max(peak,a);if(a>=.995)clipped++;}rmsFrames.push(Math.sqrt(sum/(end-offset)));}
  const rms=Math.sqrt(energy/Math.max(1,samples.length)),db=20*Math.log10(Math.max(1e-8,rms));
  const ordered=[...rmsFrames].sort((a,b)=>a-b),p20=ordered[Math.floor(ordered.length*.2)]||0,p90=ordered[Math.floor(ordered.length*.9)]||0;
  const quietFraction=rmsFrames.filter(v=>v<.003).length/Math.max(1,rmsFrames.length),clipFraction=clipped/Math.max(1,samples.length);
  const issues=[];
  if(rms<.0003)issues.push({id:'silence',title:'Almost no audible signal',tip:'Check the source recording and upload a version with audible speech.'});
  else if(db< -36)issues.push({id:'quiet',title:'Low recording volume',tip:'Use a clearer source recording or increase its level without distortion.'});
  if(duration<8)issues.push({id:'short',title:'Very short recording',tip:'Include more of the conversation so requests and responses have context.'});
  if(clipFraction>.005)issues.push({id:'clipping',title:'Possible distortion',tip:'Many samples reach maximum level. Use the original recording or record at a lower input level.'});
  if(quietFraction>.7&&rms>=.0003)issues.push({id:'sparse',title:'Mostly quiet audio',tip:'Check that the recording contains the conversation and trim long empty sections.'});
  if(p20>.025&&p90/Math.max(p20,.00001)<3)issues.push({id:'steady',title:'Possible steady background sound',tip:'Listen for persistent noise or music. A quieter recording may improve transcription.'});
  return {duration,rmsDb:Math.round(db),peak,clippedPercent:Math.round(clipFraction*1000)/10,quietPercent:Math.round(quietFraction*100),issues,blocked:rms<.0003,status:issues.length?'Review recording quality':'Basic audio checks passed',limitation:'Signal-level checks only. These do not measure understanding or reliably separate speech from noise. Audio quality never increases the scam score.'};
}
