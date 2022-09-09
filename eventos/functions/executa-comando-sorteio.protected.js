const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();

/*
    event: evento, palavra, comando, to
*/
exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();

    event.palavra = event.palavra.toLowerCase();

    let data = {};
    let mensagem = [];

    // mensagem.push(`comando ${event.comando.toUpperCase()} executado com sucesso!`);

    switch(event.comando.toUpperCase()) {
        case 'ABRIR':
        case 'FECHAR':
                await firestore.collection('events')
                .doc(event.evento).collection('sorteios')
                .doc(event.palavra)
                .set({
                    status: event.comando.toUpperCase() == 'ABRIR' ? 'aberto' : 'fechado',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true});
    
                mensagem.push(`*${event.palavra.toUpperCase()}* foi *${event.comando.toUpperCase() == 'ABRIR' ? 'aberta' : 'fechada'}* com sucesso!`);
            break;

        case 'SORTEAR':

            const sorteado = await firestore.collection('events')
                .doc(event.evento).collection('sorteios')
                .doc(event.palavra).collection('participantes')
                .where('sorteado', '!=', true)
                .orderBy('sorteado', 'asc')
                .orderBy('seed', 'desc')
                .limit(1)
                .get().then(s => {
                    if (s.size == 0) {
                        return null
                    }
                    return s.docs.map(d => {
                        return {
                            id: d.id, 
                            ...d.data()
                        };
                    })[0];

                });

            if (sorteado) {

                // Atualizar status de sorteio
                await firestore.collection('events')
                    .doc(event.evento).collection('sorteios')
                    .doc(event.palavra).collection('participantes')
                    .doc(sorteado.participanteId)
                    .set({
                        sorteado: true,
                        sorteadoAt: admin.firestore.FieldValue.serverTimestamp(),                        
                    }, { merge: true });

                // Carregar participante para obter número do WhatsApp
                let participanteId = sorteado.participanteId;

                let participante = await firestore.collection('events')
                    .doc(event.evento).collection('participantes')
                    .doc(participanteId).get().then(async s => {
                        if (s.exists) {
                            return s.data();
                        } else {
                            return {}
                        }
                });

                if (participante) {

                    await firestore.collection('events')
                        .doc(event.evento).collection('participantes')
                        .doc(participanteId).set({ 
                            sorteios: admin.firestore.FieldValue.increment(1),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true});

                    await firestore.collection('participantes')
                        .doc(participanteId).set({ 
                            sorteios: admin.firestore.FieldValue.increment(1),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true});

                    
                    // Enviar mensagem para pessoa sorteada
                    let mensagemSorteio = [];
                    mensagemSorteio.push(`🚨 PARABÉNS 🚨`)
                    mensagemSorteio.push(`Você foi uma pessoa contemplada no sorteio da palavra-chave *${event.palavra.toUpperCase()}*!`);
                    mensagemSorteio.push(`Apresente esta mensagem para os organizadores do sorteio ou aguarde mais instruções caso esteja participando online.`);

                    await sendNotification(
                        client,
                        event.to,
                        `whatsapp:${participante.phoneNumber}`,
                        mensagemSorteio.join('\n\n')
                    );

                    mensagem.push(`🎉 ${sorteado.telefone.split('*').join('∗')}: ${sorteado.nome} 🎉`);
                    mensagem.push([
                        `Você deseja que esta pessoa receba uma ligação?`,
                        `Responda com *SIM* ou *NÃO*.`
                    ].join('\n'));
                    
                    data.participanteId = participanteId;
                    data.telefone = participante.phoneNumber;
                    data.retornoSorteio = true;

                }
            } else {
                mensagem.push(`🚨 Nenhum registro encontrado para sorteio! 🚨`);
                data.retornoSorteio = false;
            }

            // TODO: retornar opção para ligação

            break;

        case 'LISTA':
            const sorteados = await firestore.collection('events')
                .doc(event.evento).collection('sorteios')
                .doc(event.palavra).collection('participantes')
                .where('sorteado', '==', true)
                .orderBy('sorteadoAt', 'desc')
                .get().then(s => {
                    return s.docs.map(d => {
                        return {
                            id: d.id, 
                            ...d.data()
                        };
                    });
                });

            const nomeSorteados = sorteados.map(item => 
                `- ${item.telefone.split('*').join('∗')}: ${item.nome}`
            );

            if (nomeSorteados.length == 0) {
                mensagem.push(`Nenhuma pessoa foi sorteada em *${event.palavra.toUpperCase()}*.`)
            } else {
                mensagem.push(`Lista de pessoas sorteadas em *${event.palavra.toUpperCase()}*:`);
                mensagem.push(nomeSorteados.join('\n'));
            }
            break;
    }


    data.mensagem = mensagem.join('\n\n');

    callback(null, data);

};
