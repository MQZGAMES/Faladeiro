# Faladeiro: prompt melhorado (versão 2)

## As dores que este prompt resolve

- A criança tem 2 anos: **não lê, não entende missões, fases, estrelas ou instruções** ("Sua vez", "próximo").
- Ela **adora falar e fazer barulho**, e o jogo precisa responder a isso na hora, sempre.
- A voz sintetizada do celular soava **robótica**.
- Os pais não conseguem ficar "tocando para avançar". O jogo tem que **andar sozinho pelo microfone**.
- A boca do cachorro tinha **falhas** (língua piscando, latido sem boca mexer).
- Faltava **interação física**: jogar a bola, arrastar coisas, pegar o cachorro no colo.

## Prompt

> Crie **Faladeiro**, um app web *mobile first* no estilo **Talking Tom**, com um **cachorrinho fofo**, para estimular a fala de uma criança de 2 anos que gosta de falar e fazer barulho.
>
> **1. Microfone sempre ligado, repetição a qualquer momento.** Em qualquer tela ou brincadeira, quando a criança fala ou faz barulho, o cachorro pausa o que está fazendo e mostra que está ouvindo (orelha em pé, cabeça inclinada, ondinhas saindo da orelha). Depois **repete com voz fininha**, com a boca sincronizada ao som, reage com alegria ("De novo!", "Uau!", risada, pulo) e **volta para a brincadeira de onde parou**. Um grito faz as orelhas "voarem" com o vento ("Que barulhão!"). A cada 6 falas seguidas, uma festinha de confete.
>
> **2. Quando a criança fica quieta**, o cachorro **imita as últimas falas dela** com vozes engraçadas (normal, grossa de monstro, cantando, fininha, com eco, duas vezes), intercaladas com chamadas curtas ("Fala comigo!", "Cadê você?", "Au au!"), esconde-esconde e convites a brinquedos. Isso continua até a criança falar de novo. Depois de muito tempo sem ninguém, ele tira um soninho e acorda com voz ou toque.
>
> **3. Nada de instruções, fases, estrelas ou botões de "próximo".** Tudo avança sozinho. Se a criança toca, isso também faz avançar.
>
> **4. Voz natural:** falas curtas e alegres gravadas com voz neural pt-BR (não usar a voz robótica do aparelho), com a boca animada pelo volume real do áudio.
>
> **5. Brinquedos em uma bandeja grande, só com ícones:**
> - **Bola:** a criança arrasta e joga (ou só toca para chutar). O cachorro corre atrás, pula para pegar no ar, sai da tela se a bola sair, volta com ela na boca e devolve ("Toma!"). Falar também faz ele jogar a bola.
> - **Comida:** a comida aparece e ele fala o nome. A criança arrasta até a boca, toca, ou fala; se ninguém fizer nada, ele pega sozinho. Ele mastiga, solta migalhas e às vezes arrota ("Ops! Desculpa!").
> - **Bolhas:** estourar com o dedo; a voz da criança cria mais bolhas; o cachorro morde as bolhas.
> - **Música:** festa com luzes e dança no ritmo. Dá para arrastar o cachorro dançando.
> - **Figuras:** figura grande com a palavra e as sílabas. Ele fala ("Olha! Bola!"), espera a criança, repete devagar e comemora qualquer som ("Isso! Bola!"). Passa sozinha, e tocar na figura pula para a próxima. Alterna objetos e bichos (onomatopeias).
> - **Dormir:** noite e canção de ninar. Falar baixinho faz ele repetir sonolento; toque ou grito acorda ("Bom dia!").
>
> **6. O cachorro é interativo:** cada parte do corpo reage ao toque (nariz espirra, barriga faz cócegas, pata bate "toca aqui", rabo gira, cabeça ganha carinho com corações). Arrastar o corpo **pega no colo**: ele balança, ri e cai quicando. Uma borboleta passeia de vez em quando; ele acompanha e tenta pegar, e tocar nela faz ele dizer "Borboleta!".
>
> **7. Visual caprichado no celular:** quintal com casinha, cerca, árvore, sol e nuvens, modo noite, festa de luzes, cachorro grande e muito expressivo, e alvos de toque enormes.
>
> **8. Comandos de voz** (lista visível nas opções): "fica bravo", "vai deitar", "acorda", "quer biscoito", "corre", "pega a bola", "pula", "senta", "late", "dança", "gira", "rola", "dá a pata", "beijo", "abraço", "oi", "tchau", "canta", "bolhas", "esconde", "ri", "língua", "espirra", "coça", "vem aqui". Ele sempre repete primeiro e, se reconhecer o comando, obedece. O reconhecimento é offline, no aparelho, e restrito à lista (sem enviar áudio para a internet). Nas Figuras os comandos ficam pausados. Nos pais: liga/desliga, "facilidade para obedecer", último comando ouvido e botão para testar cada um.
>
> **9. Pais:** área escondida (segurar a engrenagem) com sensibilidade do microfone e medidor, tom da repetição, velocidade da voz, liga/desliga "imitar quando quieta" e a borboleta, volumes, estatísticas (falas por dia e palavras tentadas) e dicas.
>
> **Técnica:** HTML/CSS/JS puro, PWA instalável e offline, Web Audio (detecção de voz, gravação, repetição com efeitos), falas pré-gravadas com voz neural.
