const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1100, height:1400} });
  const erros = [];
  page.on('console', m => { if(m.type()==='error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + __dirname + '/bancada.html');
  await page.waitForSelector('.row', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };

  check('renderizou os 4 comentarios', await page.locator('.row').count() === 4);
  check('etiqueta "IA: responder" aparece', await page.getByText('IA: responder').count() === 2);
  check('etiqueta "IA: nao responder" aparece', await page.getByText('IA: não responder').count() === 1);
  check('alerta Juridico/STN so no comentario sensivel', await page.getByText('Jurídico/STN').count() === 1);
  check('motivo da IA aparece', await page.getByText('· spam').count() === 1);
  // O 4o comentario nunca foi analisado: nao pode ter faixa de etiquetas.
  check('comentario nao analisado nao mostra etiqueta', await page.locator('.row').nth(3).locator('.iatags').count() === 0);

  const campos = page.locator('.row').first();
  check('campo Post preenchido com o link', await campos.locator('input').nth(1).inputValue() === 'https://instagram.com/p/abc');
  check('campo Data do comentario preenchido', await campos.locator('input[type=date]').inputValue() === '2026-09-15');
  check('Produto e Editoria agora sao listas', await campos.locator('select').count() === 6, await campos.locator('select').count()+' listas');

  // Editar o texto do comentario: so pode gravar ao SAIR do campo.
  const txt = campos.locator('textarea.txtedit');
  await txt.fill('Como faco para investir? CORRIGIDO');
  const antes = await page.evaluate(() => window.__gravacoes.length);
  check('digitar nao grava a cada tecla', antes === 0, antes+' gravacoes');
  await txt.blur();
  await page.waitForTimeout(200);
  const depois = await page.evaluate(() => window.__gravacoes.filter(g=>g.texto).length);
  check('sair do campo grava uma vez', depois === 1, depois+' gravacoes');

  // "Gerar de novo" num comentario sem rascunho.
  const terceiro = page.locator('.row').nth(2);
  check('botao diz "Gerar sugestao" quando nao ha rascunho', (await terceiro.getByRole('button', {name:/Gerar sugest/}).count()) === 1);
  await terceiro.getByRole('button', {name:/Gerar sugest/}).click();
  await page.waitForTimeout(300);
  check('rascunho da IA entrou na caixa', (await terceiro.locator('.reply textarea').inputValue()).includes('novinho'));
  check('botao vira "Gerar de novo" depois', (await terceiro.getByRole('button', {name:'Gerar de novo'}).count()) === 1);

  // Botao salvar so acende quando ha mudanca por salvar.
  const primeiro = page.locator('.row').first();
  check('salvar comeca desligado (nada mudou)', await primeiro.getByRole('button', {name:/Salva/}).isDisabled());
  await primeiro.locator('.reply textarea').fill('resposta editada a mao');
  check('salvar acende ao editar', await primeiro.getByRole('button', {name:'Salvar resposta'}).isEnabled());


  // spam: nao pode oferecer geracao paga para receber "nao ha o que responder"
  const spam = page.locator('.row').nth(1);
  check('spam nao oferece "Gerar sugestao"', await spam.getByRole('button', {name:/Gerar/}).count() === 0);
  check('spam ainda deixa escrever a mao', await spam.locator('.reply textarea').count() === 1);
  check('caixa vazia nao diz "Salva"', await spam.getByRole('button', {name:'Salvar resposta'}).count() === 1);

  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,3).join(' | '));

  await page.screenshot({ path: __dirname + '/cartao.png', fullPage: true });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
