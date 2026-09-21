const { chromium } = require('playwright');
const path = require('path');
require('./monta-evolucao.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1200, height:1300} });
  const erros = [];
  page.on('console', m => { if(m.type()==='error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(__dirname, 'evolucao.html'));
  await page.waitForSelector('.svgraf', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const periodo = async v => { await page.locator('.periodo select').first().selectOption(v); await page.waitForTimeout(400); };

  const vivosComData = await page.evaluate(() => window.__vivosComData);
  const semSentimento = await page.evaluate(() => window.__semSentimento);

  console.log('--- o grafico ---');
  const colunas = () => page.locator('.colunadia').count();
  // Os dados vao de 26 dias atras ate hoje = 27 dias. Os dois dias parados
  // continuam como coluna valendo zero, entao entram na conta.
  check('desenha uma coluna por dia do periodo, inclusive os parados',
    await colunas() === 27, await colunas()+' (esperado 27)');
  check('tem a linha de filtros ativos', await page.locator('.filtrosativos').count() === 1);
  check('e a legenda por sentimento', await page.locator('.legenda .litem').count() >= 4);

  console.log('\n--- a pilha fecha com o numero escrito em cima ---');
  // A verificacao que mais importa: para CADA coluna, a soma das alturas das
  // fatias tem que corresponder ao total escrito. Barra menor que o numero em
  // cima dela e o defeito classico de grafico empilhado.
  const conferido = await page.evaluate(() => {
    const saida = [];
    document.querySelectorAll('.colunadia').forEach(col => {
      const rotulo = col.querySelector('.valtxt');
      if(!rotulo) return;                       // dia parado, sem barra
      const total = Number(rotulo.textContent);
      // Cada fatia guarda "dia · sentimento: N" no seu <title>.
      const fatias = [...col.querySelectorAll('rect title')]
        .map(t => Number((t.textContent.split(':').pop() || '0').trim()));
      saida.push({total, soma: fatias.reduce((a,n)=>a+n,0), fatias: fatias.length});
    });
    return saida;
  });
  check('toda coluna tem rotulo e fatias', conferido.length > 20, conferido.length+' colunas com dado');
  const erradas = conferido.filter(c => c.total !== c.soma);
  check('a soma das fatias e o total, em TODA coluna', erradas.length === 0,
    erradas.length ? JSON.stringify(erradas.slice(0,3)) : 'todas fecham');

  const somaGeral = conferido.reduce((a,c)=>a+c.total,0);
  check('e a soma de todos os dias bate com o resumo',
    (await page.locator('.resumoper .quantos b').textContent()).replace(/\D/g,'') === String(somaGeral),
    `${await page.locator('.resumoper .quantos b').textContent()} vs ${somaGeral}`);

  console.log('\n--- o que fica de fora ---');
  const filtros = await page.locator('.filtrosativos').textContent();
  check('avisa quantos estao sem data', filtros.includes('2 sem data'), filtros.slice(-60).trim());
  check('o Facebook nao entra no grafico do Instagram', !filtros.includes('do facebook'));
  // vivosComData ja exclui a lixeira: o grafico tem que bater exatamente.
  check('a lixeira nao entra na conta', somaGeral === vivosComData,
    `${somaGeral} no grafico, ${vivosComData} vivos com data`);
  check('o sem sentimento virou balde proprio, nao sumiu',
    filtros.includes('Sem sentimento: ' + semSentimento), 'esperado ' + semSentimento);

  console.log('\n--- clicar num dia ---');
  check('comeca sem detalhamento', await page.locator('.detlinha').count() === 0);
  check('e convida a clicar', (await page.locator('.legenda').textContent()).includes('Clique numa barra'));

  /* Escolhe a coluna com mais comentarios, para exercitar o "ver todos".
     "conferido" so tem as colunas COM rotulo (dia parado nao tem), entao o
     indice e o mesmo do locator filtrado por .valtxt — nao dos .colunadia
     todos, que incluem os dias parados. */
  const maior = conferido.reduce((a,c,k) => c.total > conferido[a].total ? k : a, 0);
  const comDado = () => page.locator('.colunadia').filter({has: page.locator('.valtxt')});
  const alvo = comDado().nth(maior);
  await alvo.click();
  await page.waitForTimeout(350);

  const linhas = await page.locator('.detlinha').count();
  check('abre o detalhamento do dia', linhas > 0, linhas+' linha(s)');
  const cabecalho = await page.locator('.bloco').last().locator('.bnota').textContent();
  const quantosNoDia = Number(cabecalho.replace(/\D/g,''));
  check('o cabecalho diz quantos sao', quantosNoDia > 0, cabecalho.trim());
  check('mostra no maximo 8 de inicio', linhas <= 8, linhas+'');

  if(quantosNoDia > 8){
    check('oferece ver todos', await page.getByRole('button', {name:/Ver todos os/}).count() === 1);
    await page.getByRole('button', {name:/Ver todos os/}).click();
    await page.waitForTimeout(250);
    check('e mostra todos', await page.locator('.detlinha').count() === quantosNoDia);
  } else {
    check('nao oferece "ver todos" quando cabe tudo',
      await page.getByRole('button', {name:/Ver todos os/}).count() === 0);
  }

  const primeira = page.locator('.detlinha').first();
  check('cada linha tem autor', (await primeira.locator('.detautor').textContent()).length > 1);
  check('cada linha tem o texto', (await primeira.locator('.dettexto').textContent()).includes('comentario'));
  check('cada linha tem o sentimento', await primeira.locator('.detsent .ldot').count() === 1);

  // Clicar de novo na MESMA coluna fecha.
  await comDado().nth(maior).click(); await page.waitForTimeout(350);
  check('clicar de novo fecha o detalhamento', await page.locator('.detlinha').count() === 0);

  console.log('\n--- trocar de periodo ---');
  await periodo('7d');
  const sete = await colunas();
  check('"7 dias" mostra menos colunas', sete < 28, sete+' colunas');
  await periodo('total');
  // Comentario sem data nao cria dia nenhum, entao "todo o periodo" tem os
  // mesmos 27 dias — o que muda e nao haver corte.
  check('"todo o periodo" volta aos 27 dias', await colunas() === 27, await colunas()+'');
  await periodo('ontem');
  check('"ontem" nao quebra', erros.length === 0);
  await periodo('28d');

  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,2).join(' | '));

  // Deixa um dia aberto para a foto.
  await page.locator('.colunadia').filter({has: page.locator('.valtxt')}).nth(maior).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(__dirname,'evolucao.png'), fullPage: false });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
