const { chromium } = require('playwright');
const path = require('path');
require('./monta-dash.js');   // sempre contra a versao atual do index.html

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1150, height:1600} });
  const erros = [];
  page.on('console', m => { if(m.type()==='error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(__dirname, 'dash.html'));
  await page.waitForSelector('.periodo', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const bloco = t => page.locator('.bloco').filter({ has: page.locator('.btit', {hasText:t}) }).first();
  const periodo = async v => { await page.locator('.periodo select').first().selectOption(v); await page.waitForTimeout(350); };
  const noPeriodo = async () => Number((await page.locator('.resumoper .quantos b').textContent()).trim());

  const total     = await page.evaluate(() => window.__total);
  const naLixeira = await page.evaluate(() => window.__naLixeira);
  const semData   = await page.evaluate(() => window.__semData);

  console.log('\n--- o que entra na conta ---');
  check('abre em "todo o periodo"', await page.locator('.periodo select').first().inputValue() === 'total');
  const vivos = total - naLixeira;
  check('a lixeira fica de fora do relatorio', await noPeriodo() === vivos, `${await noPeriodo()} de ${vivos} vivos (${total} no total)`);
  check('avisa sobre os comentarios sem data',
    await page.getByText(/sem data preenchida/).count() === 1);
  check('e diz quantos sao', (await page.getByText(/sem data preenchida/).textContent()).includes(String(semData)));

  console.log('\n--- numeros do topo ---');
  const tile = n => page.locator('.card').filter({has: page.locator('.lbl',{hasText:n})}).locator('.val').first();
  check('"No periodo" bate com o resumo', Number(await tile('No período').textContent()) === vivos);
  const resp = Number(await tile('Respondidos').textContent());
  const fila = Number(await tile('Na fila').textContent());
  check('respondidos e fila nao passam do total', resp + fila <= vivos, `${resp}+${fila} <= ${vivos}`);
  check('ha algum Juridico/STN marcado', Number(await tile('Jurídico/STN').textContent()) > 0);

  console.log('\n--- graficos ---');
  for(const t of ['Sentimento','Rede','Produto','Editoria','Quem mais comentou']){
    check(`bloco "${t}" existe`, await bloco(t).count() === 1);
    check(`bloco "${t}" tem barras`, await bloco(t).locator('.barra').count() > 0);
  }
  // A regra que o teste de cor impos: o numero nunca pode depender so da cor.
  const barras = bloco('Sentimento').locator('.barra');
  check('toda barra mostra o numero', await barras.locator('.num').count() === await barras.count());
  check('e mostra a porcentagem', await barras.locator('.num .pct').count() === await barras.count());

  // A soma das fatias tem que fechar com o total.
  const somaSent = await bloco('Sentimento').locator('.barra .num').evaluateAll(
    ns => ns.reduce((a,n) => a + Number(n.childNodes[0].textContent), 0));
  check('a soma do grafico de sentimento fecha com o total', somaSent === vivos, `${somaSent} de ${vivos}`);

  check('"quem mais comentou" mostra no maximo 10', await bloco('Quem mais comentou').locator('.barra').count() <= 10);

  console.log('\n--- linha do tempo ---');
  check('a linha foi desenhada', await page.locator('.svgtempo .serie').count() === 1);
  check('tem rotulo para leitor de tela', !!(await page.locator('.svgtempo').getAttribute('aria-label')));
  const d = await page.locator('.svgtempo .serie').getAttribute('d');
  check('a linha tem muitos pontos (dias parados viram zero, nao buraco)',
    (d.match(/L/g)||[]).length > 30, (d.match(/L/g)||[]).length + ' segmentos');
  await page.locator('.svgtempo').hover({position:{x:300,y:80}});
  await page.waitForTimeout(250);
  check('o mouse sobre a linha mostra o dia', /comentário\(s\) em/.test(await page.locator('.dicatempo').textContent()),
    (await page.locator('.dicatempo').textContent()).trim().slice(0,50));

  console.log('\n--- ver como tabela ---');
  await page.getByRole('button', {name:'Ver como tabela'}).click();
  await page.waitForTimeout(300);
  check('as tabelas aparecem', await page.locator('.tabnum').count() >= 4);
  check('as barras somem', await page.locator('.barra').count() === 0);
  const somaTab = await bloco('Sentimento').locator('.tabnum tbody tr td:nth-child(2)').evaluateAll(
    tds => tds.reduce((a,t) => a + Number(t.textContent), 0));
  check('a tabela soma o mesmo que o grafico', somaTab === somaSent, `${somaTab} vs ${somaSent}`);
  await page.getByRole('button', {name:'Ver gráficos'}).click();
  await page.waitForTimeout(300);
  check('da para voltar para os graficos', await page.locator('.barra').count() > 0);

  console.log('\n--- trocar de periodo ---');
  await periodo('7d');
  const sete = await noPeriodo();
  check('"7 dias" mostra menos que o total', sete < vivos, `${sete} de ${vivos}`);
  check('"7 dias" nao esta vazio', sete > 0);
  await periodo('28d');
  const vinteoito = await noPeriodo();
  check('"28 dias" >= "7 dias"', vinteoito >= sete, `${vinteoito} >= ${sete}`);
  check('e ainda menor que o total (ha dado mais velho)', vinteoito < vivos);
  await periodo('ontem');
  check('"ontem" continua desenhando sem quebrar', erros.length === 0);
  await periodo('custom');
  check('"escolher as datas" revela os dois campos', await page.locator('.periodo input[type=date]').count() === 2);

  await periodo('total');
  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,2).join(' | '));

  await page.screenshot({ path: path.join(__dirname,'dashboard.png'), fullPage: true });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
