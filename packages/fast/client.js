window.__ModuleLoader__.load({ id: '@delthin/dsh-fast', factory: require => {
  const React = require('react');
  const h = React.createElement;
  const { useState, useEffect, useRef, useId, useSyncExternalStore } = React;
  const dictionaries = {
    zh: { model:'模型', tier:'速度', standard:'标准', fast:'Fast', search:'搜索模型', reasoning:'推理等级', providerDefault:'供应商默认', defaultEffort:'默认', loading:'正在加载…', retry:'重试', fixed:'角色档位在启动时固定', scope:'仅当前会话；下一次请求生效', unsupported:'此供应商尚未配置 Fast 通道', empty:'没有匹配的模型', close:'关闭模型选择器', back:'返回档位设置', changeModel:'切换模型', turnOn:'切到 Fast', turnOff:'切到标准', reset:'恢复默认推理等级', noReasoning:'此模型没有可调推理等级', off:'关闭', minimal:'极低', low:'低', medium:'中', high:'高', xhigh:'极高', max:'最高' },
    en: { model:'Model', tier:'Speed', standard:'Standard', fast:'Fast', search:'Search models', reasoning:'Reasoning', providerDefault:'Provider default', defaultEffort:'Default', loading:'Loading…', retry:'Retry', fixed:'Role tier is fixed at spawn', scope:'This session only; applies to the next request', unsupported:'Fast route is not configured for this provider', empty:'No matching models', close:'Close model picker', back:'Back to settings', changeModel:'Change model', turnOn:'Switch to Fast', turnOff:'Switch to Standard', reset:'Reset reasoning to default', noReasoning:'No adjustable reasoning level', off:'Off', minimal:'Minimal', low:'Low', medium:'Medium', high:'High', xhigh:'Extra high', max:'Max' },
  };
  const css = `
.df-trigger{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:300px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:6px 8px;border-radius:7px;cursor:pointer}
.df-trigger-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.df-trigger-effort{opacity:.8;white-space:nowrap}.df-icon{width:16px;height:16px;flex:none}.df-trigger .df-icon{width:13px;height:13px}.df-fast{color:var(--dsw-alias-label-link)}
.df-trigger:hover,.df-icon-button:hover,.df-model-button:hover,.df-row:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.df-picker{box-sizing:border-box;position:fixed;inset:auto;margin:0;width:254px;max-width:calc(100vw - 24px);max-height:var(--df-available-height,80vh);padding:0;border:0;border-radius:16px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 6px 28px #00000026,0 1px 4px #00000014;font:13px/1.5 var(--dsw-font-family);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l1) transparent}
.df-picker:popover-open{display:flex;flex-direction:column}.df-picker *{box-sizing:border-box}.df-picker button,.df-picker input{font:inherit;color:inherit}.df-picker button{cursor:pointer}.df-picker button:disabled{opacity:.45;cursor:default}.df-picker :focus-visible,.df-trigger:focus-visible{outline:2px solid var(--dsw-alias-label-link);outline-offset:2px}.df-picker ::selection{background:var(--dsw-alias-interactive-bg-hover)}
.df-control{padding:4px}.df-controls-top{position:relative;display:flex;align-items:center;justify-content:center;min-height:36px;padding:0 32px}.df-tier,.df-reset{position:absolute;top:0;display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary)!important}.df-tier{left:0}.df-reset{right:0}.df-tier[aria-pressed=true]{color:var(--dsw-alias-label-link)!important}.df-tier:hover:not(:disabled),.df-reset:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.df-effort-title{display:block;text-align:center;font-size:14px;font-weight:500;line-height:20px;white-space:nowrap}.df-icon-button{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary)!important}
.df-model-button{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;max-width:100%;min-height:32px;margin:0;padding:4px;border:0;border-radius:8px;background:transparent}.df-model-summary{display:flex;align-items:center;justify-content:center;gap:2px;max-width:100%;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary)}.df-model-summary>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.df-model-summary .df-icon{width:12px;height:12px}
.df-slider-view{display:grid;align-items:center;min-height:40px;padding:4px 0}.df-slider-container{height:32px;margin:0 2px;padding:2px 6px}.df-slider{position:relative;display:flex;align-items:center;width:100%;height:28px;touch-action:none;user-select:none;cursor:pointer;outline:none;border-radius:14px}.df-slider[aria-disabled=true]{opacity:.5;cursor:default}.df-slider[data-dragging=true]{cursor:grabbing}.df-track{position:relative;width:100%;height:24px;overflow:hidden;border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l1)}.df-fill{position:absolute;inset:0 auto 0 0;width:var(--df-position);background:var(--dsw-alias-label-link)}.df-tick{position:absolute;top:50%;width:4px;height:4px;border-radius:50%;transform:translate(-50%,-50%);background:color-mix(in srgb,var(--dsw-alias-label-secondary) 50%,transparent);pointer-events:none}.df-tick[data-selected=true]{background:#ffffff80}.df-thumb{position:absolute;left:var(--df-position);top:50%;width:28px;height:28px;transform:translate(-50%,-50%);border:.5px solid var(--dsw-alias-border-l1);border-radius:50%;background:var(--dsw-alias-bg-base);box-shadow:0 0 2px #0000001a;cursor:grab}.df-thumb::before{content:'';position:absolute;inset:-3px;border-radius:50%}.df-slider[data-dragging=true] .df-thumb{cursor:grabbing}.df-slider:focus-visible{outline:none}.df-slider:focus-visible .df-thumb{outline:2px solid var(--dsw-alias-label-link);outline-offset:0}.df-hint{margin:4px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}.df-no-reasoning{text-align:center;margin:4px 0;color:var(--dsw-alias-label-secondary);font-size:12px}
.df-catalog{display:flex;flex-direction:column;min-height:0}.df-catalog-top{display:flex;align-items:center;gap:5px;padding:10px 10px 6px}.df-catalog-top strong{font-weight:600;flex:1}.df-search-wrap{display:flex;align-items:center;gap:7px;margin:0 12px 8px;padding:7px 8px;background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;color:var(--dsw-alias-label-secondary)}.df-search{width:100%;min-width:0;border:0;background:transparent;padding:0;outline:none!important;caret-color:var(--dsw-alias-label-link);font-size:12px!important}.df-search-wrap:focus-within{outline:2px solid var(--dsw-alias-label-link);outline-offset:1px}.df-search::placeholder{color:var(--dsw-alias-label-secondary)}
.df-models{overflow:auto;overscroll-behavior:contain;min-height:48px;max-height:310px;padding:0 6px 8px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l1) transparent}.df-group{font-size:11px;color:var(--dsw-alias-label-secondary);padding:10px 10px 4px}.df-row{display:flex;width:100%;gap:10px;align-items:center;text-align:left;border:0;border-radius:7px;padding:8px 10px;background:transparent;min-height:36px}.df-row>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.df-row[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover)}.df-row .df-icon{color:var(--dsw-alias-label-primary)}.df-empty{padding:12px;color:var(--dsw-alias-label-secondary);font-size:12px}.df-error{margin:0 12px 12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;overflow-wrap:anywhere}.df-retry{border:0;background:transparent;text-decoration:underline;text-underline-offset:3px;color:var(--dsw-alias-label-link)!important;padding:3px}
@media(max-width:480px){.df-trigger{max-width:220px}.df-trigger-effort{display:none}.df-picker{max-width:calc(100vw - 24px)}}
`;
  function Icon({ name, className = '' }) {
    const paths = { bolt:'m13 2-9 12h7l-1 8 10-12h-7l0-8Z', down:'m6 9 6 6 6-6', right:'m9 5 7 7-7 7', back:'m14 6-6 6 6 6', close:'m6 6 12 12M6 18 18 6', reset:'M3 10a9 9 0 1 1 2 8M3 4v6h6', check:'m5 12 4 4L19 6', search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0' };
    return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,className:'df-icon '+className},h('path',{d:paths[name]}));
  }
  async function api(sessionId, action, fast) {
    const response = await fetch('/api/fast', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({sessionId,action,fast}) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Fast request failed');
    return value;
  }
  // Codex's power control: continuous thumb position, rounded effort preview,
  // commit on release. 28px thumb with 13px endpoint inset (28 / 2 - 1).
  function EffortSlider({ options, index, disabled, active, label, nameOf, onPreview, onCommit }) {
    const [position,setPosition] = useState(null);
    const drag = useRef(null), pending = useRef(false);
    const max = options.length-1;
    const clamp = value => Math.max(0,Math.min(max,value));
    const value = position ?? index;
    const nearest = Math.round(value);
    const offset = value => `calc(${value/max*100}% + ${13-value/max*26}px)`;
    const preview = value => { setPosition(value);onPreview(Math.round(value)); };
    const cancel = () => { drag.current=null;setPosition(null);onPreview(null); };
    useEffect(() => { if (!active || (disabled&&!pending.current)) cancel(); },[active,disabled]);
    const commit = async next => {
      drag.current=null;
      if(next===index) { cancel();return; }
      pending.current=true;preview(next);
      try { await onCommit(options[next]); }
      finally { pending.current=false;setPosition(null);onPreview(null); }
    };
    const pointValue = (event,state) => clamp((event.clientX-state.left-state.offset)/state.width*max);
    return h('div',{className:'df-slider-view'},h('div',{className:'df-slider-container'},h('div',{
      className:'df-slider',role:'slider',tabIndex:disabled?-1:0,'aria-label':label,'aria-orientation':'horizontal','aria-valuemin':0,'aria-valuemax':max,'aria-valuenow':nearest,'aria-valuetext':nameOf(options[nearest]),'aria-disabled':disabled,
      'data-dragging':drag.current!==null,style:{'--df-position':offset(value)},
      onPointerDown:event=>{
        if(disabled||pending.current||event.button!==0||!event.isPrimary||drag.current) return;
        event.preventDefault();event.currentTarget.focus();
        const rect=event.currentTarget.getBoundingClientRect(),left=rect.left+13,width=Math.max(1,rect.width-26);
        const thumb=event.target.closest('.df-thumb');
        const state={id:event.pointerId,left,width,offset:thumb?event.clientX-left-index/max*width:0,value:index};
        drag.current=state;event.currentTarget.setPointerCapture(event.pointerId);
        state.value=pointValue(event,state);preview(state.value);
      },
      onPointerMove:event=>{
        const state=drag.current;if(!state||state.id!==event.pointerId) return;
        state.value=pointValue(event,state);preview(state.value);
      },
      onPointerUp:event=>{
        const state=drag.current;if(!state||state.id!==event.pointerId) return;
        const next=Math.round(pointValue(event,state));drag.current=null;
        event.currentTarget.releasePointerCapture(event.pointerId);void commit(next);
      },
      onPointerCancel:cancel,onLostPointerCapture:()=>{if(drag.current) cancel();},
      // A host feature or skin can move focus back to the composer while the pointer
      // is still down (claude-style's composer restyle does this on pointerdown).
      // Pointer capture keeps the stream alive, so only cancel once capture is gone.
      onBlur:event=>{const state=drag.current;if(state&&!event.currentTarget.hasPointerCapture(state.id)) cancel();},
      onKeyDown:event=>{
        if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();cancel();return;}
        if(disabled||pending.current||drag.current) return;
        let next;
        if(event.key==='ArrowRight'||event.key==='ArrowUp') next=clamp(index+1);
        if(event.key==='ArrowLeft'||event.key==='ArrowDown') next=clamp(index-1);
        if(event.key==='Home') next=0;if(event.key==='End') next=max;
        if(next!==undefined){event.preventDefault();event.stopPropagation();void commit(next);}
      }
    },h('div',{className:'df-track','aria-hidden':true},h('div',{className:'df-fill'}),options.map((option,i)=>h('span',{key:option.id,className:'df-tick','data-selected':i<=nearest,style:{left:offset(i)}}))),h('span',{className:'df-thumb','aria-hidden':true}))));
  }
  function Picker({ ctx, sessionId, locked }) {
    const directory = ctx.modelDirectories.directoryFor(sessionId);
    const data = useSyncExternalStore(directory.store.subscribe, directory.store.getSnapshot);
    useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot());
    const t = ctx.locale.bind('dsh-fast');
    const [tier,setTier] = useState(null), [error,setError] = useState(''), [saving,setSaving] = useState(false), [query,setQuery] = useState('');
    const [view,setView] = useState('controls'), [expanded,setExpanded] = useState(false), [previewIndex,setPreviewIndex] = useState(null);
    const popup = useRef(null), trigger = useRef(null), search = useRef(null), modelButton = useRef(null), generation = useRef(0), acting = useRef(false);
    const id = useId();
    const current = data.current;
    const group = data.groups.find(g => g.id === current?.provider);
    const selected = group?.models.find(m => m.id === current?.model);
    const fixed = tier?.locked || locked;
    const supported = tier?.configured === true && current?.provider === tier?.provider;
    const busy = saving || data.status === 'selecting';
    const effortName = effort => effort.id==='' ? t('defaultEffort') : ['off','minimal','low','medium','high','xhigh','max'].includes(effort.id) ? t(effort.id) : effort.name;
    const efforts = selected?.reasoning ? [...(!selected.reasoning.defaultEffort ? [{id:'',name:t('providerDefault')}] : []),...selected.reasoning.efforts] : [];
    const effortId = current?.reasoningEffort || selected?.reasoning?.defaultEffort || '';
    const effortIndex = Math.max(0,efforts.findIndex(e=>e.id===effortId));
    const currentEffort = efforts[effortIndex];
    async function refresh() {
      const sequence = ++generation.current;
      try { const value = await api(sessionId,'get'); if (sequence === generation.current) { setTier(value);setError(''); } }
      catch (e) { if (sequence === generation.current) setError(e.message); }
    }
    useEffect(() => {
      setTier(null);refresh();directory.load().catch(e => setError(e.message));
      const focus = () => refresh();window.addEventListener('focus',focus);
      return () => { generation.current++;window.removeEventListener('focus',focus); };
    },[sessionId]);
    useEffect(() => { if(view==='models'&&expanded) search.current?.focus(); },[view,expanded]);
    const act = async fn => {
      if(acting.current) return;
      acting.current=true;setSaving(true);setError('');
      try { await fn(); } catch(e) { setError(e.message); }
      finally { acting.current=false;setSaving(false); }
    };
    const chooseTier = fast => act(async () => { generation.current++;setTier(await api(sessionId,'set',fast)); });
    const showControls = () => { setView('controls');requestAnimationFrame(()=>modelButton.current?.focus()); };
    const chooseModel = (g,m) => act(async () => {
      const effort = g.id === current?.provider && m.id === current?.model ? current.reasoningEffort : m.reasoning?.defaultEffort;
      const result = await directory.select({provider:g.id,model:m.id,...effort?{reasoningEffort:effort}:{}});
      if (!result.ok) throw new Error(result.error?.message || 'Model selection failed');
      showControls();
    });
    const chooseEffort = effort => act(async () => {
      const {reasoningEffort,...selection}=current;
      const result=await directory.select({...selection,...effort.id?{reasoningEffort:effort.id}:{}});
      if(!result.ok) throw new Error(result.error?.message||'Selection failed');
    });
    const close = () => { popup.current.hidePopover();trigger.current.focus(); };
    const open = () => {
      if(popup.current.matches(':popover-open')) { close();return; }
      const rect = trigger.current.getBoundingClientRect();
      const above = rect.top-20, below = window.innerHeight-rect.bottom-20;
      popup.current.style.right = Math.max(12,Math.min(window.innerWidth-rect.right,window.innerWidth-Math.min(254,window.innerWidth-24)-12))+'px';
      popup.current.style.bottom = above>=below ? Math.max(12,window.innerHeight-rect.top+8)+'px' : 'auto';
      popup.current.style.top = above>=below ? 'auto' : rect.bottom+8+'px';
      popup.current.style.setProperty('--df-available-height',Math.max(100,Math.max(above,below))+'px');
      setView('controls');setQuery('');popup.current.showPopover();setExpanded(true);
      refresh();directory.load().catch(e=>setError(e.message));
      requestAnimationFrame(()=>modelButton.current?.focus({preventScroll:true}));
    };
    const groups = data.groups.map(g=>({...g,models:g.models.filter(m=>(m.name+' '+m.id+' '+g.name).toLowerCase().includes(query.toLowerCase()))})).filter(g=>g.models.length);
    const iconButton = (icon,label,action) => h('button',{type:'button',className:'df-icon-button','aria-label':label,title:label,onClick:action},h(Icon,{name:icon}));
    const statusHint = fixed ? t('fixed') : tier&&!supported ? t('unsupported') : '';
    return h(React.Fragment,null,
      h('button',{ref:trigger,className:'df-trigger','data-session-id':sessionId,type:'button',onClick:open,'aria-label':t('model'),'aria-haspopup':'dialog','aria-expanded':expanded,'aria-controls':id},
        tier?.fast&&h(Icon,{name:'bolt',className:'df-fast'}),h('span',{className:'df-trigger-name'},selected?.name || current?.model || t('model')),
        currentEffort&&effortId&&h('span',{className:'df-trigger-effort'},effortName(currentEffort)),h(Icon,{name:'down'})),
      h('div',{ref:popup,id,popover:'auto',role:'dialog','aria-label':t('model'),className:'df-picker',onToggle:e=>setExpanded(e.newState==='open'),onKeyDown:e=>{
        if(e.key==='Escape') { e.preventDefault();e.stopPropagation();view==='models'?showControls():close(); }
      }},
        view==='controls' ? h('div',{className:'df-control'},
          h('div',{className:'df-controls-top'},
            h('button',{className:'df-tier',type:'button','aria-label':t('tier')+': '+t(tier?.fast?'fast':'standard'),'aria-pressed':tier?.fast===true,disabled:busy||!tier||fixed||(!supported&&!tier.fast),title:statusHint||t(tier?.fast?'turnOff':'turnOn')+' · '+t('scope'),onClick:()=>chooseTier(!tier.fast)},h(Icon,{name:'bolt'})),
            h('button',{ref:modelButton,type:'button',className:'df-model-button','aria-label':t('changeModel'),'aria-expanded':false,disabled:busy||fixed,onClick:()=>setView('models')},
              h('span',{className:'df-effort-title'},currentEffort?effortName(efforts[previewIndex]||currentEffort):t('model')),
              h('span',{className:'df-model-summary'},h('span',null,selected?.name||current?.model||t('loading')),h(Icon,{name:'right'}))),
            h('button',{type:'button',className:'df-reset','aria-label':t('reset'),title:t('reset'),disabled:busy||fixed||!currentEffort,onClick:()=>chooseEffort({id:selected?.reasoning?.defaultEffort||''})},h(Icon,{name:'reset'}))),
          efforts.length>1 ? h(EffortSlider,{key:current?.provider+'/'+current?.model+'/'+efforts.map(e=>e.id).join(','),options:efforts,index:effortIndex,disabled:busy||fixed,active:expanded,label:t('reasoning'),nameOf:effortName,onPreview:setPreviewIndex,onCommit:chooseEffort})
            : h('p',{className:'df-no-reasoning'},t('noReasoning')),
          statusHint&&h('p',{className:'df-hint'},statusHint))
        : h('div',{className:'df-catalog'},
          h('div',{className:'df-catalog-top'},iconButton('back',t('back'),showControls),h('strong',null,t('model')),iconButton('close',t('close'),close)),
          h('div',{className:'df-search-wrap'},h(Icon,{name:'search'}),h('input',{ref:search,className:'df-search',type:'search',value:query,placeholder:t('search'),'aria-label':t('search'),onChange:e=>setQuery(e.target.value)})),
          h('div',{className:'df-models'},data.status==='loading'&&!data.groups.length?h('p',{className:'df-empty'},t('loading')):groups.length?groups.map(g=>h('div',{key:g.id},h('div',{className:'df-group'},g.name),g.models.map(m=>h('button',{key:m.id,type:'button',className:'df-row',disabled:busy||fixed||(tier?.fast&&g.id!==tier.provider),title:tier?.fast&&g.id!==tier.provider?t('unsupported'):undefined,'aria-pressed':g.id===current?.provider&&m.id===current?.model,onClick:()=>chooseModel(g,m)},h('span',null,m.name),g.id===current?.provider&&m.id===current?.model&&h(Icon,{name:'check'}))))):h('p',{className:'df-empty'},t('empty')))),
        (error||data.error||data.failures.length>0)&&h('div',{role:'alert',className:'df-error'},error||data.error||data.failures.map(f=>f.name+': '+f.message).join('; '),' ',h('button',{className:'df-retry',type:'button',onClick:()=>{refresh();directory.load().catch(e=>setError(e.message));}},t('retry')))
      )
    );
  }
  return { inject:['slots','locale','modelDirectories','remote','remote.session','sessions'], apply(ctx) {
    ctx.effect(()=>ctx.locale.register('dsh-fast',dictionaries));
    const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);ctx.effect(()=>()=>style.remove());
    ctx.slots.inject('conversation.input.model',()=>ctx.slots.register({name:'conversation.input.model',priority:-100},props=>h(Picker,{...props,ctx,key:props.sessionId})));
  }};
}});
