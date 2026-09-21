const { chromium } = require('playwright');
const path = require('path');

// Remonta a bancada sempre. Rodar contra um bancada.html velho dá falso
// alarme — o teste acusa um defeito que já foi corrigido, ou pior, deixa de
// acusar um que acabou de entrar.
require('./monta-bancada.js');

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
  // Restrito aos cartoes: a pastilha de filtro tambem diz "Juridico/STN", e
  // contar a tela inteira acusaria dois.
  check('alerta Juridico/STN so no cartao sensivel',
    await page.locator('.row .pill', {hasText:'Jurídico/STN'}).count() === 1);
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

  console.log('\n--- filtros e busca (etapa 3) ---');
  await irPara('Comentários a responder');
  // Na fila estao: id1 (Duvida), id3 (Negativo, juridico), id4 (sem sentimento).
  const chip = n => page.locator('.chip', { hasText: n }).first();
  check('pastilha Todos conta 3', (await chip('Todos').textContent()).includes('3'));
  check('pastilha Duvida conta 1', (await chip('Dúvida').textContent()).includes('1'));
  check('pastilha Negativo conta 1', (await chip('Negativo').textContent()).includes('1'));
  check('pastilha Positivo conta 0', (await chip('Positivo').textContent()).includes('0'));
  check('pastilha Juridico aparece com 1', (await chip('Jurídico/STN').textContent()).includes('1'));

  await chip('Dúvida').click(); await page.waitForTimeout(250);
  check('clicar em Duvida deixa 1 comentario', await linhas() === 1);
  check('e e o comentario certo', (await page.locator('.row').first().textContent()).includes('investir'));
  check('aparece o botao de limpar', await page.getByRole('button', {name:'Limpar filtros'}).count() === 1);
  await page.getByRole('button', {name:'Limpar filtros'}).click(); await page.waitForTimeout(250);
  check('limpar devolve os 3', await linhas() === 3);
  check('e o botao de limpar some', await page.getByRole('button', {name:'Limpar filtros'}).count() === 0);

  await chip('Jurídico/STN').click(); await page.waitForTimeout(250);
  check('filtrar por Juridico deixa 1', await linhas() === 1);
  check('e e o caso sensivel', (await page.locator('.row').first().textContent()).includes('aposta'));
  await page.getByRole('button', {name:'Limpar filtros'}).click(); await page.waitForTimeout(250);

  await page.locator('.filters input').first().fill('bitcoin'); await page.waitForTimeout(300);
  check('busca sem resultado esvazia a lista', await linhas() === 0);
  check('e explica que foi o filtro, nao a aba', await page.getByText(/corresponde ao que você filtrou/).count() === 1);
  await page.locator('.filters input').first().fill('boa noite'); await page.waitForTimeout(300);
  check('busca nao liga para maiuscula', await linhas() === 1);
  await page.getByRole('button', {name:'Limpar filtros'}).click(); await page.waitForTimeout(250);

  check('os filtros extras comecam escondidos', await page.locator('select').filter({hasText:'IA sugeriu'}).count() === 0);
  await page.getByRole('button', {name:'Mais filtros'}).click(); await page.waitForTimeout(250);
  check('"Mais filtros" revela os demais', await page.locator('.filters select').count() >= 6, await page.locator('.filters select').count()+'');
  await page.getByRole('button', {name:'Menos filtros'}).click(); await page.waitForTimeout(250);

  // As contagens sao da aba aberta, nao do acervo inteiro.
  await irPara('Não Respondidos');
  check('contagem da pastilha acompanha a aba', (await chip('Bot').textContent()).includes('2'));
  check('Juridico some quando a aba nao tem nenhum', await page.locator('.chip', {hasText:'Jurídico/STN'}).count() === 0);

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

  console.log('\n--- exportar CSV (etapa 5) ---');
  // No Historico, que a esta altura tem 6: os comentarios ja andaram bastante
  // nos testes acima, entao filtro por texto, que nao depende do estado deles.
  await irPara('Histórico');
  const btnExp = () => page.getByRole('button', {name:/^Exportar/});
  check('o botao mostra quantos vai exportar',
    /Exportar \d+/.test(await btnExp().textContent()), (await btnExp().textContent()).trim());
  const antesDoFiltro = Number((await btnExp().textContent()).replace(/\D/g,''));
  check('e esse numero e o da lista', antesDoFiltro === await linhas(), `${antesDoFiltro} vs ${await linhas()}`);

  // Filtrar tem que mudar o que sai no arquivo — exportar o acervo inteiro em
  // silencio depois de filtrar seria surpresa desagradavel na planilha.
  await page.locator('.filters input').first().fill('boa noite');
  await page.waitForTimeout(300);
  const depoisDoFiltro = Number((await btnExp().textContent()).replace(/\D/g,''));
  check('filtrar muda o que sera exportado', depoisDoFiltro === 1 && depoisDoFiltro < antesDoFiltro,
    `${antesDoFiltro} -> ${depoisDoFiltro}`);

  const baixa = page.waitForEvent('download', {timeout:10000});
  await btnExp().click();
  const arquivo = await baixa;
  check('o clique baixa um arquivo', !!arquivo);
  check('o nome diz a aba e a data',
    /^muvuca_[a-z_]+_\d{4}-\d{2}-\d{2}\.csv$/.test(arquivo.suggestedFilename()),
    arquivo.suggestedFilename());

  const destino = path.join(__dirname, 'exportado.csv');
  await arquivo.saveAs(destino);
  const conteudo = require('fs').readFileSync(destino, 'utf8');
  check('o arquivo tem a marca de UTF-8', conteudo.charCodeAt(0) === 0xFEFF);
  check('tem cabecalho + so o que estava filtrado',
    conteudo.trim().split('\r\n').length === depoisDoFiltro + 1,
    conteudo.trim().split('\r\n').length + ' linhas');
  require('fs').unlinkSync(destino);

  await page.getByRole('button', {name:'Limpar filtros'}).click();
  await page.waitForTimeout(250);

  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,2).join(' | '));

  await irPara('Comentários a responder');
  await page.screenshot({ path: path.join(__dirname,'cartao.png'), fullPage: true });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
