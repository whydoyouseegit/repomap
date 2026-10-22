/* Perspective-projected, interactive 3D point cloud. No remote assets. */
(() => {
  const hash = value => {let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
  const rng = seed => () => {seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  function sphere(r){const z=r()*2-1,a=r()*Math.PI*2,s=Math.sqrt(1-z*z);return [Math.cos(a)*s,z,Math.sin(a)*s];}
  const mix=(a,b,t)=>a+(b-a)*t;
  class Universe {
    constructor(canvas,onSelect,onHover){
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.onSelect=onSelect;this.onHover=onHover;
      this.nodes=[];this.edges=[];this.dust=[];this.groups=[];this.selected=null;this.hovered=null;this.query='';this.layout='universe';
      this.rx=-.13;this.ry=.3;this.zoom=1;this.panX=0;this.panY=0;this.play=!matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.filters={file:true,directory:true,class:true,interface:true,function:true,edges:false,dust:true};
      this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.bind();
      this.last=performance.now();requestAnimationFrame(t=>this.frame(t));
    }
    resize(){const b=this.canvas.getBoundingClientRect();this.w=b.width;this.h=b.height;this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=b.width*this.dpr;this.canvas.height=b.height*this.dpr;this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);}
    setGraph(graph){
      this.graph=graph;this.selected=null;this.hovered=null;this.panX=this.panY=0;this.zoom=1;
      const groupNames=[...new Set(graph.nodes.map(n=>n.group))].sort();
      const centers=new Map(groupNames.map((g,i)=>{const r=rng(hash(g));const a=i*2.399963;const y=groupNames.length===1?0:1-2*(i+.5)/groupNames.length;const s=Math.sqrt(1-y*y);return[g,[Math.cos(a)*s*.8,y*.8,Math.sin(a)*s*.8]];}));
      this.groups=groupNames.map(name=>({name,p:centers.get(name)}));
      const byId=new Map();
      this.nodes=graph.nodes.map(data=>{
        const r=rng(hash(data.id)),v=sphere(r),center=centers.get(data.group)||[0,0,0];
        const radius=.89+r()*.12;
        const universe=v.map(x=>x*radius),cluster=v.map((x,j)=>center[j]+x*(.16+r()*.16));
        const n={data,u:universe,c:cluster,p:universe.slice(),screen:null,seed:r()};byId.set(data.id,n);return n;
      });
      for(const n of this.nodes){
        const parent=byId.get(n.data.parent);
        if(parent && n.data.kind!=='file' && n.data.kind!=='directory'){
          const r=rng(hash(n.data.id+':orbit')),v=sphere(r);n.u=v.map((x,j)=>parent.u[j]+x*.075);n.c=v.map((x,j)=>parent.c[j]+x*.07);n.p=n.u.slice();
        }
      }
      this.byId=byId;this.edges=graph.edges.map(e=>({...e,a:byId.get(e.source),b:byId.get(e.target)})).filter(e=>e.a&&e.b);
      this.dust=[];
      const files=this.nodes.filter(n=>n.data.kind==='file');
      const budget=6500;let count=0;
      for(const n of files){
        const random=rng(hash(n.data.id+':glow'));const amount=Math.min(600,Math.ceil((n.data.lines||0)*20));
        for(let i=0;i<amount&&count<budget;i++,count++){
          const v=sphere(random),spread=n.u.map((x,j)=>x+v[j]*.65),length=Math.hypot(...spread),radius=.93+random()*.12;
          const u=spread.map(x=>x/length*radius),c=n.c.map((x,j)=>x+v[j]*(.035+random()*.12));
          this.dust.push({owner:n,u,c,p:u.slice(),brightness:random(),size:.5+random()*.95});
        }
      }
      this.related=new Set();this.resize();
    }
    select(id){this.selected=id;this.related=new Set([id]);for(const e of this.edges)if(e.source===id||e.target===id){this.related.add(e.source);this.related.add(e.target);} }
    focus(id){const n=this.byId?.get(id);if(!n)return;const p=this.project(n.p);this.panX-=p.x-this.w*.5;this.panY-=p.y-this.h*.53;this.play=false;}
    setLayout(layout){this.layout=layout;this.panX=this.panY=0;}
    reset(){this.rx=-.13;this.ry=.3;this.zoom=1;this.panX=this.panY=0;this.updateZoom?.();}
    zoomBy(factor){this.zoom=Math.max(.35,Math.min(5,this.zoom*factor));this.updateZoom?.();}
    project(v){
      const cy=Math.cos(this.ry),sy=Math.sin(this.ry),cx=Math.cos(this.rx),sx=Math.sin(this.rx);
      const x=v[0]*cy+v[2]*sy,z=-v[0]*sy+v[2]*cy,y=v[1]*cx-z*sx,depth=v[1]*sx+z*cx;
      const perspective=3.7/(3.7-depth),radius=Math.min(this.w*.38,this.h*.32)*this.zoom;
      return{x:this.w*.5+x*radius*perspective+this.panX,y:this.h*.54+y*radius*perspective+this.panY,z:depth,s:perspective,depth:(depth+1.4)/2.8};
    }
    visible(n){return this.filters[n.data.kind]!==false;}
    pick(x,y){let best=null,score=12;for(const n of this.nodes){if(!n.screen||!this.visible(n))continue;const d=Math.hypot(n.screen.x-x,n.screen.y-y);if(d<score){score=d;best=n;}}return best;}
    bind(){
      const c=this.canvas;let drag=null,moved=false;
      c.addEventListener('contextmenu',e=>e.preventDefault());
      c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,pan:e.button===2||e.shiftKey};moved=false;});
      c.addEventListener('pointermove',e=>{
        const rect=c.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
        if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)moved=true;if(drag.pan){this.panX+=dx;this.panY+=dy;}else{this.ry+=dx*.006;this.rx+=dy*.006;}drag.x=e.clientX;drag.y=e.clientY;this.onHover(null);}
        else{const n=this.pick(x,y);this.hovered=n?.data.id||null;c.style.cursor=n?'pointer':'grab';this.onHover(n?.data||null,x,y);}
      });
      c.addEventListener('pointerup',e=>{if(drag&&!moved&&e.button===0){const r=c.getBoundingClientRect(),n=this.pick(e.clientX-r.left,e.clientY-r.top);if(n)this.onSelect(n.data.id);}drag=null;});
      c.addEventListener('pointercancel',()=>drag=null);c.addEventListener('pointerleave',()=>{this.hovered=null;this.onHover(null);});
      c.addEventListener('wheel',e=>{e.preventDefault();this.zoomBy(Math.exp(-e.deltaY*.001));},{passive:false});
      c.addEventListener('dblclick',e=>{const r=c.getBoundingClientRect(),n=this.pick(e.clientX-r.left,e.clientY-r.top);if(n){this.focus(n.data.id);this.updateZoom?.();}});
    }
    frame(now){
      const dt=Math.min(now-this.last,50);this.last=now;
      if(this.play && !document.hidden)this.ry+=dt*.000045;
      if(this.w)this.draw();requestAnimationFrame(t=>this.frame(t));
    }
    draw(){
      const ctx=this.ctx,w=this.w,h=this.h;ctx.fillStyle='#090909';ctx.fillRect(0,0,w,h);
      // Sparse reference marks, intentionally secondary to the point cloud.
      ctx.strokeStyle='#171717';ctx.lineWidth=.5;
      const cross=(x,y)=>{ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke();};
      cross(22,h*.5);cross(w-22,h*.5);cross(w*.5,22);
      const blend=.09;
      for(const n of this.nodes){const target=this.layout==='clusters'?n.c:n.u;for(let j=0;j<3;j++)n.p[j]=mix(n.p[j],target[j],blend);n.screen=this.project(n.p);}
      if(this.filters.dust){
        for(const p of this.dust){
          if(!this.filters.file)continue;
          const n=p.owner,target=this.layout==='clusters'?p.c:p.u;for(let j=0;j<3;j++)p.p[j]=mix(p.p[j],target[j],blend);const s=this.project(p.p);
          let alpha=(.22+s.depth*.65)*(.3+p.brightness*.7);if(this.selected&&!this.related.has(n.data.id))alpha*=.27;
          ctx.fillStyle=`rgba(225,225,225,${Math.min(.8,alpha)})`;const r=p.size*s.s*Math.sqrt(this.zoom);ctx.fillRect(s.x,s.y,r,r);
        }
      }
      for(const e of this.edges){
        const chosen=this.selected&&(e.source===this.selected||e.target===this.selected);
        if(!chosen && !(this.filters.edges&&e.type==='imports'))continue;
        if(!this.visible(e.a)||!this.visible(e.b))continue;
        const a=e.a.screen,b=e.b.screen;
        ctx.strokeStyle=chosen?'rgba(210,210,210,.43)':'rgba(180,180,180,.09)';ctx.lineWidth=chosen?.8:.5;
        if(e.type==='contains')ctx.setLineDash([2,4]);else ctx.setLineDash([]);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2+(b.y-a.y)*.08,(a.y+b.y)/2-(b.x-a.x)*.08,b.x,b.y);ctx.stroke();
        if(e.type==='imports'&&chosen){const ang=Math.atan2(b.y-a.y,b.x-a.x),x=b.x-Math.cos(ang)*7,y=b.y-Math.sin(ang)*7;ctx.beginPath();ctx.moveTo(x-Math.cos(ang-.5)*5,y-Math.sin(ang-.5)*5);ctx.lineTo(x,y);ctx.lineTo(x-Math.cos(ang+.5)*5,y-Math.sin(ang+.5)*5);ctx.stroke();}
      }ctx.setLineDash([]);
      const ordered=this.nodes.slice().sort((a,b)=>a.screen.z-b.screen.z);
      for(const n of ordered){
        if(!this.visible(n))continue;
        const d=n.data,s=n.screen,selected=d.id===this.selected,hover=d.id===this.hovered;
        const match=!this.query||`${d.name} ${d.path}`.toLowerCase().includes(this.query);
        let alpha=Math.min(1,.3+s.depth*.7);if(this.selected&&!this.related.has(d.id))alpha*=.28;if(!match)alpha*=.15;
        const base=d.kind==='directory'?2.7:d.kind==='class'||d.kind==='interface'?2.2:d.kind==='file'?1.7:1;
        let radius=base*s.s*Math.min(1.9,Math.sqrt(this.zoom));if(selected||hover)radius+=1.5;
        ctx.fillStyle=`rgba(232,232,232,${alpha})`;ctx.strokeStyle=`rgba(232,232,232,${alpha})`;
        if(selected||hover){const glow=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,17);glow.addColorStop(0,'rgba(240,240,240,.17)');glow.addColorStop(1,'rgba(240,240,240,0)');ctx.fillStyle=glow;ctx.fillRect(s.x-17,s.y-17,34,34);ctx.fillStyle='#fff';ctx.strokeStyle='#ddd';}
        ctx.beginPath();if(d.kind==='class'||d.kind==='interface'){ctx.moveTo(s.x,s.y-radius*1.5);ctx.lineTo(s.x+radius*1.2,s.y);ctx.lineTo(s.x,s.y+radius*1.5);ctx.lineTo(s.x-radius*1.2,s.y);ctx.closePath();ctx.stroke();}else if(d.kind==='directory'){ctx.strokeRect(s.x-radius,s.y-radius,radius*2,radius*2);}else{ctx.arc(s.x,s.y,radius,0,Math.PI*2);ctx.fill();}
        if(selected){ctx.lineWidth=.7;ctx.beginPath();ctx.arc(s.x,s.y,radius+7,0,Math.PI*2);ctx.stroke();}
        if(selected || (this.selected&&this.related.has(d.id)&&this.related.size<16) || (this.query&&match&&this.nodes.length<600)){
          ctx.font='10px Consolas, monospace';ctx.fillStyle=selected?'#eee':'#929292';ctx.fillText(d.name,s.x+radius+10,s.y+3);
        }
      }
      if(this.layout==='clusters')for(const group of this.groups){const s=this.project(group.p);ctx.font='10px Consolas, monospace';ctx.fillStyle='#717171';ctx.fillText('~/'+group.name,s.x-15,s.y-45*this.zoom);}
    }
  }
  window.Universe=Universe;
})();
