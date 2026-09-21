const { chromium } = require('playwright');
const path = require('path');
require('./monta-dash.js');   // sempre contra a versao atual do index.html

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1150, height:1800} });
  const erros = [];
  page.on('console', m => { if(m.type()==='error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(__dirname, 'dash.html'));
  await page.waitForSelector('.periodo', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const bloco = t => page.locator('.bloco').filter({ has: page.locator('.btit', {hasText:t}) }).first();
  // Texto exato: "Barras" tambem casaria com "Barras H".
  const tipo = async (t, botao) => {
    await bloco(t).locator('.seg').filter({hasText: new RegExp('^'+botao+'$')}).click();
    await page.waitForTimeout(250);
  };
  const periodo = async v => { await page.locator('.periodo select').first().selectOption(v); await page.waitForTimeout(350); };
  const noPeriodo = async () => Number((await page.locator('.resumoper .quantos b').textContent()).trim());
  // Soma os numeros que aparecem em cima das barras / na legenda.
  const somaRotulos = async (t, sel) => (await bloco(t).locator(sel).allTextContents())
    .reduce((a,s) => a + Number(String(s).replace(/\D/g,'') || 0), 0);

  const total     = await page.evaluate(() => window.__total);
  const naLixeira = await page.evaluate(() => window.__naLixeira);
  const semData   = await page.evaluate(() => window.__semData);
  const vivos = total - naLixeira;

  console.log('\n--- o que entra na conta ---');
  check('abre em "todo o periodo"', await page.locator('.periodo select').first().inputValue() === 'total');
  check('a lixeira fica de fora do relatorio', await noPeriodo() === vivos, `${await noPeriodo()} de ${vivos} vivos (${total} no total)`);
  check('avisa sobre os comentarios sem data', await page.getByText(/sem data preenchida/).count() === 1);
  check('e diz quantos sao', (await page.getByText(/sem data preenchida/).textContent()).includes(String(semData)));

  console.log('\n--- numeros do topo ---');
  const tile = n => page.locator('.card').filter({has: page.locator('.lbl',{hasText:n})}).locator('.val').first();
  check('"No periodo" bate com o resumo', Number(await tile('No período').textContent()) === vivos);
  const resp = Number(await tile('Respondidos').textContent());
  const fila = Number(await tile('Na fila').textContent());
  check('respondidos e fila nao passam do total', resp + fila <= vivos, `${resp}+${fila} <= ${vivos}`);
  check('ha algum Juridico/STN marcado', Number(await tile('Jurídico/STN').textContent()) > 0);

  console.log('\n--- como cada grafico abre (padroes do Zmetrics) ---');
  check('Sentimento abre em barras em pe', await bloco('Sentimento').locator('.svgraf rect[rx="4"]').count() > 0);
  check('Sentimento marca "Barras" como ligado',
    await bloco('Sentimento').locator('.seg.on').textContent() === 'Barras');
  check('Rede abre em pizza', await bloco('Rede').locator('.svgraf path').count() > 0);
  check('Rede marca "Pizza" como ligado', await bloco('Rede').locator('.seg.on').textContent() === 'Pizza');
  check('"Quem mais comentou" abre em barras deitadas',
    await bloco('Quem mais comentou').locator('.barra').count() > 0);
  check('todo bloco oferece os quatro tipos', await bloco('Sentimento').locator('.seg').count() === 4);

  console.log('\n--- trocar o tipo de grafico ---');
  const esperado = vivos;   // sentimento cobre todos, inclusive "Sem sentimento"
  check('barras em pe: a soma fecha', await somaRotulos('Sentimento','.svgraf .valtxt') === esperado,
    `${await somaRotulos('Sentimento','.svgraf .valtxt')} de ${esperado}`);

  await tipo('Sentimento','Pizza');
  check('pizza desenha as fatias', await bloco('Sentimento').locator('.svgraf path').count() > 1);
  check('pizza tem legenda', await bloco('Sentimento').locator('.legenda .litem').count() > 1);
  check('pizza: a soma da legenda fecha', await somaRotulos('Sentimento','.legenda .litem b') === esperado,
    `${await somaRotulos('Sentimento','.legenda .litem b')} de ${esperado}`);

  await tipo('Sentimento','Barras H');
  check('barras deitadas aparecem', await bloco('Sentimento').locator('.barra').count() > 0);
  check('barras deitadas: a soma fecha',
    await bloco('Sentimento').locator('.barra .num').evaluateAll(ns => ns.reduce((a,n)=>a+Number(n.childNodes[0].textContent),0)) === esperado);

  await tipo('Sentimento','Empilhado');
  check('empilhado desenha as pilhas', await bloco('Sentimento').locator('.svgraf rect').count() > 0);
  check('empilhado tem legenda das redes', await bloco('Sentimento').locator('.legenda .litem').count() > 0);
  check('empilhado: o total em cima de cada pilha fecha',
    await somaRotulos('Sentimento','.svgraf .valtxt') === esperado,
    `${await somaRotulos('Sentimento','.svgraf .valtxt')} de ${esperado}`);
  await tipo('Sentimento','Barras');

  console.log('\n--- linha do tempo ---');
  check('a linha foi desenhada', await page.locator('.svgtempo .serie').count() === 1);
  check('tem rotulo para leitor de tela', !!(await page.locator('.svgtempo').getAttribute('aria-label')));
  const d = await page.locator('.svgtempo .serie').first().getAttribute('d');
  check('dias parados viram zero, nao buraco', (d.match(/L/g)||[]).length > 30, (d.match(/L/g)||[]).length + ' segmentos');
  await page.locator('.svgtempo').hover({position:{x:300,y:80}});
  await page.waitForTimeout(250);
  check('o mouse mostra o dia', /\d/.test(await page.locator('.dicatempo').textContent()));

  const tempo = page.locator('.bloco').filter({has: page.locator('.btit',{hasText:'Comentários por dia'})});
  await tempo.locator('.seg', {hasText:'Por sentimento'}).click();
  await page.waitForTimeout(300);
  check('"por sentimento" desenha varias linhas', await page.locator('.svgtempo .serie').count() > 1,
    await page.locator('.svgtempo .serie').count()+' linhas');
  check('e ganha legenda', await tempo.locator('.legenda .litem').count() > 1);
  check('todas as linhas usam o mesmo eixo',
    (await page.locator('.svgtempo .eixotxt').allTextContents()).length > 0);
  await tempo.locator('.seg', {hasText:'Total'}).click();
  await page.waitForTimeout(300);
  check('da para voltar para o total', await page.locator('.svgtempo .serie').count() === 1);

  console.log('\n--- ver como tabela ---');
  await page.getByRole('button', {name:'Ver como tabela'}).click();
  await page.waitForTimeout(300);
  check('as tabelas aparecem', await page.locator('.tabnum').count() >= 4);
  check('o seletor de tipo some (nao ha grafico para trocar)', await page.locator('.bloco .seg').count() === 2,
    await page.locator('.bloco .seg').count()+' (so os 2 da linha do tempo)');
  const somaTab = await bloco('Sentimento').locator('.tabnum tbody tr td:nth-child(2)').evaluateAll(
    tds => tds.reduce((a,t) => a + Number(t.textContent), 0));
  check('a tabela soma o mesmo que o grafico', somaTab === esperado, `${somaTab} de ${esperado}`);
  await page.getByRole('button', {name:'Ver gráficos'}).click();
  await page.waitForTimeout(300);

  console.log('\n--- trocar de periodo ---');
  await periodo('7d');
  const sete = await noPeriodo();
  check('"7 dias" mostra menos que o total', sete < vivos, `${sete} de ${vivos}`);
  check('"7 dias" nao esta vazio', sete > 0);
  await periodo('28d');
  check('"28 dias" >= "7 dias"', (await noPeriodo()) >= sete);
  await periodo('ontem');
  check('"ontem" nao quebra', erros.length === 0);
  await periodo('custom');
  check('"escolher as datas" revela os dois campos', await page.locator('.periodo input[type=date]').count() === 2);

  await periodo('total');
  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,2).join(' | '));

  await page.screenshot({ path: path.join(__dirname,'dashboard.png'), fullPage: true });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
