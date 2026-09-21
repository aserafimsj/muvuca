# Como conferir o banco — passo a passo

São **duas tarefas**. A primeira leva uns 5 minutos, a segunda uns 2.

**Nada aqui altera qualquer coisa.** As duas consultas só *leem* e mostram na
tela. Não dá para estragar nada seguindo este guia.

---

# TAREFA 1 — Duas consultas no Supabase

## Passo 1 — Abrir o Supabase

1. Abra uma aba nova no navegador.
2. Digite **`supabase.com`** e aperte Enter.
3. No canto de cima à direita, clique no botão **`Sign in`** (ou
   **`Dashboard`**, se já estiver logado).
4. Faça login com a sua conta.

**O que você vai ver:** uma página com uma lista de projetos, cada um numa
caixinha.

## Passo 2 — Entrar no projeto do MUVUCA

1. Na lista, procure o projeto do **MUVUCA** e clique nele.

**O que você vai ver:** uma tela com um menu vertical do lado esquerdo, cheio
de ícones pequenos com nomes ao lado.

> Não tem certeza de qual é o projeto? O endereço certo contém
> `fkhbjpyoajkadpfjexkb`. Você pode conferir clicando no projeto e olhando o
> endereço na barra do navegador.

## Passo 3 — Abrir o editor de consultas

1. No **menu da esquerda**, procure **`SQL Editor`**. O ícone parece uma
   folha de papel com as letras `SQL` dentro.
2. Clique nele.

**O que você vai ver:** uma área grande, quase toda vazia, com um botão
**`New query`** perto do topo.

3. Clique em **`New query`**.

**O que você vai ver:** uma caixa de texto grande e vazia, onde dá para
escrever. É aí que a gente cola as consultas.

## Passo 4 — A primeira consulta

1. **Copie o bloco inteiro abaixo.** Clique no canto de cima à direita do
   bloco, onde aparece um ícone de copiar — ou selecione o texto todo e
   aperte **`Command + C`**.

```sql
select table_name as tabela, column_name as coluna, data_type as tipo
from information_schema.columns
where table_schema = 'public'
  and table_name in ('interacoes','publicacoes')
order by table_name, ordinal_position;
```

2. Clique dentro da caixa grande e vazia.
3. Aperte **`Command + V`** para colar.
4. Clique no botão **`Run`**. Ele fica no canto de **baixo à direita** da
   caixa. Em algumas telas aparece como um triângulo ▶ em vez da palavra.

   *Atalho:* dá para apertar **`Command + Enter`** em vez de clicar.

**O que você vai ver:** embaixo da caixa aparece uma tabela com três colunas
— `tabela`, `coluna`, `tipo` — e muitas linhas, umas 40.

5. **Tire um print da tela e me mande.** Como a lista é longa, vai precisar
   rolar para baixo e tirar mais de um print. Pode mandar todos.

   *Print no Mac:* aperte **`Command + Shift + 4`**, depois arraste o mouse
   selecionando a área da tabela.

> **Se aparecer uma faixa vermelha** em vez da tabela: **pare**, tire um print
> dela e me mande. Não vá para o passo 5.

## Passo 5 — A segunda consulta

1. Clique dentro da caixa grande (onde está a consulta anterior).
2. Aperte **`Command + A`** para selecionar tudo que está lá.
3. Aperte a tecla **`delete`** para apagar.
4. Copie o bloco inteiro abaixo e cole com **`Command + V`**:

```sql
select
  count(*) as total_de_comentarios,
  count(*) filter (where data_publicacao is not null
                     and data_coment is not null
                     and data_publicacao::date <> data_coment::date) as conflitos,
  count(*) filter (where data_publicacao is null
                     and data_coment is not null) as so_na_coluna_nova,
  count(*) filter (where data_publicacao is not null
                     and data_coment is null) as so_na_coluna_antiga,
  count(*) filter (where data_publicacao is null
                     and data_coment is null) as sem_data_nenhuma,
  count(*) filter (where data_publicacao is not null
                     and to_char(data_publicacao,'HH24:MI:SS') <> '00:00:00') as com_hora_guardada
from interacoes;
```

5. Clique em **`Run`** de novo.

**O que você vai ver:** uma tabela com **uma linha só** e seis números.

6. **Tire um print e me mande.** Esse cabe todo numa tela só.

### O que esses seis números significam

| Coluna | O que quer dizer |
|---|---|
| `total_de_comentarios` | quantos comentários e DMs existem no banco |
| **`conflitos`** | **o número mais importante.** Quantos têm data nas duas colunas, mas com valores **diferentes** |
| `so_na_coluna_nova` | têm data só na coluna que eu criei por engano |
| `so_na_coluna_antiga` | têm data só na coluna certa |
| `sem_data_nenhuma` | não têm data em lugar nenhum |
| `com_hora_guardada` | se for maior que zero, existe horário guardado |

Se **`conflitos` for 0**, posso unir as duas colunas com segurança.

Se for **maior que zero**, eu listo cada caso e você decide um por um. **Não
vou sobrescrever nada sem te mostrar antes.**

### Se der erro vermelho nessa segunda consulta

Leia o texto vermelho. Se ele disser algo como
`column "data_publicacao" does not exist`, **isso é uma descoberta
importante**, não um erro seu — significa que a coluna nunca foi criada e que
a importação de DMs está quebrada. Me mande o print e eu cuido disso.

---

# TAREFA 2 — Uma olhada na planilha

Preciso saber como as colunas de engajamento se chamam na **sua** planilha. É
só olhar os títulos, não precisa mexer em nada.

## Passo 1 — Abrir a planilha

1. Abra a planilha de **publicações** — a mesma que você sobe no MUVUCA em
   *Importar dados*.

## Passo 2 — Achar a aba certa

1. Lá embaixo, na barra de abas da planilha, procure uma aba cujo nome
   **começa com "Resultados"**. Pode ser "Resultados Instagram",
   "Resultados Setembro" ou parecido.
2. Clique nessa aba.

## Passo 3 — Achar a linha de títulos

1. Procure a linha onde ficam os **nomes das colunas**. Ela é a que contém a
   palavra **`Formato`**.
2. Normalmente é a linha 1, mas pode estar mais abaixo, se houver um cabeçalho
   com logotipo ou título antes.

## Passo 4 — Olhar as colunas de engajamento

Ande para o lado (seta para a direita) até achar as colunas que falam de
**engajamento**.

**Tire um print dessa linha de títulos inteira** e me mande. Se não couber
numa tela só, mande dois prints.

### O que eu vou procurar no print

Preciso responder três perguntas:

1. **Existe uma coluna só de engajamento, ou duas?**
2. **Alguma delas tem a palavra "pago" ou "paga" no título?**
3. **O título tem a palavra "total"?** Por exemplo "Engajamento total" ou
   apenas "Engajamento".

### Por que isso importa tanto

O MUVUCA decide se uma coluna é orgânica ou paga **olhando se a palavra
"pago" está no título**. Quem não disser "pago" é tratado como orgânico.

Então, se a sua planilha tem **uma coluna só** chamada "Engajamento total",
ela está sendo guardada como se fosse **só a parte orgânica** — quando na
verdade já é o total. Se eu somasse essa coluna com a de pago, estaria
contando errado.

E tem outra: o MUVUCA só reconhece a coluna se o título contiver as palavras
**"engajamento total"**. Se na sua planilha estiver escrito apenas
**"Engajamento"**, essa coluna **não está sendo importada** — o número não
chega ao banco, e ninguém é avisado.

Por isso não dá para eu adivinhar. Com o print eu confirmo em 30 segundos.

---

# Resumindo o que me mandar

1. Print da tabela da **primeira consulta** (pode ser mais de um, é longa).
2. Print dos **seis números** da segunda consulta.
3. Print da **linha de títulos** da planilha de publicações.

Com esses três eu fecho o levantamento, faço a união das datas — mostrando
antes exatamente o que muda — e começo os gráficos.

Qualquer passo que não bater com o que você está vendo na tela, me diga em que
passo travou e o que apareceu. Não tem passo bobo.
