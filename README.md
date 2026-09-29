# 🐶 Faladeiro

O cachorrinho que **repete tudo** o que a criança fala (estilo Talking Tom), **obedece comandos de voz** e incentiva a falar mais. Jogo web *mobile first* para crianças de ~2 anos: sem leitura, sem fases, sem botões de "próximo".

**Jogar:** https://mqzgames.github.io/Faladeiro/ (depois de publicado no GitHub Pages)

## Como funciona

- **O microfone fica sempre ligado.** Em qualquer momento que a criança fala ou faz barulho, o cachorro pausa o que está fazendo e repete com voz fininha. Depois reage ("De novo!", "Uau!", risada) e volta para a brincadeira.
- **Comandos de voz:** se ele reconhece um comando, obedece logo depois de repetir (lista abaixo).
- **Criança quieta?** Ele imita as últimas falas dela com vozes engraçadas (grossa, cantando, com eco...) para chamá-la de volta.
- **Toques no corpo:** nariz espirra, barriga faz cócegas, pata bate "toca aqui", rabo gira, cabeça ganha carinho.
- **Arrastar o corpo pega o cachorro no colo.** Ele balança e cai quicando.

## Comandos de voz

| Fale | Ele... |
|---|---|
| "fica bravo" | faz cara de bravo, rosna e depois ri ("Brincadeira!") |
| "vai deitar", "dorme", "nana" | boceja e dorme |
| "acorda" | acorda |
| "biscoito", "quer biscoito", "fome", "papá" | fica com fome, aparece um biscoito e ele come |
| "corre" | corre pela tela |
| "pega a bola", "bola" | a bola aparece, ele corre e pega |
| "pula" | pula |
| "senta" | senta bonitinho |
| "late", "au au" | late |
| "dança", "música" | festa de dança |
| "gira", "roda" | gira |
| "rola" | dá uma cambalhota |
| "dá a pata", "toca aqui" | bate na mão |
| "beijo" | manda beijo |
| "abraço" | dá um abraço |
| "oi", "olá" | acena e diz oi |
| "tchau" | dá tchau |
| "canta" | canta lá lá lá |
| "bolhas" | faz bolhas |
| "esconde", "cadê" | brinca de esconder |
| "ri", "cócegas" | dá risada |
| "língua" | mostra a língua |
| "espirra" | espirra |
| "coça" | se coça |
| "vem", "vem aqui" | vem pertinho |

A mesma lista aparece na **área dos pais**, com um botão ▶ para testar cada comando.

Sobre o reconhecimento:
- Ele roda **no próprio celular** (Vosk, offline) e usa só essa lista, sem enviar áudio para a internet.
- Na primeira vez baixa cerca de **38 MB**; depois funciona sem internet.
- Com voz de adulto acerta muito bem. Com a fala da criança o acerto é menor; ajuste **"Facilidade para obedecer"** na área dos pais.
- Nas Figuras (📖) os comandos ficam pausados, para que "bola" conte como resposta.

## Brinquedos (bandeja de baixo)

| | O que acontece |
|---|---|
| ⚽ | Arraste e jogue a bola (ou toque para chutar). Ele corre atrás, pega no ar e traz de volta. |
| 🍎 | Comida aparece. Arraste até a boca, toque ou fale; ele come fazendo "nham nham". |
| 🫧 | Bolhas para estourar. A voz da criança faz mais bolhas. |
| 🎵 | Festa de dança. Dá para arrastar o cachorro dançando. |
| 📖 | Figuras que passam sozinhas: ele fala, espera e comemora qualquer som. Tocar na figura passa para a próxima. |
| 🌙 | Hora de dormir. Falando baixinho, ele repete sonolento; um toque, um grito ou "acorda" o acordam. |

## Banco de dados?

**Não tem.** O Faladeiro é só um conjunto de arquivos estáticos (HTML, CSS, JS, áudios): não há servidor nem login. As configurações e as estatísticas ficam salvas **no próprio aparelho**, no armazenamento do navegador. Por isso ele pode ser hospedado de graça no GitHub Pages.

## Publicar no GitHub Pages

1. Envie os arquivos para o repositório:

```bash
git push -u origin main
```

2. No GitHub, abra **Settings → Pages**.
3. Em **Source**, escolha *Deploy from a branch*, depois **main** e **/ (root)**, e salve.
4. Em 1 a 2 minutos o jogo fica em `https://mqzgames.github.io/Faladeiro/`. É https, então o microfone funciona.
5. No celular, abra o link e instale: no Chrome, menu ⋮ → **Instalar app**; no iPhone, Compartilhar → **Adicionar à Tela de Início**.

Testar no computador:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Área dos pais

**Segure a engrenagem ⚙️ (canto superior direito) por 2 segundos.** Lá ficam:
- os comandos de voz, com a lista, os testes e a facilidade para obedecer;
- a sensibilidade do microfone, com medidor;
- o tom da repetição e a velocidade da voz;
- os botões para ligar e desligar "imitar quando quieta" e a borboleta;
- os volumes;
- as estatísticas: falas por dia e palavras ou comandos já falados;
- as dicas.

## Vozes

As falas do cachorro são áudios gravados com voz neural pt-BR (pasta `voice/`). Para mudar ou acrescentar falas:

1. Edite `voice/falas.json`.
2. Rode:

```bash
python -m pip install edge-tts
```

```bash
python tools/gerar_vozes.py
```

## Estrutura

```
index.html            cenário, cachorro (SVG), bandeja, área dos pais
css/style.css         visual
js/store.js           configurações e estatísticas (no aparelho)
js/sound.js           efeitos, músicas, repetição com vozes engraçadas
js/voice.js           falas gravadas (voz neural) + reserva
js/mic.js             detecção de voz/barulho sempre ligada
js/commands.js        comandos de voz (lista + reconhecimento offline)
js/dog.js             animações, corrida, colo, expressões, boca sincronizada
js/fx.js              partículas, confete, bolhas
js/ui.js              figuras, bandeja, área dos pais
js/ball.js            física da bola
js/brain.js           comportamento: repetir, imitar, obedecer, brinquedos
js/main.js            toques (vários dedos) e ciclo do app
js/vendor/vosk.js     reconhecedor de voz offline (vosk-browser)
vosk/model.tar.gz     modelo de fala em português (Vosk small pt 0.3)
voice/                falas gravadas + falas.json
tools/gerar_vozes.py  gera as falas
```

## Créditos

- Reconhecimento de voz: [Vosk](https://alphacephei.com/vosk/) e [vosk-browser](https://github.com/ccoreilly/vosk-browser) (Apache-2.0). O modelo `vosk-model-small-pt-0.3` vem da [lista de modelos do Vosk](https://alphacephei.com/vosk/models); consulte a licença lá. A cópia em `js/vendor/vosk.js` tem dois ajustes pequenos, descritos no topo do arquivo.
- Falas geradas com voz neural pt-BR (Microsoft Edge TTS) via [edge-tts](https://github.com/rany2/edge-tts).

> Faladeiro é um apoio lúdico e não substitui a avaliação de um fonoaudiólogo.
