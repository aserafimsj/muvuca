// Etapa 8 — validacao do conjunto. Percorre o aplicativo INTEIRO procurando o
// que quebrou entre as etapas: modulo sem rota, prop esquecida, dado de um
// cliente vazando para outro, erro de execucao em qualquer tela.
const { chromium } = require('playwright');
const path = require('path');
require('./monta-app.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1280, height:1000} });
  const erros = [];
  const deRede = t => /net::|Failed to load resource|ERR_|X-Frame|refused to connect/i.test(t);
  page.on('console', m => { if(m.type()==='error' && !deRede(m.text())) erros.push(m.text()); });
  page.on('pageerror', e => { if(!deRede(e.message)) erros.push('PAGEERROR: ' + e.message); });
  // Alerta travaria o teste; registra e fecha.
  const alertas = [];
  page.on('dialog', d => { alertas.push(d.message()); d.dismiss(); });

  await page.goto('file://' + path.join(__dirname, 'app.html'));

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const menu = n => page.locator('.nav', {hasText:n}).first();
  const irPara = async n => { await menu(n).click(); await page.waitForTimeout(400); };
  /* O texto do comentario mora num <textarea>, e conteudo de textarea e VALOR,
     nao texto. Procurar com innerText nunca acha nada — e um teste do tipo
     "nao deve aparecer" passa por engano, sempre. Aqui se le o valor. */
  const textos = async () => {
    const campos = await page.locator('.row textarea.txtedit').all();
    const saida = [];
    for(const c of campos) saida.push(await c.inputValue());
    return saida;
  };

  console.log('--- o aplicativo sobe ---');
  await page.waitForSelector('.side', {timeout:15000});
  check('passa do login e monta o painel', await page.locator('.side').count() === 1);
  check('nao fica preso em "Carregando"', await page.getByText('Carregando…').count() === 0);
  check('abre em Projetos', await page.locator('.nav.on').textContent() === 'Projetos');
  check('mostra o nome do usuario', (await page.locator('.who .nm').textContent()).includes('Adilson'));

  console.log('\n--- todo modulo do menu abre ---');
  const MODULOS = ['Projetos','Community','Conteúdos','Importar dados','Relatórios','Configurações'];
  check('o menu tem os seis modulos', await page.locator('.nav').count() === MODULOS.length,
    await page.locator('.nav').count()+'');
  for(const m of MODULOS){
    await irPara(m);
    const titulo = await page.locator('.main h1').first().textContent().catch(()=>null);
    const emBranco = await page.locator('.main').innerText();
    check(`${m}: abre e desenha algo`, !!titulo && emBranco.trim().length > 20, titulo || '(sem titulo)');
    check(`${m}: sem erro de execucao`, erros.length === 0, erros.slice(0,1).join(''));
  }

  console.log('\n--- um cliente nao ve o dado do outro ---');
  await irPara('Community');
  const contaFila = async () => Number((await page.locator('.aba').first().textContent()).replace(/\D/g,'') || 0);
  check('Tesouro Direto mostra so os seus', await contaFila() === 1, await contaFila()+'');
  const doTesouro = await textos();
  check('e nao mostra o comentario do outro cliente',
    !doTesouro.includes('de outro cliente'), doTesouro.join(' | '));

  await page.locator('.switcher select').selectOption({label:'Outro Cliente'});
  await page.waitForTimeout(700);
  const doOutro = await textos();
  check('trocar de cliente recarrega', doOutro.includes('de outro cliente'), doOutro.join(' | '));
  check('e o comentario do primeiro sumiu', !doOutro.includes('Como invisto?'));

  await page.locator('.switcher select').selectOption({label:'Tesouro Direto'});
  await page.waitForTimeout(700);
  const devolta = await textos();
  check('e volta ao trocar de novo', devolta.includes('Como invisto?'), devolta.join(' | '));

  console.log('\n--- a lixeira e respeitada em TODA tela ---');
  await page.locator('.aba', {hasText:'Histórico'}).click();
  await page.waitForTimeout(300);
  const noHistorico = await textos();
  check('o da lixeira nao aparece no Historico', !noHistorico.includes('fora'), noHistorico.join(' | '));
  check('e os vivos aparecem', noHistorico.length === 3, noHistorico.length+'');

  await page.locator('.aba', {hasText:'Lixeira'}).click();
  await page.waitForTimeout(300);
  const naLixeira = await textos();
  check('mas esta na Lixeira', naLixeira.includes('fora'), naLixeira.join(' | '));

  await irPara('Relatórios');
  const totalRel = Number(await page.locator('.card .val').first().textContent());
  check('e nao conta no relatorio', totalRel === 3, totalRel+' (sao 3 vivos)');

  console.log('\n--- gravar de verdade ---');
  await irPara('Community');
  // Volta para a fila: a aba fica onde foi deixada, e a Lixeira nao serve aqui.
  await page.locator('.aba').first().click();
  await page.waitForTimeout(300);
  // O seletor de sentimento e o do .sentbox. O primeiro <select> do cartao e o
  // de Rede, que nao tem opcao "Positivo".
  const sent = page.locator('.row').first().locator('.sentbox select');
  await sent.selectOption({label:'Positivo'});
  await page.waitForTimeout(400);
  const gravou = await page.evaluate(() => window.__gravacoes.filter(g => 'sentimento_id' in g).length);
  check('mudar o sentimento grava no banco', gravou === 1, gravou+' gravacao(oes)');
  check('e a tela acompanha', await sent.inputValue() === '1', await sent.inputValue());

  console.log('\n--- as colunas que o codigo grava existem no banco ---');
  // Esta e a verificacao que teria pego o desastre das migracoes que nunca
  // rodaram: o codigo gravava ia_em numa coluna inexistente.
  const fs2 = require('fs');
  const esquema = JSON.parse(fs2.readFileSync(path.join(__dirname,'esquema-real.json'),'utf8'));
  const gravadas = await page.evaluate(() =>
    [...new Set(window.__gravacoes.flatMap(g => Object.keys(g).filter(k => k !== 'tabela' && k !== 'id')))]);
  const desconhecidas = gravadas.filter(c => !esquema.interacoes.includes(c));
  check('nenhuma coluna gravada esta fora do esquema confirmado',
    desconhecidas.length === 0, desconhecidas.join(', ') || 'nenhuma');

  console.log('\n--- nada de alerta de erro pelo caminho ---');
  const feios = alertas.filter(a => /erro|error|falha/i.test(a));
  check('nenhum alerta de erro apareceu', feios.length === 0, feios.slice(0,2).join(' | '));
  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,3).join(' | '));

  await page.screenshot({ path: path.join(__dirname,'app.png'), fullPage: false });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
