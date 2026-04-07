import "../css/style.css";
if (typeof html2pdf === 'undefined') document.body.innerHTML = '<div style="padding:40px;text-align:center;color:red">⚠️ Не удалось загрузить библиотеку PDF. Проверьте интернет.</div>';
let rooms = [], editingId = null, roomUid = 0, currentCalc = null;
let corrections = { globalMm: 3, perRoomMm: 0, enabled: true };
let pdfData = { blob: null, name: '', pendingAction: null };

document.addEventListener('DOMContentLoaded', () => { 
  loadSettings(); loadTheme();
  document.getElementById('measDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('corrToggle').checked = true;
  toggleCorrection(); addRoom(); renderHistory(); filterForCost(); 
});

function toggleTheme(){document.body.classList.toggle('dark');const d=document.body.classList.contains('dark');document.getElementById('themeBtn').textContent=d?'☀️':'🌙';localStorage.setItem('darkMode',d?'1':'0');}
function loadTheme(){if(localStorage.getItem('darkMode')==='1'){document.body.classList.add('dark');document.getElementById('themeBtn').textContent='☀️';}else{document.body.classList.remove('dark');document.getElementById('themeBtn').textContent='🌙';}}

function switchTab(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(id).classList.add('active');const m={pageMeasurements:0,pageCost:1,pageHistory:2,pageSettings:3};if(m[id]!==undefined)document.querySelectorAll('.nav-btn')[m[id]].classList.add('active');if(id==='pageHistory')renderHistory();if(id==='pageCost')showCostList();}

function addRoom(n='',a='',l=''){roomUid++;rooms.push({id:`r_${Date.now()}_${roomUid}`,name:n||`Комната ${rooms.length+1}`,area:a,layer:l});renderRooms();recalcSummary();}
function removeRoom(id){if(rooms.length<=1)return showToast('⚠️ Нужна хотя бы одна комната');rooms=rooms.filter(r=>r.id!==id);renderRooms();recalcSummary();}
function updateRoom(id,f,v){const r=rooms.find(x=>x.id===id);if(r){r[f]=v;const el=document.getElementById(`res-${id}`);if(el){const a=parseFloat(r.area)||0,l=getEff(parseFloat(r.layer)||0);el.textContent=(a>0&&l>0)?`Итог: ${a} × ${l} = ${(a*l).toFixed(2)}`:'';}recalcSummary();}}
function renderRooms(){const c=document.getElementById('roomsContainer');c.innerHTML=rooms.map((r,i)=>{const a=parseFloat(r.area)||0,l=getEff(parseFloat(r.layer)||0);const res=(a>0&&l>0)?`Итог: ${a} × ${l} = ${(a*l).toFixed(2)}`:'';return `<div class="room-card"><div class="room-header"><span class="room-number">${i+1}</span><button class="btn-remove" onclick="removeRoom('${r.id}')">✕</button></div><div class="room-fields"><div class="field-group"><label>Название</label><input type="text" value="${r.name}" oninput="updateRoom('${r.id}','name',this.value)"></div><div class="field-group"><label>Площадь (м²)</label><input type="number" step="0.01" min="0" value="${r.area}" oninput="updateRoom('${r.id}','area',this.value)"></div><div class="field-group"><label>Слой (см)</label><input type="number" step="0.1" min="0" value="${r.layer}" oninput="updateRoom('${r.id}','layer',this.value)"></div></div><div class="room-result" id="res-${r.id}">${res}</div></div>`;}).join('');}
function toggleCorrection(){corrections.enabled=document.getElementById('corrToggle').checked;document.querySelectorAll('.correction-grid input').forEach(i=>i.disabled=!corrections.enabled);recalcSummary();}
function applyCorrections(){corrections.globalMm=parseFloat(document.getElementById('corrGlobalMm').value)||0;corrections.perRoomMm=parseFloat(document.getElementById('corrPerRoomMm').value)||0;recalcSummary();}
function getEff(baseCm,corr){const c=corr||corrections;if(!c.enabled)return baseCm;return baseCm+(c.globalMm/10)+(c.perRoomMm/10);}
function recalcSummary(){let ta=0,w=0;rooms.forEach(r=>{const a=parseFloat(r.area)||0,l=getEff(parseFloat(r.layer)||0);if(a>0){ta+=a;w+=(a*l);}});const avg=ta>0?w/ta:0,vol=ta*(avg/100);document.getElementById('totalArea').textContent=ta.toFixed(2)+' м²';document.getElementById('avgLayer').textContent=avg.toFixed(2)+' см';document.getElementById('totalVolume').textContent=vol.toFixed(3)+' м³';document.getElementById('totalIndex').textContent=w.toFixed(2);}

function saveMeasurement(){const addr=document.getElementById('addressInput').value.trim(),dt=document.getElementById('measDate').value,cl=document.getElementById('clientName').value.trim();if(!addr)return showToast('⚠️ Введите адрес');if(rooms.filter(r=>parseFloat(r.area)>0).length===0)return showToast('⚠️ Заполните площадь');let ta=0,w=0;rooms.forEach(r=>{const a=parseFloat(r.area)||0,l=getEff(parseFloat(r.layer)||0);if(a>0){ta+=a;w+=(a*l);}});const data={id:editingId||'m_'+Date.now(),address:addr,client:cl,date:dt,rooms:JSON.parse(JSON.stringify(rooms)),totalArea:ta,avgLayer:ta>0?w/ta:0,corrections:{...corrections},savedAt:new Date().toISOString()};let db=getDB();if(editingId){const i=db.findIndex(m=>m.id===editingId);if(i!==-1)db[i]=data;editingId=null;document.getElementById('editIndicator').classList.remove('visible');}else db.push(data);localStorage.setItem('screed_final',JSON.stringify(db));showToast('✅ Сохранено');clearForm();}
function getDB(){return JSON.parse(localStorage.getItem('screed_final')||'[]');}
function loadMeasurement(id){const m=getDB().find(x=>x.id===id);if(!m)return;editingId=m.id;document.getElementById('addressInput').value=m.address;document.getElementById('clientName').value=m.client||'';document.getElementById('measDate').value=m.date||new Date().toISOString().split('T')[0];rooms=JSON.parse(JSON.stringify(m.rooms));corrections=m.corrections||{globalMm:0,perRoomMm:0,enabled:false};document.getElementById('corrGlobalMm').value=corrections.globalMm;document.getElementById('corrPerRoomMm').value=corrections.perRoomMm;document.getElementById('corrToggle').checked=corrections.enabled;toggleCorrection();renderRooms();recalcSummary();document.getElementById('editIndicator').classList.add('visible');switchTab('pageMeasurements');showToast('✏️ Загружено');}
function deleteMeasurement(id){if(!confirm('Удалить замер?'))return;localStorage.setItem('screed_final',JSON.stringify(getDB().filter(m=>m.id!==id)));renderHistory();filterForCost();showToast('🗑 Удалено');}
function clearForm(){document.getElementById('addressInput').value='';document.getElementById('clientName').value='';document.getElementById('measDate').value=new Date().toISOString().split('T')[0];rooms=[];editingId=null;corrections={globalMm:3,perRoomMm:0,enabled:true};document.getElementById('corrGlobalMm').value=3;document.getElementById('corrPerRoomMm').value=0;document.getElementById('corrToggle').checked=true;toggleCorrection();document.getElementById('editIndicator').classList.remove('visible');addRoom();}

function renderHistory(){const db=getDB(),list=document.getElementById('savedList'),emp=document.getElementById('emptyState');if(db.length===0){list.innerHTML='';emp.style.display='block';return;}emp.style.display='none';list.innerHTML=db.map(m=>{const c=m.corrections||{globalMm:0,perRoomMm:0,enabled:false};const hint=c.enabled?` • 🔧 ${c.globalMm>0?'+':''}${c.globalMm}/${c.perRoomMm>0?'+':''}${c.perRoomMm}мм`:'';return `<li class="saved-item"><div class="saved-address">📍 ${m.address}</div><div class="saved-client">👤 ${m.client||'Не указан'}</div><div class="saved-meta">${m.date||''} · ${m.rooms.length} комн. · ${m.totalArea.toFixed(1)} м² · ${m.avgLayer.toFixed(1)} см${hint}</div><div class="saved-actions"><button class="btn-edit" onclick="loadMeasurement('${m.id}')">✏️ Изменить</button><button class="btn-calc" onclick="window.calcFromArchive('${m.id}')">💰 Расчёт</button><button class="btn-pdf-m" onclick="showMeasPDFModal('${m.id}')">📄 Лист замера</button><button class="btn-del" onclick="deleteMeasurement('${m.id}')">🗑</button></div></li>`;}).join('');}

window.calcFromArchive = function(id){switchTab('pageCost');document.getElementById('costSearchBlock').style.display='none';document.getElementById('costList').style.display='none';document.getElementById('costResult').style.display='none';setTimeout(()=>calculateCost(id),200);};
function showCostList(){document.getElementById('costSearchBlock').style.display='block';document.getElementById('costList').style.display='block';document.getElementById('costResult').style.display='none';document.getElementById('searchCost').value='';filterForCost();}
function filterForCost(){const q=document.getElementById('searchCost').value.toLowerCase();const db=getDB().filter(m=>(m.address||'').toLowerCase().includes(q)||(m.client||'').toLowerCase().includes(q)||(m.date||'').includes(q));const cont=document.getElementById('costList');if(q.length>0&&db.length===0){cont.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-secondary)">Ничего не найдено</div>';return;}cont.innerHTML=db.map(m=>`<div class="cost-item" id="ci-${m.id}" onclick="calcFromArchive('${m.id}')"><div style="font-weight:600">📍 ${m.address}</div><div style="font-size:12px;color:var(--text-secondary)">👤 ${m.client||'—'} • 📅 ${m.date||'—'} • ${m.totalArea.toFixed(1)} м²</div></div>`).join('');}

function calculateCost(id){if(!id)return showToast('⚠️ Выберите замер');const m=getDB().find(x=>x.id===id);if(!m)return;const s=getSettings(),area=m.totalArea,layer=m.avgLayer;const mixKg=area*layer*s.mixDensity,sandKg=mixKg*(s.ratio/(s.ratio+1)),cemKg=mixKg*(1/(s.ratio+1));const sandB=Math.ceil(sandKg/s.sandBagW),cemB=Math.ceil(cemKg/s.cementBagW),sandC=sandB*s.sandPrice,cemC=cemB*s.cementPrice;const fibKg=(area*s.fiberG)/1000,fibC=fibKg*s.fiberPrice,filmC=area*s.filmPrice,meshC=area*s.meshPrice;const totTons=(sandKg+cemKg)/1000,trips=Math.ceil(totTons/s.truckCap),delC=trips*s.deliveryPrice,liftC=Math.ceil(totTons)*s.liftPrice,labC=area*s.laborPrice;const total=sandC+cemC+fibC+filmC+meshC+delC+liftC+labC,ppm=total/area;currentCalc={m,s,area,layer,total,ppm,sandB,sandC,cemB,cemC,fibKg,fibC,filmC,meshC,totTons,trips,delC,liftC,labC};const box=document.getElementById('costResult');box.style.display='block';box.innerHTML=`<div class="cost-summary"><div class="cost-summary-item"><div class="label">Площадь</div><div class="value">${area.toFixed(2)} м²</div></div><div class="cost-summary-item"><div class="label">Слой</div><div class="value">${layer.toFixed(1)} см</div></div><div class="cost-summary-item"><div class="label">Цена/м²</div><div class="value">${ppm.toFixed(0)} ₽</div></div></div><div class="cost-result"><table class="cost-table"><tr><th>Позиция</th><th>Расчёт</th><th>Сумма</th></tr><tr><td>Песок</td><td>${sandB} меш.</td><td style="text-align:right">${sandC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Цемент</td><td>${cemB} меш.</td><td style="text-align:right">${cemC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Фибра</td><td>${fibKg.toFixed(2)} кг</td><td style="text-align:right">${fibC.toFixed(0)} ₽</td></tr><tr><td>Плёнка</td><td>${area.toFixed(2)} м²</td><td style="text-align:right">${filmC.toFixed(0)} ₽</td></tr><tr><td>Сетка</td><td>${area.toFixed(2)} м²</td><td style="text-align:right">${meshC.toFixed(0)} ₽</td></tr><tr><td>Доставка</td><td>${totTons.toFixed(1)} т → ${trips} рейс.</td><td style="text-align:right">${delC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Подъём</td><td>${Math.ceil(totTons)} т</td><td style="text-align:right">${liftC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Работа</td><td>${area.toFixed(2)} м²</td><td style="text-align:right">${labC.toLocaleString('ru-RU')} ₽</td></tr><tr class="total-row"><td>ИТОГО</td><td></td><td style="text-align:right">${total.toLocaleString('ru-RU')} ₽</td></tr></table><div class="btn-group"><button class="btn btn-secondary" onclick="showCostList()">← Назад к списку</button><button class="btn" style="background:var(--success)" onclick="showCostPDFModal()">📥 Скачать PDF</button></div></div>`;}

function closeModal(){document.getElementById('pdfModal').classList.remove('show');pdfData.pendingAction=null;}

function showMeasPDFModal(id){
  document.getElementById('modalTitle').textContent='📄 Лист замера';
  document.getElementById('modalText').textContent='Нажмите кнопку для создания файла';
  preparePDFData('pdfMeasTpl','pdfMeasCont',`ЛистЗамера_${getDB().find(x=>x.id===id)?.address||'file'}`,id);
}

function showCostPDFModal(){
  if(!currentCalc)return showToast('⚠️ Сначала выполните расчёт');
  document.getElementById('modalTitle').textContent='💰 Коммерческое предложение';
  document.getElementById('modalText').textContent='Нажмите кнопку для создания файла';
  preparePDFData('pdfCostTpl','pdfCostCont',`Расчёт_${currentCalc.m.address||'file'}`);
}

async function preparePDFData(tplId,contId,baseName,id=null){
  const m = id ? getDB().find(x=>x.id===id) : currentCalc?.m;
  if(!m) return;

  if(!id && currentCalc){
     const {s,area,layer,total,ppm,sandB,sandC,cemB,cemC,fibKg,fibC,filmC,meshC,trips,delC,liftC,labC}=currentCalc;
     const docNum = 'КП-' + Math.floor(1000 + Math.random()*9000);
     document.getElementById('pdfCostNum').textContent = docNum;
     document.getElementById('pdfCostDate').textContent = new Date().toLocaleDateString('ru-RU');
     
     document.getElementById('pdfCostStrip').innerHTML = `
       <div class="pdf-info-strip-item"><div class="l">Объект</div><div class="v" style="font-size:11px">${m.address.length>25?m.address.substring(0,25)+'...':m.address}</div></div>
       <div class="pdf-info-strip-item"><div class="l">Площадь</div><div class="v">${area.toFixed(1)} м²</div></div>
       <div class="pdf-info-strip-item"><div class="l">Слой</div><div class="v">${layer.toFixed(1)} см</div></div>
       <div class="pdf-info-strip-item"><div class="l">За м²</div><div class="v" style="color:#4b5563">${ppm.toFixed(0)} ₽</div></div>`;
     
     const totalMixKg = area * layer * s.mixDensity;
     document.getElementById('pdfCostRows').innerHTML=`
        <tr><td>Песок</td><td>${sandB} меш. (${(sandB*s.sandBagW)} кг)</td><td>${s.sandPrice} ₽</td><td style="text-align:right">${sandC.toLocaleString()} ₽</td></tr>
        <tr><td>Цемент</td><td>${cemB} меш. (${(cemB*s.cementBagW)} кг)</td><td>${s.cementPrice} ₽</td><td style="text-align:right">${cemC.toLocaleString()} ₽</td></tr>
        <tr><td>Фиброволокно</td><td>${fibKg.toFixed(1)} кг</td><td>${s.fiberPrice} ₽</td><td style="text-align:right">${fibC.toFixed(0)} ₽</td></tr>
        <tr><td>Плёнка</td><td>${area.toFixed(1)} м²</td><td>${s.filmPrice} ₽</td><td style="text-align:right">${filmC.toFixed(0)} ₽</td></tr>
        <tr><td>Армирующая сетка</td><td>${area.toFixed(1)} м²</td><td>${s.meshPrice} ₽</td><td style="text-align:right">${meshC.toFixed(0)} ₽</td></tr>
        <tr><td>Доставка</td><td>${trips} рейс. (${(totalMixKg/1000).toFixed(1)} т)</td><td>${s.deliveryPrice} ₽</td><td style="text-align:right">${delC.toLocaleString()} ₽</td></tr>
        <tr><td>Подъём материалов</td><td>${Math.ceil(totalMixKg/1000)} т</td><td>${s.liftPrice} ₽</td><td style="text-align:right">${liftC.toLocaleString()} ₽</td></tr>
       <tr style="font-weight:600"><td>Работа (стяжка)</td><td>${area.toFixed(1)} м²</td><td>${s.laborPrice} ₽/м²</td><td style="text-align:right">${labC.toLocaleString()} ₽</td></tr>`;
     
     const totalEl = document.getElementById('pdfCostTotal');
     if(totalEl) totalEl.textContent = total.toLocaleString('ru-RU') + ' ₽';
     document.getElementById('pdfCostGenDate').textContent = new Date().toLocaleString('ru-RU');
  }
  
  if(id){
     document.getElementById('pdfMeasDate').textContent=m.date||new Date().toLocaleDateString('ru-RU');
     document.getElementById('pdfMeasAddr').textContent=m.address;
     document.getElementById('pdfMeasClient').textContent=m.client||'Не указан';
     document.getElementById('pdfMeasArea').textContent=m.totalArea.toFixed(2)+' м²';
     document.getElementById('pdfMeasLayer').textContent=m.avgLayer.toFixed(2)+' см';
     const c=m.corrections||{globalMm:0,perRoomMm:0,enabled:false};
     const cBlock=document.getElementById('pdfMeasCorrection'),cText=document.getElementById('pdfMeasCorrText');
     if(c.enabled&&(c.globalMm!==0||c.perRoomMm!==0)){cBlock.style.display='block';let t='';if(c.globalMm!==0)t+=`Общая поправка: ${c.globalMm>0?'+':''}${c.globalMm} мм. `;if(c.perRoomMm!==0)t+=`К каждой комнате: ${c.perRoomMm>0?'+':''}${c.perRoomMm} мм.`;cText.textContent=t;}else{cBlock.style.display='none';}
     const tb=document.getElementById('pdfMeasRows');tb.innerHTML='';let idx=0;m.rooms.forEach(r=>{const a=parseFloat(r.area)||0,base=parseFloat(r.layer)||0,eff=getEff(base,c);const res=a*eff;idx+=res;if(a>0)tb.innerHTML+=`<tr><td>${r.name}</td><td>${a.toFixed(2)}</td><td>${eff.toFixed(1)}</td><td>${res.toFixed(2)}</td></tr>`;});
     document.getElementById('pdfMeasIndex').textContent=idx.toFixed(2);
     document.getElementById('pdfMeasGenDate').textContent=new Date().toLocaleString('ru-RU');

     const logoArea = document.getElementById('pdfLogoArea');
     const logoUrl = getSettings().logoUrl || '';
     const masterName = getSettings().masterName || '';
     
     if(logoUrl.trim() !== ''){
        if(logoUrl.startsWith('data:image') || logoUrl.startsWith('http')){
          logoArea.innerHTML = `<img src="${logoUrl}" style="max-width:150px; max-height:80px; object-fit:contain;" onerror="this.style.display='none'; console.error('Ошибка загрузки логотипа');">`;
          if(masterName) logoArea.innerHTML += `<div style="font-size:10px; margin-top:2px; font-weight:600;">${masterName}</div>`;
        } else {
          logoArea.innerHTML = `<div style="font-size:12px; font-weight:600; color:#4b5563;">${logoUrl}</div>`;
          if(masterName) logoArea.innerHTML += `<div style="font-size:10px; margin-top:2px;">${masterName}</div>`;
        }
     } else if(masterName){
        logoArea.innerHTML = `<div style="font-size:11px; font-weight:600; text-align:right; margin-bottom:2px;">${masterName}</div><div class="sig-line">Подпись</div>`;
     } else {
        logoArea.innerHTML = '<div class="sig-line">Подпись мастера</div>';
     }
  }

  pdfData.name = `${baseName.replace(/[^a-zA-Zа-яА-Я0-9]/g,'_')}.pdf`;
  document.getElementById('pdfModal').classList.add('show');
  document.getElementById('modalActions').querySelectorAll('button').forEach(b=>b.disabled=true);
  
  showToast('⏳ Формирование PDF...');
  const tpl=document.getElementById(tplId);tpl.style.display='block';
  
  const opt={
    margin: [5, 5, 5, 5], 
    filename: pdfData.name, 
    image:{type:'jpeg',quality:0.98}, 
    html2canvas:{scale:2, useCORS:true, logging:false, scrollY:0, windowWidth:800}, 
    jsPDF:{unit:'mm', format:'a4', orientation:'portrait', compress:true}
  };
  
  try{
     await new Promise(resolve => setTimeout(resolve, 300));
     pdfData.blob = await html2pdf().set(opt).from(document.getElementById(contId)).outputPdf('blob');
     tpl.style.display='none';
     document.getElementById('modalText').textContent = '✅ Файл готов!';
     document.getElementById('modalActions').querySelectorAll('button').forEach(b=>b.disabled=false);
     showToast('✅ PDF сформирован');
  }catch(e){
    console.error('PDF Error:', e);
    tpl.style.display='none';
    showToast('⚠️ Ошибка генерации: ' + e.message);
    closeModal();
  }
}

async function requestStoragePermission() {
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
            const { Permissions } = Capacitor.Plugins;
            const status = await Permissions.request({ permissions: ['storage'] });
            if (status.storage === 'granted') {
                showToast('✅ Разрешение получено');
                return true;
            } else {
                showToast('⚠️ Нет разрешения на сохранение');
                return false;
            }
        } catch(e) {
            console.log('Permissions error:', e);
            return true;
        }
    }
    return true;
}

async function savePDFToDocuments(blob, fileName) {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ PDF скачан');
        return true;
    }
    
    try {
        const { Filesystem, Directory } = Capacitor.Plugins;
        const base64 = await blobToBase64(blob);
        
        await Filesystem.mkdir({
            path: 'Стяжка1',
            directory: Directory.Documents,
            recursive: true
        }).catch(() => {});
        
        await Filesystem.writeFile({
            path: `Стяжка1/${fileName}`,
            data: base64,
            directory: Directory.Documents,
            recursive: true
        });
        
        showToast(`✅ PDF сохранён в Documents/Стяжка1/${fileName}`);
        return true;
    } catch (e) {
        console.error('Save error:', e);
        showToast('⚠️ Не удалось сохранить: ' + e.message);
        return false;
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function startPDF(action) {
    if (!pdfData.blob) {
        showToast('⚠️ PDF ещё не готов');
        return;
    }
    
    if (action === 'download') {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
            action = 'share';
        }
    }
    
    const file = new File([pdfData.blob], pdfData.name, { type: 'application/pdf' });
    
    if (action === 'share') {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: pdfData.name });
                showToast('📤 PDF отправлен');
                closeModal();
                return;
            } catch(e) {
                console.log('Share cancelled or failed:', e);
            }
        }
        await savePDFToDocuments(pdfData.blob, pdfData.name);
        closeModal();
    } 
    else if (action === 'download') {
        await savePDFToDocuments(pdfData.blob, pdfData.name);
        closeModal();
    }
}

function getSettings(){const g=id=>parseFloat(document.getElementById(id).value)||0;const t=id=>document.getElementById(id)?.value||'';return{sandBagW:g('sandBagW'),sandPrice:g('sandPrice'),cementBagW:g('cementBagW'),cementPrice:g('cementPrice'),ratio:g('ratio')||3,mixDensity:g('mixDensity')||20,truckCap:g('truckCap')||5,deliveryPrice:g('deliveryPrice')||4000,liftPrice:g('liftPrice')||800,fiberG:g('fiberG')||50,fiberPrice:g('fiberPrice')||450,filmPrice:g('filmPrice')||25,meshPrice:g('meshPrice')||80,laborPrice:g('laborPrice')||450,logoUrl:t('logoUrl'),masterName:t('masterName')};}
function saveSettings(){['sandBagW','sandPrice','cementBagW','cementPrice','ratio','mixDensity','truckCap','deliveryPrice','liftPrice','fiberG','fiberPrice','filmPrice','meshPrice','laborPrice'].forEach(id=>localStorage.setItem(id,document.getElementById(id).value));localStorage.setItem('logoUrl',document.getElementById('logoUrl').value);localStorage.setItem('masterName',document.getElementById('masterName').value);}
function loadSettings(){['sandBagW','sandPrice','cementBagW','cementPrice','ratio','mixDensity','truckCap','deliveryPrice','liftPrice','fiberG','fiberPrice','filmPrice','meshPrice','laborPrice'].forEach(id=>{if(localStorage.getItem(id))document.getElementById(id).value=localStorage.getItem(id);});if(localStorage.getItem('logoUrl'))document.getElementById('logoUrl').value=localStorage.getItem('logoUrl');if(localStorage.getItem('masterName'))document.getElementById('masterName').value=localStorage.getItem('masterName');}
function clearAllData(){if(!confirm('Удалить ВСЕ данные?'))return;localStorage.clear();location.reload();}
function exportData(){const d={v:'7.1',date:new Date().toISOString(),measurements:getDB(),settings:getSettings()};const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`ScreedBackup_${new Date().toISOString().split('T')[0]}.json`;a.click();showToast('📤 Экспорт готов');}
function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.measurements)localStorage.setItem('screed_final',JSON.stringify(d.measurements));if(d.settings){Object.keys(d.settings).forEach(k=>{if(document.getElementById(k))document.getElementById(k).value=d.settings[k]});saveSettings();}renderHistory();filterForCost();showToast('📥 Импорт успешен');}catch(err){showToast('⚠️ Ошибка файла');}};r.readAsText(f);inp.value='';}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2500);}

// Делаем функции доступными глобально для onclick в HTML
window.addRoom = addRoom;
window.removeRoom = removeRoom;
window.updateRoom = updateRoom;
window.toggleCorrection = toggleCorrection;
window.applyCorrections = applyCorrections;
window.saveMeasurement = saveMeasurement;
window.clearForm = clearForm;
window.loadMeasurement = loadMeasurement;
window.deleteMeasurement = deleteMeasurement;
window.switchTab = switchTab;
window.filterForCost = filterForCost;
window.calcFromArchive = calcFromArchive;
window.showCostList = showCostList;
window.calculateCost = calculateCost;
window.closeModal = closeModal;
window.showMeasPDFModal = showMeasPDFModal;
window.showCostPDFModal = showCostPDFModal;
window.startPDF = startPDF;
window.toggleTheme = toggleTheme;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;
window.showToast = showToast;
