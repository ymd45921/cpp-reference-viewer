(function(){
  const ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/></svg>';
  const ICON_FILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

  const qs = new URLSearchParams(location.search);
  const ls = window.localStorage;
  const view = (qs.get('view') || ls.getItem('dir:view') || 'list');
  const group = (qs.get('group') || ls.getItem('dir:group') || 'false') === 'true';
  const path = qs.get('path') || location.pathname.replace(/^\/wiki\//,'');
  const titleEl = document.getElementById('title');
  const content = document.getElementById('content');
  const btnList = document.getElementById('btn-list');
  const btnGrid = document.getElementById('btn-grid');
  const btnGroup = document.getElementById('btn-group');
  const groupState = document.getElementById('group-state');

  function setActive(v, g){
    btnList.classList.toggle('active', v==='list');
    btnGrid.classList.toggle('active', v==='grid');
    groupState.textContent = g ? '开' : '关';
  }

  function ico(isDir){ const span = document.createElement('span'); span.className='ico'; span.innerHTML=isDir?ICON_FOLDER:ICON_FILE; return span }
  function item(isDir, name, relPath){
    const href = '/wiki/' + relPath;
    if(currentView==='list'){
      const a = document.createElement('a'); a.href=href; a.className='item';
      a.append(ico(isDir));
      const nm=document.createElement('div'); nm.className='name'; nm.textContent=name+(isDir?'/':'');
      const pt=document.createElement('div'); pt.className='path'; pt.textContent='/'+(relPath.split('/').slice(0,-1).join('/')||'');
      a.append(nm, pt); return a;
    } else {
      const a = document.createElement('a'); a.href=href; a.className='card';
      const head=document.createElement('div'); head.className='header';
      head.append(ico(isDir));
      const nm=document.createElement('div'); nm.className='name'; nm.textContent=name+(isDir?'/':''); head.append(nm);
      const pt=document.createElement('div'); pt.className='path'; pt.textContent='/'+(relPath.split('/').slice(0,-1).join('/')||'');
      a.append(head, pt); return a;
    }
  }

  function render(list){
    content.innerHTML='';
    content.className = currentView;
    if(currentGroup){
      const folders=list.filter(i=>i.isDir), files=list.filter(i=>!i.isDir);
      function section(title, arr){ if(!arr.length) return; const g=document.createElement('div'); const h=document.createElement('h2'); h.textContent=title; g.append(h);
        const wrap=document.createElement('div'); wrap.className=currentView;
        arr.forEach(it=> wrap.append(item(it.isDir, it.name, it.relPath)));
        g.append(wrap); content.append(g);
      }
      section('文件夹', folders); section('文件', files);
    } else {
      const wrap=document.createElement('div'); wrap.className=currentView;
      list.forEach(it=> wrap.append(item(it.isDir, it.name, it.relPath)));
      content.append(wrap);
    }
  }

  let currentView = (view==='grid'?'grid':'list');
  let currentGroup = !!group;
  setActive(currentView, currentGroup);
  titleEl.textContent = 'Index of /' + (path||'');

  fetch('/api/dir?path=' + encodeURIComponent(path||''))
    .then(r=>r.json())
    .then(data=>{ render(data||[]) })
    .catch(()=>{ render([]) });

  btnList.addEventListener('click', ()=>{ currentView='list'; ls.setItem('dir:view','list'); setActive(currentView, currentGroup); renderLast() });
  btnGrid.addEventListener('click', ()=>{ currentView='grid'; ls.setItem('dir:view','grid'); setActive(currentView, currentGroup); renderLast() });
  btnGroup.addEventListener('click', ()=>{ currentGroup=!currentGroup; ls.setItem('dir:group', String(currentGroup)); setActive(currentView, currentGroup); renderLast() });

  let lastData=[]; function renderLast(){ render(lastData) }
  // keep last data when loaded
  fetch('/api/dir?path=' + encodeURIComponent(path||''))
    .then(r=>r.json())
    .then(data=>{ lastData=data||[]; renderLast() })
    .catch(()=>{});
})();