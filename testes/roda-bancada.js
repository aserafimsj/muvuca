const { chromium } = require('playwright');
const path = require('path');

/* Dados da bancada (ver monta-bancada.js), e o que se espera de cada aba:
     Pendente   3  (id 1 duvida, id 3 juridico, id 4 nunca analisado)
     Respondido 1  (id 5)
     Ignorar    2  (id 2 spam, id 6 bot)
     Lixeira    1  (id 7)
     Historico  6  (tudo menos a lixeira)
   Um teste que falha por culpa da bancada nao vale nada: estes numeros saem
   dos dados acima, nao de chute. */

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1150, height:1500} });
  const erros = [];
  page.on('console', m => { if(m.type()==='error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(__dirname, 'bancada.html'));
  await page.waitForSelector('.abas', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const aba  = n => page.locator('.aba', { hasText: n }).first();
  const irPara = async n => { await aba(n).click(); await page.waitForTimeout(250); };
  const linhas = () => page.locator('.row').count();
  const contagem = async n => (await aba(n).textContent()).replace(/\D/g,'');

  console.log('\n--- contagem inicial das abas ---');
  check('as cinco abas existem', await page.locator('.aba').count() === 5);
  check('fila = 3',            await contagem('Comentários a responder') === '3');
  check('Respondidos = 1',     await contagem('Respondidos') === '1');
  check('Nao Respondidos = 2', await contagem('Não Respondidos') === '2');
  check('Historico = 6',       await contagem('Histórico') === '6');
  check('Lixeira = 1',         await contagem('Lixeira') === '1');
  check('abre na fila', await linhas() === 3);
  // Aqui, so o id 4 nunca foi analisado entre os vivos. O id 7 tambem nunca
  // foi, mas esta na lixeira: se ele fosse contado, apareceria (2).
  const iaInicial = (await page.getByRole('button', {name:/Classificar com IA/}).textContent()).trim();
  check('a IA nao conta o que esta na lixeira', iaInicial.includes('(1)'), iaInicial);

  console.log('\n--- cartao do comentario (etapa 1) ---');
  check('etiqueta "IA: responder" nos dois analisados', await page.getByText('IA: responder').count() === 2);
  check('alerta Juridico/STN so no sensivel', await page.getByText('Jurídico/STN').count() === 1);
  check('comentario nunca analisado nao mostra etiqueta', await page.locator('.row').nth(2).locator('.iatags').count() === 0);

  const primeiro = page.locator('.row').first();
  check('campo Post preenchido', await primeiro.locator('input').nth(1).inputValue() === 'https://instagram.com/p/abc');
  check('campo Data preenchido', await primeiro.locator('input[type=date]').inputValue() === '2026-09-15');
  check('Rede/Origem/Produto/Editoria/Sentimento sao listas', await primeiro.locator('select').count() === 5, await primeiro.locator('select').count()+'');

  const txt = primeiro.locator('textarea.txtedit');
  await txt.fill('Como faco para investir? CORRIGIDO');
  check('digitar nao grava a cada tecla', await page.evaluate(() => window.__gravacoes.filter(g=>g.texto).length) === 0);
  await txt.blur(); await page.waitForTimeout(200);
  check('sair do campo grava uma vez', await page.evaluate(() => window.__gravacoes.filter(g=>g.texto).length) === 1);

  await irPara('Não Respondidos');
  check('spam e bot estao em Nao Respondidos', await linhas() === 2);
  check('motivo da IA aparece', await page.getByText('· spam').count() === 1);
  check('spam nao oferece geracao paga', await page.locator('.row').first().getByRole('button', {name:/Gerar/}).count() === 0);
  check('spam ainda deixa escrever a mao', await page.locator('.row').first().locator('.reply textarea').count() === 1);

  console.log('\n--- fluxo de trabalho (etapa 2) ---');
  await irPara('Comentários a responder');
  await page.locator('.row').first().getByRole('button', {name:'✓ Respondi'}).click();
  await page.waitForTimeout(250);
  check('Respondi tira da fila', await linhas() === 2);
  check('a fila cai para 2', await contagem('Comentários a responder') === '2');
  check('Respondidos sobe para 2', await contagem('Respondidos') === '2');

  await irPara('Respondidos');
  check('o respondido aparece la', await linhas() === 2);
  check('mostra o selo de respondido', await page.getByText('✓ Respondido').count() === 2);
  check('oferece voltar para a fila', await page.getByRole('button', {name:'↩ Voltar para a fila'}).count() === 2);
  check('fora da fila nao ha "Respondi"', await page.getByRole('button', {name:'✓ Respondi'}).count() === 0);

  await irPara('Comentários a responder');
  await page.locator('.row').first().locator('.btnx').click();
  await page.waitForTimeout(250);
  check('o × manda para a lixeira', await linhas() === 1);
  check('Lixeira sobe para 2', await contagem('Lixeira') === '2');
  // Historico = tudo menos a lixeira. Eram 6; um foi para a lixeira, viram 5.
  check('Historico cai de 6 para 5', await contagem('Histórico') === '5', await contagem('Histórico'));

  await irPara('Lixeira');
  check('a lixeira recebeu', await linhas() === 2);
  check('na lixeira nao ha botao ×', await page.locator('.row').first().locator('.btnx').count() === 0);

  await page.locator('.row').first().getByRole('button', {name:'Excluir definitivo'}).click();
  await page.waitForTimeout(200);
  check('pede confirmacao antes de apagar', await page.getByText(/Excluir para sempre/).count() === 1);
  check('nada foi apagado ainda', await page.evaluate(() => (window.__excluidos||[]).length) === 0);
  await page.getByRole('button', {name:'Cancelar'}).click();
  await page.waitForTimeout(200);
  check('desistir nao apaga nada', await page.evaluate(() => (window.__excluidos||[]).length) === 0);
  check('e os dois continuam la', await linhas() === 2);

  await page.locator('.row').first().getByRole('button', {name:'Excluir definitivo'}).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', {name:'Sim, excluir'}).click();
  await page.waitForTimeout(300);
  check('confirmar apaga de verdade', await page.evaluate(() => (window.__excluidos||[]).length) === 1);
  check('sobrou um na lixeira', await linhas() === 1);

  await page.locator('.row').first().getByRole('button', {name:'↩ Restaurar'}).click();
  await page.waitForTimeout(250);
  check('restaurar devolve para a fila', await contagem('Comentários a responder') === '2');
  check('lixeira ficou vazia e explica para que serve', await page.getByText(/manda o comentário para cá/).count() === 1);

  // O id 7 voltou da lixeira e nunca foi analisado, entao agora sao 2 (ele e
  // o id 4). Restaurar devolve o comentario para a fila da IA, como deve ser.
  const iaFinal = (await page.getByRole('button', {name:/Classificar com IA/}).textContent()).trim();
  check('restaurado entra na fila da IA', iaFinal.includes('(2)'), iaFinal);

  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,2).join(' | '));

  await irPara('Comentários a responder');
  await page.screenshot({ path: path.join(__dirname,'cartao.png'), fullPage: true });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
