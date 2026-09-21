# Levantamento antes da camada analítica

Feito antes de escrever qualquer gráfico. **Nenhum gráfico foi implementado e
nenhuma alteração foi feita no banco.**

**De onde vêm estas informações.** Esta sessão **não tem acesso à rede**, então
não consultei o Supabase. O que está marcado como **confirmado no código** foi
lido do `index.html` — que é o que o aplicativo de fato lê e grava. O que está
marcado como **a confirmar** depende de você rodar as consultas da seção 6.

---

## 1. Dois defeitos encontrados

### 1.1 A data do comentário está partida em duas colunas — culpa minha

Na etapa 1 eu criei a coluna `data_coment` para o campo "Data do comentário"
do cartão. **Não vi que já existia `data_publicacao`**, gravada pela
importação de DMs desde antes de eu chegar (`index.html`, linha 2008).

| Como o comentário entrou | Onde a data foi parar | Os filtros e o relatório veem? |
|---|---|---|
| Importação de planilha (DMs) | `data_publicacao` | **Não** |
| Digitada no cartão | `data_coment` | Sim |
| Colar em lote | nenhuma | Não há data |
| Adicionar à mão | nenhuma | Não há data |

**Toda DM importada por planilha está hoje invisível para o recorte por
período do dashboard**, mesmo tendo data. É a divergência entre telas que o
pedido quer evitar.

**Decidido:** a coluna que fica é `data_publicacao`. A migração está desenhada
na seção 5 e **ainda não foi executada**.

### 1.2 A hora é destruída na leitura da planilha — e dá para recuperar

A importação lê a planilha com `raw:false` (`index.html`, linha 1957), o que
converte cada célula para o **texto formatado**. Se a célula está formatada
como `dd/mm/aaaa`, o texto sai sem hora **mesmo que o valor por baixo tenha
hora**.

Testado com a própria biblioteca que o MUVUCA usa, com uma célula contendo
`10/09/2026 14:32`:

| Formatação da célula | Lido com `raw:false` (hoje) | Lido com `raw:true` |
|---|---|---|
| só data | `"10/09/2026"` — **hora perdida** | `2026-09-10 14:32` |
| com hora | `"10/09/2026 14:32"` | `2026-09-10 14:32` |

Depois disso, a função `toDate` (linha 1884) ainda corta o que sobrou:

```js
if (v instanceof Date) return v.toISOString().slice(0,10);
```

**Conclusão: a hora não se perde na origem, perde-se na leitura.** Reimportar
as mesmas planilhas recupera os horários. Nada foi perdido definitivamente.

**Cuidado na correção:** não basta trocar para `raw:true`. Com `raw:true` as
outras colunas deixam de vir formatadas (números viram número cru), e os
outros trechos da importação contam com texto. A correção precisa tratar as
colunas de data separadamente, e vem com teste.

---

## 2. O que existe hoje — confirmado no código

### `interacoes` — comentários e DMs (a base de tudo)

| Campo | Para que serve | Quem preenche |
|---|---|---|
| `cliente_id` | de quem é | todos os caminhos |
| `rede_id` | Instagram, Facebook… | importação, colar em lote, cartão |
| `origem` | `Feed` ou `DM` | todos |
| `autor`, `texto` | quem falou e o quê | todos |
| `resposta` | o rascunho/resposta | cartão, importação de DM |
| `sentimento_id` | → `categorias_sentimento` | IA, cartão, importação |
| `produto_id`, `editoria_id` | → `produtos`, `editorias` | IA, cartão, importação |
| `triagem` | estado de trabalho | cartão |
| `link_conteudo` | o post de origem, **como texto** | colar em lote, cartão |
| `data_publicacao` | data — **só a importação grava** | importação de DM |
| `data_coment` | data — **criada por mim na etapa 1** | cartão |
| `ia_em`, `ia_triagem`, `ia_motivo`, `ia_juridico` | o que a IA achou | IA |

**Não existe:** hora, `post_id`, `projeto_id`.

### `publicacoes` — as métricas de desempenho

**As 16 métricas já existem e já são importadas.** Hoje a tabela inteira é
carregada e usada **só para contar quantos posts cada rede tem** (linha 1813).

Identificação: `cliente_id`, `rede_id`, `produto_id`, `editoria_id`,
`data_post`, `link`, `formato`, `status`.

As métricas, todas em par orgânico/pago:

| Coluna no banco | Vem da coluna da planilha cujo título contém… |
|---|---|
| `visu_org` / `visu_pago` | `visualizac…` |
| `alcance_org` / `alcance_pago` | `alcance` |
| `curtidas_org` / `curtidas_pago` | `curtida` |
| `coment_org` / `coment_pago` | `comentario` |
| `compart_org` / `compart_pago` | `compartilha` |
| `salvos_org` / `salvos_pago` | `salvamento` |
| `engaj_org` / `engaj_pago` | **`engajamento total`** |
| `tx_engaj_org` / `tx_engaj_pago` | `taxa` |

### Três armadilhas na importação das métricas

Confirmadas no código (`mapaColunas`, linha 1901):

**a) `_org` não significa "orgânico". Significa "não dizia pago".** O sufixo é
decidido assim:

```js
const pago = n.includes('pago') || n.includes('paga');
const suf  = pago ? '_pago' : '_org';
```

Se a sua planilha tem uma coluna única "Engajamento total", sem separar
orgânico de pago, **ela cai inteira em `engaj_org`**. Nesse caso `engaj_org`
já é o total, e somar com `engaj_pago` não faz sentido.

**Isto precisa ser conferido na sua planilha antes de eu definir o ranking.**

**b) Não existe `engaj_total`.** Só o par `engaj_org` / `engaj_pago`.

**c) Um título só de "Engajamento" é descartado em silêncio.** A regra exige
que o título contenha literalmente `engajamento total`. Se a planilha disser
apenas "Engajamento", a coluna não é lida e o valor não chega ao banco, sem
aviso nenhum.

### As outras tabelas

`clientes`, `redes`, `produtos`, `editorias`, `categorias_sentimento`,
`perfis`. Todas ligadas por `cliente_id`.

---

## 3. A matriz

| Gráfico | Fonte atual | Campo usado | Já funciona? | O que falta |
|---|---|---|---|---|
| Evolução diária | `interacoes` | `data_publicacao` | **Parcial** | unir as duas colunas; colar em lote não grava data |
| Volume mensal | `interacoes` | `data_publicacao` | **Parcial** | idem; e o texto do card fala de "volume publicado", que é outra coisa |
| Dia da semana | `interacoes` | `data_publicacao` | **Não** | sai da mesma data; falta implementar |
| Evolução por hora | `interacoes` | **não existe ainda** | **Não** | corrigir a leitura da planilha e guardar a hora; reimportar recupera |
| Sentimento | `interacoes` → `categorias_sentimento` | `sentimento_id` | **Sim** | só ligar na tela da rede; já calculado no dashboard |
| Termos | `interacoes` | `texto` | **Não** | implementar + lista de palavras a ignorar |
| Posts mais engajados | `publicacoes` | `engaj_org` / `engaj_pago` | **Dados sim, tela não** | conferir a armadilha (a) antes de definir o ranking |
| Hashtags | `interacoes` | `texto` | **Não** | nunca implementado |

---

## 4. Decisões já tomadas

| Assunto | Decisão |
|---|---|
| Coluna de data | Fica `data_publicacao`. `data_coment` só é descontinuada depois da validação. |
| Hierarquia | Sem camada de Projeto. Cliente é o projeto. Nada de cliente fixo no código. |
| Engajamento | Usar o campo que já vem da planilha. **Não inventar fórmula.** Antes, conferir a armadilha (a). |
| Taxa de engajamento | Tratada como coisa diferente do engajamento absoluto. Só usada com denominador conhecido. |
| Hora | Preservar a maior precisão disponível na origem. Nunca inventar horário. |

---

## 5. A migração da data — desenhada, **não executada**

Nada abaixo foi rodado. É o plano para você aprovar.

**Passo 1 — olhar antes de tocar.** A consulta 2 da seção 6 conta quantos
registros têm data nas duas colunas com **valores diferentes**. Se houver
algum, eu listo um por um e você decide; nenhum é sobrescrito antes disso.

**Passo 2 — copiar só o que não conflita**, preenchendo apenas onde
`data_publicacao` está vazia:

```sql
-- NÃO RODE AINDA. Só depois da consulta 2 não acusar conflito.
update interacoes
set data_publicacao = data_coment
where data_publicacao is null
  and data_coment is not null;
```

**Passo 3 — o aplicativo passa a usar só `data_publicacao`.** Mudança de
código, sem tocar no banco.

**Passo 4 — `data_coment` fica onde está, intacta**, até você confirmar que
está tudo certo. Só então ela é descontinuada. Coluna com dado seu não se
apaga por conveniência.

---

## 6. O que preciso que você rode no Supabase

**São só consultas de leitura. Nenhuma altera nada.**

1. Entre em **https://supabase.com** e faça login.
2. Clique no projeto do **MUVUCA**.
3. No **menu da esquerda**, clique em **`SQL Editor`**.
4. Clique em **`New query`**, no alto.

Para cada consulta abaixo: apague o que estiver na caixa, cole a consulta,
clique em **`Run`** (canto de baixo à direita) e me mande o resultado.

### Consulta 1 — que colunas existem e de que tipo

```sql
select table_name as tabela, column_name as coluna, data_type as tipo
from information_schema.columns
where table_schema = 'public'
  and table_name in ('interacoes','publicacoes')
order by table_name, ordinal_position;
```

**O que você vai ver:** uma linha por coluna das duas tabelas.

Responde: o tipo de `data_publicacao` e de `data_coment` (se disser `date`,
não cabe hora e vamos precisar convertê-la), quais campos de engajamento
existem de verdade, e se há colunas que o aplicativo nunca usa.

### Consulta 2 — as duas datas conflitam?

```sql
select
  count(*) as total_de_comentarios,
  count(*) filter (where data_publicacao is not null
                     and data_coment is not null
                     and data_publicacao::date <> data_coment::date) as conflitos,
  count(*) filter (where data_publicacao is null and data_coment is not null) as so_na_minha_coluna,
  count(*) filter (where data_publicacao is not null and data_coment is null) as so_na_coluna_antiga,
  count(*) filter (where data_publicacao is null and data_coment is null) as sem_data_nenhuma
from interacoes;
```

**O que você vai ver:** uma linha só, com cinco números.

O que importa é **`conflitos`**. Se for **0**, a migração é segura. Se for
maior que zero, eu listo os casos e você decide um por um — não vou
sobrescrever nada.

### Consulta 3 — sobrou alguma hora guardada?

```sql
select id, origem,
       data_publicacao,
       to_char(data_publicacao, 'HH24:MI:SS') as hora_guardada,
       data_coment,
       left(coalesce(texto,''), 40) as inicio_do_texto
from interacoes
where data_publicacao is not null or data_coment is not null
order by id desc
limit 15;
```

**O que você vai ver:** até 15 comentários com suas datas.

Olhe a coluna **`hora_guardada`**. Se vier `00:00:00` em todas, confirma que
nenhuma hora foi salva. Se aparecer alguma hora de verdade, muda o plano — há
mais informação guardada do que eu esperava.

---

## 7. Falta também uma resposta sua, fora do banco

Sobre a armadilha (a) da seção 2: **abra a sua planilha de publicações** e
olhe os títulos das colunas de engajamento.

- Existe **uma** coluna "Engajamento total"? Então ela está caindo em
  `engaj_org`, e esse valor **já é o total** — somar com `engaj_pago` estaria
  errado.
- Existem **duas**, uma delas com "pago"/"paga" no título? Então a separação
  está correta e a soma faz sentido.
- O título diz só "Engajamento", sem a palavra "total"? Então **essa coluna
  não está sendo importada**, e é preciso corrigir a leitura.

Me diga qual é o caso, ou mande um print da linha de títulos da planilha.
