const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');
const fs = require('fs');

const DICIONARIO = fs.readFileSync(Runtime.getAssets()['/pt-br.txt'].path, 'utf-8').split('\n');

const PALAVRAS_FILTRO = [
    'VENDA',
    'AJUDA',
    'LEADS',
    'VIDEO',
    'LIVRE',
    'FALAR',
    'FELIZ',
    'OUVIR',
    'LIGAR',
    'RAMAL',
    'UNICO',
    'VALOR',
    'VISAO',
    'ZELAR',
    'AMIGO',
    'BOLHA',
    'BOTAO',
    'CANAL',
    'CRIAR',
    'LIDER',
    'MUNDO',
    'NIVEL',
    'ROLHA',
    'RADAR',
    'TOTAL',
    'UNIAO',
    'PRATA',
    'PORTA',
    'PONTE',
    'PAPEL',
    'OLHAR',
    'OLHOS',
    'ONDAS',
    'MURAL',
    'MUNDO',
    'MUDAR',
    'IDEIA',
    'FONTE'
]
const palavraAleatoria = () => {
    return PALAVRAS_FILTRO[PALAVRAS_FILTRO.length * Math.random() | 0];
    // return DICIONARIO[DICIONARIO.length * Math.random() | 0];
}

/*
    event: evento, palpite, from, to
*/
exports.handler = async function(context, event, callback) {

    let participanteId = await md5(limpaNumero(event.from));

    let participante = await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return null;
        }
    });
    console.log('PARTICIPANTE', participante);

    if (!participante.jogo || 
        // (participante.jogo && participante.jogo.tentativas && participante.jogo.tentativas >= parseInt(process.env.GAME_TENTATIVAS_MAXIMO) ||
        (participante.jogo && participante.jogo.finalizado)
    ) {
        // TODO: Gerar nova palavra-chave se participante não possuir ou se tiver finalizado

        const PALAVRA_SORTEADA = palavraAleatoria();

        await firestore.collection('events')
            .doc(event.evento).collection('participantes')
            .doc(participanteId).set({
                phoneNumber: limpaNumero(event.from),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                jogo: {
                    palavra: PALAVRA_SORTEADA,
                    tentativas: 0,
                    finalizado: false,
                    listaLetrasErradas: []
                }
            }, { merge: true });

        participante = await firestore.collection('events')
            .doc(event.evento).collection('participantes')
            .doc(participanteId).get().then(async s => {
                if (s.exists) {
                    return s.data();
                } else {
                    return null;
                }
        });


    }


    // TODO: Verificar se participante possui palavra ativa ou finalizou um jogo
    // TODO: Verificar status da palavra-chave recebida
    // TODO: Se chegar na última tentativa, adicionar registro de tentativas na colecao


    let data = {};
    let mensagem = [];
    let resultado = [];

    const PALAVRA = 'MIOLO';

    let jogo = {
        palavra: participante.jogo.palavra,
        letrasDuplicadas: [...participante.jogo.palavra],
        tentativas: participante.jogo.tentativas,
        finalizado: false,
        letrasCertas: participante.jogo.letrasCertas | 0,
        listaLetrasErradas: [...participante.jogo.listaLetrasErradas]
    };



    // Transformar em maiúscula, retirar acentuação e cedilha
    const palpite = event.palpite.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const estaNoDicionario = DICIONARIO.indexOf(palpite) >= 0;

    // Verificar se consta na lista do dicionário
    if (!estaNoDicionario) {
        mensagem.push(`A palavra *${event.palpite.toUpperCase()}* não está no nosso dicionário.`);
        mensagem.push(`Não vou considerar esta tentativa! 😉`);
    } else {
        jogo.tentativas++;

        for (let i = 0; i < palpite.length; i++) {
            if (palpite.charAt(i) == jogo.palavra.charAt(i)) {
                if (jogo.letrasDuplicadas[i] != null) {
                    jogo.letrasCertas+=1;
                }
                jogo.letrasDuplicadas[i] = null;
                resultado.push('🟩');
            } else if (palpite.charAt(i) != jogo.palavra.charAt(i) && jogo.palavra.includes(palpite.charAt(i))) {
                resultado.push('🟨');
            } else {
                if (!jogo.listaLetrasErradas.includes(palpite.charAt(i))); {
                    jogo.listaLetrasErradas.push(palpite.charAt(i));
                }
                resultado.push('⬛');
            }
        }
        jogo.listaLetrasErradas = [...new Set(jogo.listaLetrasErradas)];
        mensagem.push(resultado.join(','));

        if (jogo.palavra == palpite) {
            jogo.ganhou = true;
            jogo.finalizado = true;
            mensagem.push(`🔥 Parabéns!\nVocê acertou a palavra correta com ${jogo.tentativas} de ${process.env.GAME_TENTATIVAS_MAXIMO} palpites!`);
            mensagem.push(`Você pode resgatar até ${process.env.LIMITE_RESGATES} itens hoje.`)

        } else {
            jogo.ganhou = false;

            if (jogo.tentativas >= parseInt(process.env.GAME_TENTATIVAS_MAXIMO)) {
                jogo.finalizado = true;
                
                mensagem.push(`Você não conseguiu acertar a palavra *${jogo.palavra.toUpperCase()}*!`);
                mensagem.push(`Uma nova palavra foi gerada e você pode continuar jogando!`);

            } else {
                mensagem.push(`Tentativa ${jogo.tentativas}/${process.env.GAME_TENTATIVAS_MAXIMO}`);
            }
        }

        if (jogo.finalizado) {
            // Calcular pontuação

            jogo.pontos = 0;
            if (jogo.ganhou) {               

                switch(jogo.tentativas) {
                    case 1: jogo.pontos = 15; break; // 15
                    case 2: jogo.pontos = 10; break; // 10
                    case 3: jogo.pontos = 5; break; // 5
                    case 4: jogo.pontos = 2; break; // 2
                    case 5: jogo.pontos = 1; break; // 1
                    // default: jogo.pontos = 1;
                }

            } else {
                jogo.pontos = 1;
            }
            // TODO: adicionar registro de jogos ganhos, perdas, e tentativas
            let gameStats = {
                ganhos: admin.firestore.FieldValue.increment(jogo.ganhou ? 1 : 0),
                perdas: admin.firestore.FieldValue.increment(!jogo.ganhou ? 1 : 0),
                tentativas: {}
            }
            if (jogo.ganhou) {
                gameStats.tentativas[jogo.tentativas] = admin.firestore.FieldValue.increment(1);
            } else {
                gameStats.tentativas['💀'] = admin.firestore.FieldValue.increment(1);
            }

            await firestore.collection('events')
                .doc(event.evento)
                .set({
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    jogo: gameStats
                }, { merge: true });


            if (jogo.pontos > 0) {
                mensagem.push(`Você ganhou *${jogo.pontos}* ⭐️!`);
                mensagem.push('Quer resgatar seus pontos? Vá até a vending machine e envie *RESGATE* aqui.');

                // Adicionar pontuação
                await firestore.collection('events')
                    .doc(event.evento).collection('participantes')
                    .doc(participanteId)
                    .set({
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        pontosCorrente: admin.firestore.FieldValue.increment(jogo.pontos),
                        pontosAcumulados: admin.firestore.FieldValue.increment(jogo.pontos),
                    }, { merge: true });
        
            }

            // Registrar log do jogo
            await firestore.collection('events')
                .doc(event.evento).collection('participantes')
                .doc(participanteId).collection('jogos').add({
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    jogo
                });

            mensagem.push(`Jogue novamente enviando uma nova palavra de 5 letras para adivinhar uma outra palavra escolhida aleatoriamente e ganhar ⭐️. Quer saber quantos pontos possui? Envie *PONTOS*!`);
        }

        await firestore.collection('events')
            .doc(event.evento).collection('participantes')
            .doc(participanteId).set({
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                jogo
            }, { merge: true });

    }

    // DEMO:
    // mensagem.push('');
    // mensagem.push(`PALAVRA: ${jogo.palavra}`);

    data.mensagem = mensagem.join('\n\n');
    callback(null, data);



};
