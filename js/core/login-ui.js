// ===== LA ENTRADA (diseño "corporate", pedido del usuario 17 nov 2026) =====
// Lo que hace la pantalla de login nueva (el HTML esta en index.html, los
// estilos en css/login-corp.css, todo dentro de .nxc):
//   - el panel de presentacion: Production / Quality / Laboratory
//   - ingles / español SOLO para esta pantalla (la app sigue en ingles)
//   - claro / oscuro: el mismo boton de tema de la app (toggleDarkMode)
//   - "Remember my username": guarda SOLO el usuario, y solo al entrar bien
//   - las ventanas de ayuda (olvide la contraseña, privacidad, soporte)
// Entrar es lo de siempre: doLogin() en js/core/auth.js lee #login-user y
// #login-pass y escribe los errores en #login-error. La vista "Explore the
// workspace" del diseño NO se trajo: eran cifras inventadas, y en el login no
// van datos ficticios.
(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };
  var lang = 'en', mod = 1, dlg = '', foco = null;

  var T = {
    en:{brandSub:'Production &amp; Quality', headerCaption:'A connected operation. A higher standard.', storyEyebrow:'THE CAPUTO WORKSPACE',
      headline1:'One operation.', headline2:'Every detail.', storyIntro:'Bring your production, quality and people together. From the first check to the final release.',
      workflowPreview:'WORKFLOW PREVIEW', production:'Production', quality:'Quality', laboratory:'Laboratory', qualityCheck:'Quality check', release:'Release',
      connectedProcess:'One connected process', storyFoot:'Built around your team.<br>Designed for a higher standard.', companyType:'Production<br>&amp; Quality Control',
      accessEyebrow:'YOUR WORKSPACE, CONNECTED', welcome:'Welcome back.', formIntro:'Sign in to keep your operation moving.<br>Every team. Every shift. In sync.',
      username:'Username or email', password:'Password', usernamePlaceholder:'Enter your username', passwordPlaceholder:'Enter your password',
      remember:'Remember my username', forgot:'Forgot password?', enter:'Enter workspace', signingIn:'Signing in…',
      accessNote:'Your role. Your tools. One shared standard.', footerCaption:'Made for the way you operate.', privacy:'Privacy &amp; access', support:'Need help?',
      understood:'Got it', showPassword:'Show password', hidePassword:'Hide password', lightTheme:'Switch to light theme', darkTheme:'Switch to dark theme',
      closeDialog:'Close dialog', tabLabel:'Explore workspace modules'},
    es:{brandSub:'Producción &amp; Calidad', headerCaption:'Una operación conectada. Un estándar superior.', storyEyebrow:'EL ESPACIO DE TRABAJO CAPUTO',
      headline1:'Una operación.', headline2:'Cada detalle.', storyIntro:'Conecta la producción, la calidad y a tu equipo. Desde el primer control hasta la liberación final.',
      workflowPreview:'VISTA DEL FLUJO DE TRABAJO', production:'Producción', quality:'Calidad', laboratory:'Laboratorio', qualityCheck:'Control de calidad', release:'Liberación',
      connectedProcess:'Un proceso conectado', storyFoot:'Pensado para tu equipo.<br>Diseñado para un estándar superior.', companyType:'Producción<br>&amp; Control de calidad',
      accessEyebrow:'TU ESPACIO DE TRABAJO, CONECTADO', welcome:'Bienvenido de nuevo.', formIntro:'Ingresa y mantén tu operación en marcha.<br>Cada equipo. Cada turno. En sintonía.',
      username:'Usuario o correo electrónico', password:'Contraseña', usernamePlaceholder:'Ingresa tu usuario', passwordPlaceholder:'Ingresa tu contraseña',
      remember:'Recordar mi usuario', forgot:'¿Olvidaste tu contraseña?', enter:'Entrar al sistema', signingIn:'Entrando…',
      accessNote:'Tu rol. Tus herramientas. Un mismo estándar.', footerCaption:'Diseñado para tu forma de operar.', privacy:'Privacidad y acceso', support:'¿Necesitas ayuda?',
      understood:'Entendido', showPassword:'Mostrar contraseña', hidePassword:'Ocultar contraseña', lightTheme:'Cambiar a tema claro', darkTheme:'Cambiar a tema oscuro',
      closeDialog:'Cerrar ventana', tabLabel:'Explorar módulos del sistema'}
  };
  var MODS = {
    en:[{title:'Keep every line moving.', name:'Your operation, in focus.', sub:'Planning · Production · Line performance', pill:'In sync', icon:'production'},
        {title:'Confidence at every checkpoint.', name:'Every batch, verified.', sub:'Inspections · Traceability · Approvals', pill:'Quality first', icon:'clipboard'},
        {title:'Precision behind every result.', name:'Clear results. Better decisions.', sub:'Samples · Analysis · Specifications', pill:'In control', icon:'flask'}],
    es:[{title:'Cada línea, en movimiento.', name:'Tu operación, bajo control.', sub:'Planeación · Producción · Rendimiento', pill:'En sintonía', icon:'production'},
        {title:'Confianza en cada control.', name:'Cada lote, verificado.', sub:'Inspecciones · Trazabilidad · Aprobaciones', pill:'Calidad primero', icon:'clipboard'},
        {title:'Precisión en cada resultado.', name:'Resultados claros. Mejores decisiones.', sub:'Muestras · Análisis · Especificaciones', pill:'Bajo control', icon:'flask'}]
  };
  // Lo que dicen las ventanas: lo que de verdad pasa en NEXORA (el diseño
  // traia textos de prototipo: "no envia credenciales", que aqui no es cierto)
  var DLG = {
    en:{forgot:{title:'Let’s get you back in.', body:'<p>Contact your site administrator to reset your password or restore access to your workspace.</p>'},
        privacy:{title:'Privacy & workspace access', body:'<p>Your administrator defines what each person can see and do in production, quality and the laboratory, based on their role.</p>'+
          '<p>Your password is checked by the NEXORA sign-in service. This device keeps only what it needs to let you sign in without signal, never your password as written. '+
          'If you select “Remember my username”, only your username is saved in this browser. Your theme and language are also saved here.</p>'},
        support:{title:'Here to keep you moving.', body:'<p>For account access, permissions or help with your operation, contact your site administrator or internal support team.</p>'}},
    es:{forgot:{title:'Recupera tu acceso.', body:'<p>Contacta al administrador de tu planta para restablecer tu contraseña o recuperar el acceso al sistema.</p>'},
        privacy:{title:'Privacidad y acceso', body:'<p>El administrador define lo que cada persona puede ver y hacer en producción, calidad y laboratorio, según su rol.</p>'+
          '<p>Tu contraseña la revisa el servicio de acceso de NEXORA. Este equipo guarda solo lo necesario para dejarte entrar sin señal, nunca tu contraseña tal como la escribes. '+
          'Si eliges “Recordar mi usuario”, solo se guarda tu usuario en este navegador. Tu tema e idioma también se guardan aquí.</p>'},
        support:{title:'Tu operación, en marcha.', body:'<p>Para recuperar el acceso, pedir permisos o recibir ayuda con tu operación, contacta al administrador de la planta o al equipo de soporte interno.</p>'}}
  };
  var mem = {
    get:function(k){ try { return localStorage.getItem('nexora-ui-'+k); } catch(e){ return null; } },
    set:function(k, v){ try { localStorage.setItem('nexora-ui-'+k, v); } catch(e){} },
    del:function(k){ try { localStorage.removeItem('nexora-ui-'+k); } catch(e){} }
  };
  var oscuro = function(){ return document.documentElement.getAttribute('data-theme') === 'dark'; };
  var quieto = function(){ return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  function modulo(i, animar){
    mod = i;
    var m = MODS[lang][i];
    $('nxc-flow-title').textContent = m.title;
    $('nxc-batch-name').textContent = m.name;
    $('nxc-batch-sub').textContent = m.sub;
    $('nxc-batch-pill').textContent = m.pill;
    $('nxc-batch-icon').setAttribute('href', '#nxc-i-'+m.icon);
    $('nxc-counter').textContent = '0'+(i + 1)+' / 03';
    document.querySelectorAll('#nxc-login [data-module]').forEach(function(b){
      var sel = Number(b.getAttribute('data-module')) === i;
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
      if(sel) $('nxc-module-panel').setAttribute('aria-labelledby', b.id);
    });
    var paso = i === 2 ? 1 : i;
    document.querySelectorAll('#nxc-login [data-step]').forEach(function(s){
      var n = Number(s.getAttribute('data-step'));
      s.classList.toggle('nxc-active', n === paso);
      s.classList.toggle('nxc-completed', n < paso);
    });
    if(animar && !quieto() && $('nxc-batch').animate)
      $('nxc-batch').animate([{opacity:.25, transform:'translateY(3px)'}, {opacity:1, transform:'translateY(0)'}], {duration:230});
  }
  function etiquetas(){
    var t = T[lang];
    $('nxc-theme').setAttribute('aria-label', t[oscuro() ? 'lightTheme' : 'darkTheme']);
    $('nx-pass-toggle').setAttribute('aria-label', t[$('login-pass').type === 'password' ? 'showPassword' : 'hidePassword']);
    $('nxc-dialog-x').setAttribute('aria-label', t.closeDialog);
    $('nxc-tabs').setAttribute('aria-label', t.tabLabel);
  }
  function idioma(v){
    lang = v === 'es' ? 'es' : 'en';
    document.querySelectorAll('#nxc-login [data-i18n]').forEach(function(el){
      // el boton de entrar puede estar diciendo "Signing in…": no se pisa
      if(el.parentNode && el.parentNode.id === 'nx-sign-in' && window.nxLoginBusy){ el.innerHTML = T[lang].signingIn; return; }
      el.innerHTML = T[lang][el.getAttribute('data-i18n')] || '';
    });
    document.querySelectorAll('#nxc-login [data-placeholder]').forEach(function(el){ el.placeholder = T[lang][el.getAttribute('data-placeholder')]; });
    $('nxc-lang-label').textContent = lang.toUpperCase();
    $('nxc-lang').setAttribute('aria-label', lang === 'en' ? 'Cambiar a español' : 'Switch to English');
    modulo(mod);
    etiquetas();
    if(dlg) pintarDlg(dlg);
    mem.set('language', lang);
  }
  function ojo(mostrar){
    $('login-pass').type = mostrar ? 'text' : 'password';
    $('nxc-eye').setAttribute('href', mostrar ? '#nxc-i-eye-off' : '#nxc-i-eye');
    $('nx-pass-toggle').setAttribute('aria-pressed', String(mostrar));
    etiquetas();
  }
  function pintarDlg(k){
    var c = DLG[lang][k];
    $('nxc-dialog-title').textContent = c.title;
    $('nxc-dialog-body').innerHTML = c.body;
    $('nxc-dialog-svg').innerHTML = '<use href="#nxc-i-'+(k === 'forgot' ? 'lock' : k === 'support' ? 'user' : 'shield')+'"/>';
  }
  function abrir(k){
    foco = document.activeElement; dlg = k; pintarDlg(k);
    var d = $('nxc-dialog');
    if(d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function cerrar(){
    var d = $('nxc-dialog');
    if(d.close) d.close(); else d.removeAttribute('open');
    dlg = '';
    if(foco && foco.focus) foco.focus();
  }

  // Lo que usan auth.js y nexora-ui.js
  window.nxcTexto = function(k){ return (T[lang] && T[lang][k]) || T.en[k] || ''; };
  window.nxcUsuarioRecordado = function(){ return mem.get('username') || ''; };
  // Solo al entrar bien: si la casilla esta marcada se guarda el usuario
  window.nxcRecordar = function(usuario){
    var c = $('nxc-remember');
    if(c && c.checked && usuario) mem.set('username', usuario); else if(c && !c.checked) mem.del('username');
  };

  function init(){
    if(!$('nxc-login')) return;
    $('nxc-lang').addEventListener('click', function(){ idioma(lang === 'en' ? 'es' : 'en'); });
    $('nxc-theme').addEventListener('click', function(){
      if(typeof toggleDarkMode === 'function') toggleDarkMode();
      etiquetas();
    });
    $('nx-pass-toggle').addEventListener('click', function(){ ojo($('login-pass').type === 'password'); $('login-pass').focus(); });
    document.querySelectorAll('#nxc-login [data-module]').forEach(function(b){
      b.addEventListener('click', function(){ modulo(Number(b.getAttribute('data-module')), true); });
      b.addEventListener('keydown', function(e){
        if(['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
        e.preventDefault();
        var i = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (mod + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
        modulo(i, true);
        document.querySelector('#nxc-login [data-module="'+i+'"]').focus();
      });
    });
    $('nxc-forgot').addEventListener('click', function(){ abrir('forgot'); });
    $('nxc-privacy').addEventListener('click', function(){ abrir('privacy'); });
    $('nxc-support').addEventListener('click', function(){ abrir('support'); });
    $('nxc-dialog-x').addEventListener('click', cerrar);
    $('nxc-dialog-ok').addEventListener('click', cerrar);
    $('nxc-dialog').addEventListener('cancel', function(){ dlg = ''; });
    $('nxc-dialog').addEventListener('click', function(e){
      var r = $('nxc-dialog').getBoundingClientRect();
      if(e.target === $('nxc-dialog') && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) cerrar();
    });
    $('nxc-remember').addEventListener('change', function(){ if(!$('nxc-remember').checked) mem.del('username'); });
    if(mem.get('username')){ $('login-user').value = mem.get('username'); $('nxc-remember').checked = true; }
    $('nxc-year').textContent = new Date().getFullYear();
    // al volver al login (cerrar sesion) la contraseña vuelve a esconderse
    window.addEventListener('nexora:screen', function(e){ if(e.detail === 'screen-login') ojo(false); });
    window.addEventListener('nexora:theme', etiquetas);
    idioma(mem.get('language') === 'es' ? 'es' : 'en');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
